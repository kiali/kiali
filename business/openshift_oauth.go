package business

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

func NewOpenshiftOAuthService(conf *config.Config, kialiSAClient kubernetes.ClientInterface) OpenshiftOAuthService {
	return OpenshiftOAuthService{
		conf:          conf,
		kialiSAClient: kialiSAClient,
	}
}

type OpenshiftOAuthService struct {
	// TODO: Support multi-cluster
	conf          *config.Config
	kialiSAClient kubernetes.ClientInterface
}

type OAuthMetadata struct {
	AuthorizationEndpoint string `json:"authorizationEndpoint"`
	LogoutEndpoint        string `json:"logoutEndpoint"`
	LogoutRedirect        string `json:"logoutRedirect"`
}

// Structure that's returned by the openshift oauth authorization server.
// It defaults to following the snake_case format, so we parse it to something
// more usable on our side.
type OAuthAuthorizationServer struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	Issuer                string `json:"issuer"`
}

type OAuthUser struct {
	Metadata OAuthUserMetadata `json:"metadata"`
}

type OAuthUserMetadata struct {
	Name string `json:"name"`
}

type OAuthRoute struct {
	Spec OAuthRouteSpec `json:"spec"`
}

type OAuthRouteSpec struct {
	Host string             `json:"host"`
	TLS  *OAuthRouteTLSSpec `json:"tls,omitempty"`
}

type OAuthRouteTLSSpec struct {
	Termination string `json:"termination"`
}

var defaultAuthRequestTimeout = 0 * time.Second // will be determined by config first time it is needed

var kialiNamespace string

func (in *OpenshiftOAuthService) Metadata(r *http.Request) (metadata *OAuthMetadata, err error) {
	config := in.conf.Auth.OpenShift

	redirectURL := httputil.GuessKialiURL(in.conf, r)

	server, err := getOAuthAuthorizationServer(config)
	if err != nil {
		return nil, err
	}

	version, err := in.kialiSAClient.GetServerVersion()
	if err != nil {
		return nil, err
	}

	metadata = &OAuthMetadata{}

	var clientId string

	if config.ClientId == "" {
		namespace, err := getKialiNamespace()
		if err != nil {
			return nil, err
		}
		clientId = config.ClientIdPrefix + "-" + namespace
	} else {
		clientId = config.ClientId
	}

	if version.Major == "1" && (strings.HasPrefix(version.Minor, "11") || strings.HasPrefix(version.Minor, "10")) {
		metadata.AuthorizationEndpoint = fmt.Sprintf("%s?client_id=%s&redirect_uri=%s&response_type=%s", server.AuthorizationEndpoint, clientId, url.QueryEscape(redirectURL), "token")
	} else {
		// The logout endpoint on the OpenShift OAuth Server
		metadata.LogoutEndpoint = fmt.Sprintf("%s/logout", server.Issuer)
		// The redirect path when logging out of the OpenShift OAuth Server. Note: this has to be a relative link to the OAuth server
		metadata.LogoutRedirect = fmt.Sprintf("/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=%s", clientId, url.QueryEscape(redirectURL), "token")
		// The fully qualified endpoint to use logging into the OpenShift OAuth server.
		metadata.AuthorizationEndpoint = fmt.Sprintf("%s%s", server.Issuer, metadata.LogoutRedirect)
	}
	return metadata, nil
}

func getOAuthAuthorizationServer(config config.OpenShiftConfig) (*OAuthAuthorizationServer, error) {
	var server *OAuthAuthorizationServer

	response, err := request("GET", config.ServerPrefix, ".well-known/oauth-authorization-server", nil, config.UseSystemCA, config.CustomCA, config.AuthTimeout)
	if err != nil {
		log.Error(err)
		message := fmt.Errorf("could not get OAuthAuthorizationServer: %v", err)
		return nil, message
	}

	err = json.Unmarshal(response, &server)
	if err != nil {
		log.Error(err)
		message := fmt.Errorf("could not parse OAuthAuthorizationServer: %v", err)
		return nil, message
	}

	return server, nil
}

