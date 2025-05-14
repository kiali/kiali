package business

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	user_v1 "github.com/openshift/api/user/v1"
	"golang.org/x/oauth2"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

const (
	// OAuthServerCAFile is a certificate bundle used to connect to the oAuth server.
	// This is for cases when the authentication server is using TLS with a self-signed
	// certificate.
	OAuthServerCAFile = "/kiali-cabundle/oauth-server-ca.crt"
)

const (
	defaultAccessTokenAgeInSeconds = 86400 // 24 hours in seconds
	userScopeFull                  = "user:full"
)

// TODO: Too many oauthconfigs? We don't want to expose the oauth2.Config since that
// potentially has the secret in it but there's probably too many representations of
// the oauthconfig.

// OAuthConfig is some configuration for the OAuth service.
type OAuthConfig struct {
	// AuthorizationEndpoint is the url to redirect the user to for authentication.
	// Kiali must now redirect to a url that it owns in order to first attach
	// the nonce to the session until we can think of a better way to do this.
	AuthorizationEndpoint string
	RedirectURL           string
	TokenAgeInSeconds     int
}

// oAuthConfig is the oauth2 config with some additional fields
// copied over from the openshift oauthclient object.
type oAuthConfig struct {
	oauth2.Config

	// AccessTokenMaxAgeSeconds is the maximum age of the access token in seconds.
	AccessTokenMaxAgeSeconds int
}

type OpenshiftOAuthService struct {
	clientFactory  kubernetes.ClientFactory
	conf           *config.Config
	kialiSAClients map[string]kubernetes.ClientInterface
	oAuthConfigs   map[string]*oAuthConfig
	certPool       *x509.CertPool
}

// Structure that's returned by the openshift oauth authorization server.
// It defaults to following the snake_case format, so we parse it to something
// more usable on our side.
type OAuthAuthorizationServer struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	Issuer                string `json:"issuer"`
}

// Generates an http.Client with RootCAs specified in kubeconfig along with the system certs.
func httpClientWithPool(conf *config.Config, restConfig rest.Config, systemPool *x509.CertPool) (*http.Client, error) {
	// Need to populate CAData from CAFile.
	if err := rest.LoadTLSFiles(&restConfig); err != nil {
		return nil, fmt.Errorf("unable to load CA info from restConfig")
	}

	tlsConfig, err := rest.TLSConfigFor(&restConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to create tls config from restConfig: %s", err)
	}

	// We can't merge two cert pools directly so first check that some tls configuration
	// is set and then use the original kubeConfig CAData.
	if tlsConfig == nil {
		tlsConfig = &tls.Config{}
	}

	// If this setting is set in the Kiali config then override whatever is set on the kubeconfig.
	if conf.Auth.OpenShift.InsecureSkipVerifyTLS {
		tlsConfig.InsecureSkipVerify = true
	}

	if !tlsConfig.InsecureSkipVerify {
		// Append system certs
		pool := systemPool.Clone()
		if restConfig.TLSClientConfig.CAData != nil {
			log.Trace("Appending CA data from tls client config to pool")
			if !pool.AppendCertsFromPEM(restConfig.TLSClientConfig.CAData) {
				return nil, fmt.Errorf("unable to append CA from restConfig to system pool: %s", restConfig.TLSClientConfig.CAData)
			}
		}
		tlsConfig.RootCAs = pool
	} else {
		log.Debug("Insecure connection to oAuth server.")
	}

	return &http.Client{
		Timeout:   restConfig.Timeout,
		Transport: &http.Transport{TLSClientConfig: tlsConfig},
	}, nil
}

// Returns a new cert Pool with the system certs appended as well as
// any custom CA if it exists.
func newCertPool(conf *config.Config, oAuthServerCAFilePath string) *x509.CertPool {
	pool := conf.CertPool()

	if b, err := os.ReadFile(oAuthServerCAFilePath); err == nil {
		if ok := pool.AppendCertsFromPEM(b); !ok {
			log.Errorf("Unable to append oAuth server CA to cert pool. Ensure that your CA bundle file: '%s' is formatted correctly as a PEM encoded block", oAuthServerCAFilePath)
		}
	} else if !os.IsNotExist(err) {
		log.Errorf("Unable to read oAuth server CA from bundle file '%s': %s", oAuthServerCAFilePath, err)
	}

	return pool
}

