package business

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	kube "k8s.io/client-go/kubernetes"
)

type OpenshiftOAuthService struct {
	k8s kubernetes.IstioClientInterface
}

type OAuthMetadata struct {
	AuthorizationEndpoint string `json:"authorizationEndpoint"`
	TokenEndpoint         string `json:"tokenEndpoint"`
}

type MetadataResponse struct {
	Issuer                        string   `json:"issuer"`
	AuthorizationEndpoint         string   `json:"authorization_endpoint"`
	TokenEndpoint                 string   `json:"token_endpoint"`
	ScopesSupported               []string `json:"scopes_supported"`
	ResponseTypesSupported        []string `json:"response_types_supported"`
	GrantTypesSupported           []string `json:"grant_types_supported"`
	CodeChallengeMethodsSupported []string `json:"code_challenge_methods_supported"`
}

const authServerUrl = "https://openshift.default.svc/.well-known/oauth-authorization-server"

func (in *OpenshiftOAuthService) Metadata() (metadata *OAuthMetadata, err error) {
	var response *MetadataResponse

	resp, err := httpClient().Get(authServerUrl)

	if err != nil {
		message := fmt.Errorf("could not get data for the openshift authorization server: %v", err)
		fmt.Println(message)

		return nil, message
	}

	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)

	if err != nil {
		message := fmt.Errorf("could not read body for the openshift authorization server: %v", err)
		fmt.Println(message)

		return nil, message
	}

	if err := json.Unmarshal([]byte(body), &response); err != nil {
		message := fmt.Errorf("could not parse response the openshift authorization server: %v", err)
		fmt.Println(message)

		return nil, message
	}

	routeClient, err := kubernetes.NewOSRouteClient()

	if err != nil {
		message := fmt.Errorf("could not create route client for oauth endpoint: %v", err)
		fmt.Println(message)

		return nil, message
	}

	route, err := routeClient.GetRoute(config.Get().IstioNamespace, "kiali")

	if err != nil {
		message := fmt.Errorf("could not create route client for oauth endpoint: %v", err)
		fmt.Println(message)

		return nil, message
	}

	metadata = &OAuthMetadata{}
	metadata.AuthorizationEndpoint = fmt.Sprintf("%s?client_id=%s&redirect_uri=%s&response_type=%s", response.AuthorizationEndpoint, "kiali", route, "token")
	metadata.TokenEndpoint = response.TokenEndpoint

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
		return fmt.Errorf("could not connect to Openshift: %v", err)
	}

	_, err = k8s.Discovery().ServerVersion()

	if err != nil {
		return fmt.Errorf("could not get info from Openshift: %v", err)
	}

	return nil
}

// We create a new client, and avoid checking the certificates, since this is
// intra-cluster communication. This is necessary because not necessarily the
// server certificates are going to be available for Kiali.
func httpClient() (client *http.Client) {
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	client = &http.Client{Transport: tr}

	return
}
