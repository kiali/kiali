package authentication_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	osoauth_v1 "github.com/openshift/api/oauth/v1"
	"github.com/stretchr/testify/require"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func fakeOAuthMetadataServer(t *testing.T) *httptest.Server {
	t.Helper()
	// This is known after we create the server.
	// Probably another way of doing this but this works too.
	addr := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		oAuthResponse := &business.OAuthAuthorizationServer{
			AuthorizationEndpoint: addr + "/oauth/authorize",
			Issuer:                addr,
			TokenEndpoint:         addr + "/oauth/token",
		}
		b, err := json.Marshal(oAuthResponse)
		if err != nil {
			panic("unable to marshal json response for fake oAuthMetadataServer")
		}
		_, _ = w.Write(b)
	}))
	addr = server.URL
	t.Cleanup(server.Close)
	return server
}

func TestNewOpenshiftAuthService(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	oAuthClient := &osoauth_v1.OAuthClient{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "kiali-istio-system",
		},
		RedirectURIs: []string{"http://localhost:20001/kiali"},
	}

	metadataServer := fakeOAuthMetadataServer(t)
	persistor := authentication.NewCookieSessionPersistor(conf)
	client := kubetest.NewFakeK8sClient(oAuthClient)
	client.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: client}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	oAuthService, err := business.NewOpenshiftOAuthService(context.TODO(), conf, clients, clientFactory)
	require.NoError(err)

	_, err = authentication.NewOpenshiftAuthController(persistor, oAuthService, conf)
	require.NoError(err)
}