// NewOpenshiftOAuthService creates a new OpenshiftOAuthService.
// It will try to autodiscover the OAuth server configuration from each cluster.
// It also assumes that you've created an OAuthClient for Kiali in each cluster.
func NewOpenshiftOAuthService(ctx context.Context, conf *config.Config, kialiSAClients map[string]kubernetes.ClientInterface, clientFactory kubernetes.ClientFactory, oAuthServerCustomCAFilePath string) (*OpenshiftOAuthService, error) {
	oAuthConfigs := make(map[string]*oAuthConfig)

	// Creating a single context for all the clusters.
	var cancel context.CancelFunc
	// How many times we're going to try to get the oAuth metdata.
	// After a minute we should give up.
	oneMinuteFromNow := time.Now().Add(time.Minute)
	ctx, cancel = context.WithDeadline(ctx, oneMinuteFromNow)
	defer cancel()

	pool := newCertPool(conf, oAuthServerCustomCAFilePath)

	// TODO: We could parallelize this to potentially speed up the process.
	for cluster, client := range kialiSAClients {
		if !client.IsOpenShift() {
			log.Infof("While setting up the OAuthService, skipping cluster [%s] because it is not an OpenShift cluster", cluster)
			continue
		}

		log.Debugf("Getting OAuth config for cluster [%s]", cluster)
		// Use CA info from kube config.
		url := client.ClusterInfo().ClientConfig.Host + "/.well-known/oauth-authorization-server"
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request for fetching oauth server metadata from kube api server url [%s]. Likely the url is malformed. Error: %s", url, err)
		}
		request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.GetToken()))

		httpClient, err := httpClientWithPool(conf, *client.ClusterInfo().ClientConfig, pool)
		if err != nil {
			return nil, fmt.Errorf("failed to create http client for fetching oauth server metadata from kube api server [%s], error: %s", url, err)
		}

		var response []byte
		err = wait.PollUntilContextCancel(ctx, time.Second*10, true, func(ctx context.Context) (bool, error) {
			// TODO: Catch specific errors and retry only on those?
			var err error
			response, err = doRequest(httpClient, request)
			if err != nil {
				log.Infof("Failed to get oauth metadata from Kubernetes API server for endpoint [%s]. Error: %s. Retrying...", url, err)
				return false, nil
			}

			return true, nil
		})
		if err != nil {
			return nil, fmt.Errorf("failed to get oauth metadata from Kubernetes API server for endpoint [%s]. Error: %s", url, err)
		}

		oAuthServer := &OAuthAuthorizationServer{}
		if err := json.Unmarshal(response, &oAuthServer); err != nil {
			log.Error(err)
			message := fmt.Errorf("could not parse OAuthAuthorizationServer: %v", err)
			return nil, message
		}

		// Get the OAuthClient for Kiali. This is created by the operator or the helm chart.
		kialiOAuthClientName := conf.Deployment.InstanceName + "-" + conf.Deployment.Namespace
		oAuthClient, err := client.GetOAuthClient(ctx, kialiOAuthClientName)
		if err != nil {
			log.Errorf("Could not get OAuth client: %v", err)
			return nil, err
		}

		if len(oAuthClient.RedirectURIs) == 0 {
			return nil, fmt.Errorf("oAuth client has no redirect URIs")
		}

		oAuthConfig := &oAuthConfig{
			Config: oauth2.Config{
				ClientID:    oAuthClient.Name,
				RedirectURL: oAuthClient.RedirectURIs[0],
				Scopes:      []string{userScopeFull},
				Endpoint: oauth2.Endpoint{
					AuthURL:  oAuthServer.AuthorizationEndpoint,
					TokenURL: oAuthServer.TokenEndpoint,
				},
			},
		}

		if oAuthClient.AccessTokenMaxAgeSeconds != nil {
			oAuthConfig.AccessTokenMaxAgeSeconds = int(*oAuthClient.AccessTokenMaxAgeSeconds)
		} else {
			oAuthConfig.AccessTokenMaxAgeSeconds = defaultAccessTokenAgeInSeconds
		}

		oAuthConfigs[cluster] = oAuthConfig
	}

	return &OpenshiftOAuthService{
		clientFactory:  clientFactory,
		conf:           conf,
		kialiSAClients: kialiSAClients,
		oAuthConfigs:   oAuthConfigs,
		certPool:       pool,
	}, nil
}