func (in *OpenshiftOAuthService) GetUserInfo(token string) (*OAuthUser, error) {
	var user *OAuthUser
	config := in.conf.Auth.OpenShift

	response, err := request("GET", config.ServerPrefix, "apis/user.openshift.io/v1/users/~", &token, config.UseSystemCA, config.CustomCA, config.AuthTimeout)
	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("could not get user info from Openshift: %v", err)
	}

	err = json.Unmarshal(response, &user)
	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("could not parse user info from Openshift: %v", err)
	}

	return user, nil
}

func getKialiNamespace() (string, error) {
	if kialiNamespace == "" {
		namespace, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
		if err != nil {
			return "", err
		}
		kialiNamespace = string(namespace)
	}
	return kialiNamespace, nil
}

func (in *OpenshiftOAuthService) Logout(token string) error {
	config := in.conf.Auth.OpenShift

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
	adminToken := in.kialiSAClient.GetToken()
	_, err := request("DELETE", config.ServerPrefix, fmt.Sprintf("apis/oauth.openshift.io/v1/oauthaccesstokens/%v", oauthTokenName), &adminToken, config.UseSystemCA, config.CustomCA, config.AuthTimeout)
	if err != nil {
		return err
	}

	return nil
}

func request(method string, serverPrefix string, url string, auth *string, useSystemCA bool, customCA string, timeoutInSeconds int) ([]byte, error) {
	if defaultAuthRequestTimeout == (0 * time.Second) {
		defaultAuthRequestTimeout = time.Duration(timeoutInSeconds) * time.Second
		log.Tracef("OpenShift auth timeout is set to [%v]", defaultAuthRequestTimeout)
	}
	return requestWithTimeout(method, serverPrefix, url, auth, time.Duration(defaultAuthRequestTimeout), useSystemCA, customCA)
}

func requestWithTimeout(method string, serverPrefix string, url string, auth *string, timeout time.Duration, useSystemCA bool, customCA string) ([]byte, error) {
	var tlsConfig tls.Config

	if customCA != "" {
		log.Debugf("using custom CA for Openshift OAuth [%v]", customCA)
		certPool := x509.NewCertPool()
		decodedCustomCA, err := base64.URLEncoding.DecodeString(customCA)
		if err != nil {
			return nil, fmt.Errorf("error decoding custom CA certificates: %s", err)
		}
		if !certPool.AppendCertsFromPEM(decodedCustomCA) {
			return nil, fmt.Errorf("failed to add custom CA certificates: %s", err)
		}
		tlsConfig = tls.Config{RootCAs: certPool}
	} else if !useSystemCA {
		log.Debugf("Using serviceaccount CA for Openshift OAuth")
		certPool := x509.NewCertPool()
		cert, err := os.ReadFile("/run/secrets/kubernetes.io/serviceaccount/ca.crt")
		if err != nil {
			return nil, fmt.Errorf("failed to get root CA certificates: %s", err)
		}
		certPool.AppendCertsFromPEM(cert)
		tlsConfig = tls.Config{RootCAs: certPool}
	} else {
		log.Debugf("Using system CA for Openshift OAuth")
	}

	client := &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			TLSClientConfig: &tlsConfig,
		},
	}

	defer client.CloseIdleConnections()

	request, err := http.NewRequest(method, strings.Join([]string{serverPrefix, url}, ""), nil)
	if err != nil {
		return nil, fmt.Errorf("Failed to create request for api endpoint [%s] for oauth consumption, error: %s", url, err)
	}

	if auth != nil {
		request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", *auth))
	}

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("Failed to get response for api endpoint [%s] for oauth consumption, error: %s", url, err)
	}

	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("Failed to read response body for api endpoint [%s] for oauth consumption, error: %s", url, err)
	}

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Failed to get OK status from api endpoint [%s] for oauth consumption, error: %s", url, string(body))
	}

	return body, nil
}
