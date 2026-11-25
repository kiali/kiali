package business

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	user_v1 "github.com/openshift/api/user/v1"
	"golang.org/x/oauth2"
	k8s_errors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
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
	// oAuthConfigsMutex guards all access to oAuthConfigs and oAuthConfigsBuilding after
	// construction: a lazy insert must never race even a read of an existing entry
	// (concurrent map read/write is a fatal panic, and an unrelated home login must not
	// crash because a recovered remote is being rebuilt).
	oAuthConfigsMutex sync.Mutex
	// oAuthConfigsBuilding coalesces concurrent lazy builds per cluster: one caller polls
	// the remote, the rest wait for its result instead of each running a minutes-long
	// metadata retry in parallel.
	oAuthConfigsBuilding map[string]*oAuthConfigBuild
}

// oAuthConfigBuild carries one in-flight lazy OAuth config build.
type oAuthConfigBuild struct {
	config *oAuthConfig
	err    error
	done   chan struct{}
}

// Structure that's returned by the openshift oauth authorization server.
// It defaults to following the snake_case format, so we parse it to something
// more usable on our side.
type OAuthAuthorizationServer struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	Issuer                string `json:"issuer"`
}

// Generates an http.Client with RootCAs specified in kubeconfig along with the managed cert pool.
// The managed cert pool includes system CAs and any additional CAs configured via the kiali-cabundle ConfigMap.
func httpClientWithPool(conf *config.Config, restConfig rest.Config) (*http.Client, error) {
	// The config passed in is ClusterInfo().ClientConfig - the original shared config, which
	// never carries the live-call request timeout (that lives on the K8SClient's private
	// copy). These metadata and token fetches are live round trips: bound them with the
	// configured request timeout.
	kubernetes.ApplyRequestTimeout(&restConfig, conf)
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
		// Get the managed cert pool with additional CA data from the restConfig
		// This supports CA rotation as the pool is fetched fresh each time
		pool, err := conf.CertPoolWithAdditionalPEM(restConfig.CAData)
		if err != nil {
			return nil, fmt.Errorf("unable to create cert pool with additional CA data: %w", err)
		}
		tlsConfig.RootCAs = pool
	} else {
		log.Debug("Insecure connection to oAuth server.")
	}

	// Apply the resolved TLS policy to enforce version/cipher constraints
	conf.ResolvedTLSPolicy.ApplyTo(tlsConfig)

	return &http.Client{
		Timeout: restConfig.Timeout,
		Transport: &http.Transport{
			// The OpenShift OAuth server is usually reached in-cluster, but in
			// egress-controlled environments it may require a proxy. Unlike
			// OpenID, there is no config-based proxy setting for this client,
			// so the standard HTTP_PROXY/HTTPS_PROXY/NO_PROXY env vars are the
			// only mechanism.
			Proxy:           http.ProxyFromEnvironment,
			TLSClientConfig: tlsConfig,
		},
	}, nil
}

// oauthConfigIneligible reports why the cluster should not get an OAuth configuration,
// or nil if it should: impersonation-mode remotes deliberately never do (the home cluster's
// config carries the login), and a cluster the platform probe identifies as plain
// Kubernetes has no OAuth server to talk to. Both the constructor and the lazy rebuild
// consult this - the lazy path once missed the platform check and polled a Kubernetes
// cluster's metadata endpoint for a minute.
func oauthConfigIneligible(conf *config.Config, cluster string, client kubernetes.ClientInterface) error {
	if conf.Auth.OpenShift.Impersonation.Enabled && cluster != conf.KubernetesConfig.ClusterName {
		return fmt.Errorf("impersonation mode does not require per-cluster OAuth for cluster [%s]", cluster)
	}
	if !client.IsOpenShift() {
		return fmt.Errorf("cluster [%s] is not an OpenShift cluster; it has no OAuth configuration", cluster)
	}
	return nil
}