// Exchange exchanges the code for a token that can be used to talk to the kube API server.
func (in *OpenshiftOAuthService) Exchange(ctx context.Context, code string, verifier string, cluster string) (*oauth2.Token, error) {
	client := in.kialiSAClients[cluster]
	if client == nil {
		return nil, fmt.Errorf("could not get ServiceAccount client for cluster [%s]", cluster)
	}

	httpClient, err := httpClientWithPool(in.conf, *client.ClusterInfo().ClientConfig, in.certPool)
	if err != nil {
		return nil, fmt.Errorf("failed to create http client for oauth consumption, error: %s", err)
	}

	oAuthConfig := in.oAuthConfigs[cluster]
	if oAuthConfig == nil {
		return nil, fmt.Errorf("could not get OAuth config for cluster [%s]", cluster)
	}

	ctx = context.WithValue(ctx, oauth2.HTTPClient, httpClient)
	tok, err := oAuthConfig.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return nil, fmt.Errorf("could not exchange the code for a token: %v", err)
	}

	return tok, nil
}

// AuthCodeURL returns the URL to redirect the user to for authentication.
func (in *OpenshiftOAuthService) AuthCodeURL(verifier string, cluster string) (string, error) {
	oAuthConfig := in.oAuthConfigs[cluster]
	if oAuthConfig == nil {
		return "", fmt.Errorf("could not get OAuth config for cluster [%s]", cluster)
	}

	return oAuthConfig.AuthCodeURL("", oauth2.S256ChallengeOption(verifier)), nil
}

func (in *OpenshiftOAuthService) GetUserInfo(ctx context.Context, token string, cluster string) (*user_v1.User, error) {
	userClient, err := in.clientFactory.GetClient(&api.AuthInfo{Token: token}, cluster)
	if err != nil {
		return nil, fmt.Errorf("could not get client for user info: %w", err)
	}

	user, err := userClient.GetUser(ctx, "~")
	if err != nil {
		return nil, fmt.Errorf("could not get user info: %w", err)
	}

	return user, nil
}

// Logout deletes the oauth access token from the API server.
func (in *OpenshiftOAuthService) Logout(ctx context.Context, token string, cluster string) error {
	// https://github.com/kiali/kiali/issues/3595
	// OpenShift 4.6+ changed the format of the OAuthAccessToken.
	// In pre-4.6, the access_token given to the client is the same name as the OAuthAccessToken resource.
	// In 4.6+, that is not true anymore - you have to encode the access_token to obtain the OAuthAccessToken resource name.
	// The code below will attempt to delete the access token using the new 4.6+ format.

	// convert the access token to the corresponding oauthaccesstoken resource name
	// see: https://github.com/openshift/console/blob/9f352ba49f82ad693a72d0d35709961428b43b93/pkg/server/server.go#L609-L613
	sha256Prefix := "sha256~"
	h := sha256.Sum256([]byte(strings.TrimPrefix(token, sha256Prefix)))
	oauthTokenName := sha256Prefix + base64.RawURLEncoding.EncodeToString(h[0:])
	log.Debugf("Logging out by deleting OAuth access token [%v] which was converted from access token [%v]", oauthTokenName, token)

	// Delete the access token from the API server using OpenShift 4.6+ access token name
	kialiSAClient := in.kialiSAClients[cluster]
	if kialiSAClient == nil {
		return fmt.Errorf("could not get ServiceAccount client for cluster [%s]", cluster)
	}

	return kialiSAClient.DeleteOAuthToken(ctx, oauthTokenName)
}

func (in *OpenshiftOAuthService) OAuthConfig(cluster string) (*OAuthConfig, error) {
	oAuthConfig := in.oAuthConfigs[cluster]
	if oAuthConfig == nil {
		return nil, fmt.Errorf("OAuth config does not exist for cluster [%s]", cluster)
	}

	return &OAuthConfig{
		RedirectURL:       oAuthConfig.RedirectURL,
		TokenAgeInSeconds: oAuthConfig.AccessTokenMaxAgeSeconds,
	}, nil
}

func doRequest(client *http.Client, request *http.Request) ([]byte, error) {
	defer client.CloseIdleConnections()

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("failed to get response for api endpoint [%s] for oauth consumption, error: %s", request.URL, err)
	}

	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body for api endpoint [%s] for oauth consumption, error: %s", request.URL, err)
	}

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get OK status from api endpoint [%s] for oauth consumption, error: %s", request.URL, string(body))
	}

	return body, nil
}
