package business

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"

	kube "k8s.io/client-go/kubernetes"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"

	"github.com/kiali/kiali/log"
)

type OpenshiftOAuthService struct {
	k8s kubernetes.IstioClientInterface
}

type OAuthMetadata struct {
	AuthorizationEndpoint string `json:"authorizationEndpoint"`
}

// Structure that's returned by the openshift oauth authorization server.
// It defaults to following the snake_case format, so we parse it to something
// more usable on our side.
type OAuthAuthorizationServer struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
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

func (in *OpenshiftOAuthService) Metadata() (metadata *OAuthMetadata, err error) {
	var server *OAuthAuthorizationServer

	response, err := request("GET", ".well-known/oauth-authorization-server", nil)

	if err != nil {
		log.Error(err)
		message := fmt.Errorf("Could not send request to the Openshift OAuth API: %v", err)
		return nil, message
	}

	err = json.Unmarshal(response, &server)

	if err != nil {
		log.Error(err)
		message := fmt.Errorf("Could not parse data from the Openshift API: %v", err)
		return nil, message
	}

	redirectURL, err := getKialiRoutePath()

	if err != nil {
		log.Error(err)
		message := fmt.Errorf("Could not get Kiali route for OAuth redirect: %v", err)
		return nil, message
	}

	metadata = &OAuthMetadata{}

	metadata.AuthorizationEndpoint = fmt.Sprintf("%s?client_id=%s&redirect_uri=%s&response_type=%s", server.AuthorizationEndpoint, "kiali", url.QueryEscape(*redirectURL), "token")

	return metadata, nil
}

func (in *OpenshiftOAuthService) ValidateToken(token string) error {
	k8sConfig, err := kubernetes.ConfigClient()

	if err != nil {
		return fmt.Errorf("could not connect to Openshift: %v", err)
	}

	k8sConfig.BearerToken = token

	k8s, err := kube.NewForConfig(k8sConfig)

	if err != nil {
		return fmt.Errorf("could not get Openshift cluster config: %v", err)
	}

	_, err = k8s.Discovery().ServerVersion()

	if err != nil {
		return fmt.Errorf("could not get info from Openshift: %v", err)
	}

	return nil
}

func (in *OpenshiftOAuthService) GetUserInfo(token string) (*OAuthUser, error) {
	var user *OAuthUser

	response, err := request("GET", "apis/user.openshift.io/v1/users/~", &token)

	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("Could not get user info from Openshift: %v", err)
	}

	err = json.Unmarshal(response, &user)

	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("Could not parse user info from Openshift: %v", err)
	}

	return user, nil
}

func getKialiRoutePath() (*string, error) {
	var route *OAuthRoute
	var protocol string

	namespace := config.Get().IstioNamespace

	conf, err := kubernetes.ConfigClient()

	if err != nil {
		log.Error(err)
		return nil, fmt.Errorf("could not connect to Openshift: %v", err)
	}

	response, err := request("GET", fmt.Sprintf("apis/route.openshift.io/v1/namespaces/%v/routes/kiali", namespace), &conf.BearerToken)
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

func request(method string, url string, auth *string) ([]byte, error) {
	certPool := x509.NewCertPool()
	cert, err := ioutil.ReadFile("/run/secrets/kubernetes.io/serviceaccount/ca.crt")

	if err != nil {
		return nil, fmt.Errorf("Failed to get root CA certificates: %s", err)
	}

	certPool.AppendCertsFromPEM(cert)

	tlsConfig := &tls.Config{RootCAs: certPool}

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		}}

	request, err := http.NewRequest(method, strings.Join([]string{serverPrefix, url}, ""), nil)

	if err != nil {
		return nil, fmt.Errorf("Failed to get api endpoint %s for oauth consumption, error: %s", url, err)
	}

	if auth != nil {
		request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", *auth))
	}

	response, err := client.Do(request)

	if err != nil {
		return nil, fmt.Errorf("Failed to get api endpoint %s for oauth consumption, error: %s", url, err)
	}

	defer response.Body.Close()

	body, err := ioutil.ReadAll(response.Body)

	if err != nil {
		return nil, fmt.Errorf("Failed to get api endpoint %s for oauth consumption, error: %s", url, err)
	}

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Failed to get api endpoint %s for oauth consumption, error: %s", url, string(body))
	}

	return body, nil
}