// NewOpenshiftOAuthService creates a new OpenshiftOAuthService.
// It will try to autodiscover the OAuth server configuration from each cluster.
// It also assumes that you've created an OAuthClient for Kiali in each cluster.
// A cluster whose OAuth configuration cannot be fetched is not fatal: the service is created
// without that cluster's config, and the config is built lazily on first use (see
// getOAuthConfig), so a remote that was unavailable at startup becomes loginable once it
// recovers, without a Kiali restart.
func NewOpenshiftOAuthService(ctx context.Context, conf *config.Config, kialiSAClients map[string]kubernetes.ClientInterface, clientFactory kubernetes.ClientFactory) (*OpenshiftOAuthService, error) {
	oAuthConfigs := make(map[string]*oAuthConfig)
	var homeErr error

	// Each cluster gets its own deadline and its own goroutine: one slow or unavailable
	// remote adds its timeout to startup once, not once per remote ahead of it, and the
	// total stays inside the pod's startup-probe budget.
	var oauthWg sync.WaitGroup
	var oauthMu sync.Mutex
	for cluster, client := range kialiSAClients {
		oauthWg.Add(1)
		go func(cluster string, client kubernetes.ClientInterface) {
			defer oauthWg.Done()
			// The eligibility checks run inside the goroutine because the platform check
			// is a live round trip: an unavailable remote costs one timeout once, not
			// once per remote ahead of it. An ineligible cluster is skipped uniformly,
			// home included (an openshift-strategy install on a non-OpenShift home is a
			// configuration error the login flow surfaces); only a build failure on the
			// home cluster is fatal below.
			if err := oauthConfigIneligible(conf, cluster, client); err != nil {
				log.Infof("While setting up the OAuthService, skipping cluster [%s]: %v", cluster, err)
				return
			}
			clusterCtx, cancel := context.WithTimeout(ctx, oauthConfigConstructionTimeout)
			oAuthConfig, err := buildOAuthConfig(clusterCtx, conf, client)
			cancel()
			if err != nil {
				if cluster == conf.KubernetesConfig.ClusterName {
					// The home cluster's OAuth config is required for login: without it
					// the auth controller cannot be built at all.
					oauthMu.Lock()
					homeErr = err
					oauthMu.Unlock()
					return
				}
				log.Warningf("Could not set up OAuth config for remote cluster [%s]; login to that cluster will be retried on demand. Error: %v", cluster, err)
				return
			}

			oauthMu.Lock()
			oAuthConfigs[cluster] = oAuthConfig
			oauthMu.Unlock()
		}(cluster, client)
	}
	oauthWg.Wait()
	if homeErr != nil {
		return nil, homeErr
	}

	return &OpenshiftOAuthService{
		clientFactory:  clientFactory,
		conf:           conf,
		kialiSAClients: kialiSAClients,
		oAuthConfigs:   oAuthConfigs,
	}, nil
}

// oauthConfigConstructionTimeout bounds a single cluster's OAuth configuration fetch at
// construction. It stays hardcoded rather than configurable because it is not derived from
// the environment but from the pod's startup-probe budget (helm and the operator default
// to ~90s): a deployer raising it would only have the kubelet restart Kiali before
// /healthz is served. The lazy rebuild's budget, where a user is waiting at the login
// page and no probe is involved, is configurable instead
// (kiali_internal.kubernetes_client.oauth_config_timeout).
const oauthConfigConstructionTimeout = 30 * time.Second

// buildOAuthConfig discovers a cluster's OAuth server metadata and Kiali OAuthClient and
// assembles the cluster's OAuth configuration.
func buildOAuthConfig(ctx context.Context, conf *config.Config, client kubernetes.ClientInterface) (*oAuthConfig, error) {
	// Use CA info from kube config.
	url := client.ClusterInfo().ClientConfig.Host + "/.well-known/oauth-authorization-server"
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request for fetching oauth server metadata from kube api server url [%s]. Likely the url is malformed. Error: %s", url, err)
	}
	request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.GetToken()))

	httpClient, err := httpClientWithPool(conf, *client.ClusterInfo().ClientConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create http client for fetching oauth server metadata from kube api server [%s], error: %s", url, err)
	}

	// The 10s poll interval is Kiali's own retry cadence while the overall fetch is
	// bounded by the caller's deadline (the construction or configurable build budget);
	// it stays hardcoded because only the overall budget is environment-dependent.
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

	return oAuthConfig, nil
}

