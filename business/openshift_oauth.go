package business

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type OpenshiftOAuthService struct {
	k8s kubernetes.ClientInterface
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

const serverPrefix = "https://kubernetes.default.svc/"

const defaultRequestTimeout = 10 * time.Second

var kialiNamespace string

func (in *OpenshiftOAuthService) Metadata() (metadata *OAuthMetadata, err error) {
	// this is the prefix of the OAuthClient name as well as the Route name
	clientIdPrefix := config.Get().Auth.OpenShift.ClientIdPrefix

	redirectURL, err := getKialiRoutePath(clientIdPrefix)

	if err != nil {
		log.Error(err)
		message := fmt.Errorf("could not get Kiali route for OAuth redirect: %v", err)
		return nil, message
	}

	server, err := getOAuthAuthorizationServer()
	if err != nil {
		return nil, err
	}

	version, err := in.k8s.GetServerVersion()
	if err != nil {
		return nil, err
	}

	metadata = &OAuthMetadata{}

	namespace, err := getKialiNamespace()
	if err != nil {
		return nil, err
	}

	if version.Major == "1" && (strings.HasPrefix(version.Minor, "11") || strings.HasPrefix(version.Minor, "10")) {
		metadata.AuthorizationEndpoint = fmt.Sprintf("%s?client_id=%s&redirect_uri=%s&response_type=%s", server.AuthorizationEndpoint, clientIdPrefix+"-"+namespace, url.QueryEscape(*redirectURL), "token")
	} else {
		// The logout endpoint on the OpenShift OAuth Server
		metadata.LogoutEndpoint = fmt.Sprintf("%s/logout", server.Issuer)
		// The redirect path when logging out of the OpenShift OAuth Server. Note: this has to be a relative link to the OAuth server
		metadata.LogoutRedirect = fmt.Sprintf("/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=%s", clientIdPrefix+"-"+namespace, url.QueryEscape(*redirectURL), "token")
		// The fully qualified endpoint to use logging into the OpenShift OAuth server.
		metadata.AuthorizationEndpoint = fmt.Sprintf("%s%s", server.Issuer, metadata.LogoutRedirect)
	}
	return metadata, nil
}

func getOAuthAuthorizationServer() (*OAuthAuthorizationServer, error) {
	var server *OAuthAuthorizationServer

	response, err := request("GET", ".well-known/oauth-authorization-server", nil)

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

	response, err := request("GET", "apis/user.openshift.io/v1/users/~", &token)

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
		namespace, err := ioutil.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
		if err != nil {
			return "", err
		}
		kialiNamespace = string(namespace)
	}
	return kialiNamespace, nil
}

func getKialiRoutePath(routeName string) (*string, error) {
	var route *OAuthRoute
	var protocol string

	namespace, err := getKialiNamespace()
	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("cannot read Kiali's Namespace: %v", err)
	}

	conf, err := kubernetes.ConfigClient()
	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("could not get openshift config client: %v", err)
	}

	response, err := request("GET", fmt.Sprintf("apis/route.openshift.io/v1/namespaces/%v/routes/%s", namespace, routeName), &conf.BearerToken)
	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("could not connect to Openshift: %v", err)
	}

	err = json.Unmarshal(response, &route)
	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("cannot parse Kiali route: %v", err)
	}

	if route.Spec.TLS == nil {
		protocol = "http://"
	} else {
		protocol = "https://"
	}

	url := strings.Join([]string{protocol, route.Spec.Host}, "")

	return &url, nil
}

func (in *OpenshiftOAuthService) Logout(token string) error {
	conf, err := kubernetes.ConfigClient()

	if err != nil {
		log.Error(err)
		return fmt.Errorf("could not connect to Openshift: %v", err)
	}

	// https://github.com/kiali/kiali/issues/3595
	// OpenShift 4.6+ changed the format of the OAuthAccessToken.
	// In pre-4.6, the access_token given to the client is the same name as the OAuthAccessToken resource.
	// In 4.6+, that is not true anymore - you have to encode the access_token to obtain the OAuthAccessToken resource name.
	// The code below will attempt to delete the access token using the new 4.6+ format.
	// If this first delete attempt fails, an attempt will immediately be made to delete using the old pre-4.6 name.
	// This will allow for supporting running Kiali in pre-4.6 OpenShift.

	// convert the access token to the corresponding oauthaccesstoken resource name
	// see: https://github.com/openshift/console/blob/9f352ba49f82ad693a72d0d35709961428b43b93/pkg/server/server.go#L609-L613
	sha256Prefix := "sha256~"
	h := sha256.Sum256([]byte(strings.TrimPrefix(token, sha256Prefix)))
	oauthTokenName := sha256Prefix + base64.RawURLEncoding.EncodeToString(h[0:])
	log.Debugf("Logging out by deleting OAuth access token [%v] which was converted from access token [%v]", oauthTokenName, token)

	// Delete the access token from the API server using OpenShift 4.6+ access token name
	_, err = request("DELETE", fmt.Sprintf("apis/oauth.openshift.io/v1/oauthaccesstokens/%v", oauthTokenName), &conf.BearerToken)

	if err != nil {
		// Try to delete the access token from the API server using the pre-4.6 access token name.
		// If this also fails, we'll send back the err from the first attempt.
		// If this succeeds, set err to nil to indicate a successful logout.
		_, err2 := request("DELETE", fmt.Sprintf("apis/oauth.openshift.io/v1/oauthaccesstokens/%v", token), &conf.BearerToken)
		if err2 == nil {
			err = nil
		}
	}

	if err != nil {
		return err
	}

	return nil
}

func request(method string, url string, auth *string) ([]byte, error) {
	return requestWithTimeout(method, url, auth, time.Duration(defaultRequestTimeout))
}

func requestWithTimeout(method string, url string, auth *string, timeout time.Duration) ([]byte, error) {
	certPool := x509.NewCertPool()
	cert, err := ioutil.ReadFile("/run/secrets/kubernetes.io/serviceaccount/ca.crt")

	if err != nil {
		return nil, fmt.Errorf("failed to get root CA certificates: %s", err)
	}

	certPool.AppendCertsFromPEM(cert)

	tlsConfig := &tls.Config{RootCAs: certPool}

	client := &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		}}

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

	body, err := ioutil.ReadAll(response.Body)

	if err != nil {
		return nil, fmt.Errorf("Failed to read response body for api endpoint [%s] for oauth consumption, error: %s", url, err)
	}

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Failed to get OK status from api endpoint [%s] for oauth consumption, error: %s", url, string(body))
	}

	return body, nil
}