// getOAuthConfig returns the cluster's OAuth configuration, building it on demand when it was
// not available at construction (a remote that was unreachable at startup becomes loginable
// once it recovers, without a Kiali restart). Concurrent callers coalesce behind one build.
func (in *OpenshiftOAuthService) getOAuthConfig(ctx context.Context, cluster string) (*oAuthConfig, error) {
	in.oAuthConfigsMutex.Lock()
	if oAuthConfig, found := in.oAuthConfigs[cluster]; found {
		in.oAuthConfigsMutex.Unlock()
		return oAuthConfig, nil
	}
	if building, buildingFound := in.oAuthConfigsBuilding[cluster]; buildingFound {
		in.oAuthConfigsMutex.Unlock()
		// Waiters can abandon the wait on their own context (a disconnected login
		// redirects away); the shared build itself stays detached - one caller's abort
		// must not poison the rebuild for the next.
		select {
		case <-building.done:
			return building.config, building.err
		case <-ctx.Done():
			return nil, fmt.Errorf("abandoned waiting for the OAuth configuration of cluster [%s]: %w", cluster, ctx.Err())
		}
	}
	building := &oAuthConfigBuild{done: make(chan struct{})}
	if in.oAuthConfigsBuilding == nil {
		in.oAuthConfigsBuilding = map[string]*oAuthConfigBuild{}
	}
	in.oAuthConfigsBuilding[cluster] = building
	in.oAuthConfigsMutex.Unlock()

	defer func() {
		in.oAuthConfigsMutex.Lock()
		delete(in.oAuthConfigsBuilding, cluster)
		in.oAuthConfigsMutex.Unlock()
		close(building.done)
	}()

	client := in.kialiSAClients[cluster]
	if client == nil {
		building.err = fmt.Errorf("could not get ServiceAccount client for cluster [%s]", cluster)
		return nil, building.err
	}

	// The same eligibility rules as the constructor (see oauthConfigIneligible): an
	// explicit request for an ineligible cluster fails fast rather than polling the
	// OpenShift metadata endpoint for the whole build deadline.
	if err := oauthConfigIneligible(in.conf, cluster, client); err != nil {
		building.err = err
		return nil, building.err
	}

	buildTimeout := in.conf.KialiInternal.KubernetesClient.OAuthConfigTimeout
	var cancel context.CancelFunc
	if buildTimeout > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), buildTimeout)
		defer cancel()
	}
	oAuthConfig, err := buildOAuthConfig(ctx, in.conf, client)
	if err != nil {
		building.err = err
		return nil, err
	}

	in.oAuthConfigsMutex.Lock()
	in.oAuthConfigs[cluster] = oAuthConfig
	in.oAuthConfigsMutex.Unlock()

	building.config = oAuthConfig
	return oAuthConfig, nil
}

// Exchange exchanges the code for a token that can be used to talk to the kube API server.
func (in *OpenshiftOAuthService) Exchange(ctx context.Context, code string, verifier string, cluster string) (*oauth2.Token, error) {
	client := in.kialiSAClients[cluster]
	if client == nil {
		return nil, fmt.Errorf("could not get ServiceAccount client for cluster [%s]", cluster)
	}

	httpClient, err := httpClientWithPool(in.conf, *client.ClusterInfo().ClientConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create http client for oauth consumption, error: %s", err)
	}

	oAuthConfig, err := in.getOAuthConfig(ctx, cluster)
	if err != nil {
		return nil, fmt.Errorf("could not get OAuth config for cluster [%s]: %v", cluster, err)
	}

	ctx = context.WithValue(ctx, oauth2.HTTPClient, httpClient)
	tok, err := oAuthConfig.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return nil, fmt.Errorf("could not exchange the code for a token: %v", err)
	}

	return tok, nil
}

// AuthCodeURL returns the URL to redirect the user to for authentication.
func (in *OpenshiftOAuthService) AuthCodeURL(ctx context.Context, verifier string, cluster string) (string, error) {
	oAuthConfig, err := in.getOAuthConfig(ctx, cluster)
	if err != nil {
		return "", fmt.Errorf("could not get OAuth config for cluster [%s]: %v", cluster, err)
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
	log.Debugf("Logging out by deleting OAuth access token [%v]", oauthTokenName)

	// Delete the access token from the API server using OpenShift 4.6+ access token name
	kialiSAClient := in.kialiSAClients[cluster]
	if kialiSAClient == nil {
		return fmt.Errorf("could not get ServiceAccount client for cluster [%s]", cluster)
	}

	err := kialiSAClient.DeleteOAuthToken(ctx, oauthTokenName)
	if k8s_errors.IsNotFound(err) {
		log.Debugf("OAuth access token [%v] already deleted; treating logout as successful", oauthTokenName)
		return nil
	}
	return err
}

func (in *OpenshiftOAuthService) OAuthConfig(ctx context.Context, cluster string) (*OAuthConfig, error) {
	oAuthConfig, err := in.getOAuthConfig(ctx, cluster)
	if err != nil {
		return nil, fmt.Errorf("OAuth config does not exist for cluster [%s]: %v", cluster, err)
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
