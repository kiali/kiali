package business_test

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

func TestNewOpenshiftOAuthService(t *testing.T) {
	metadataServer := fakeOAuthMetadataServer(t)

	conf := config.NewConfig()
	testCases := map[string]struct {
		oAuthClient *osoauth_v1.OAuthClient
		expectErr   bool
	}{
		"Normal OAuth server response returns sucessfully": {
			oAuthClient: &osoauth_v1.OAuthClient{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "kiali-istio-system",
				},
				RedirectURIs: []string{"http://localhost:20001/kiali"},
			},
			expectErr: false,
		},
		"OAuthClient without redir uris returns error": {
			oAuthClient: &osoauth_v1.OAuthClient{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "kiali-istio-system",
				},
			},
			expectErr: true,
		},
	}
	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			client := kubetest.NewFakeK8sClient(tc.oAuthClient)
			client.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
			client.OpenShift = true
			clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: client}
			clientFactory := kubetest.NewFakeClientFactory(conf, clients)

			_, err := business.NewOpenshiftOAuthService(context.TODO(), conf, clients, clientFactory)
			if tc.expectErr {
				require.Error(err)
			} else {
				require.NoError(err)
			}
		})
	}
}

// See https://github.com/kiali/kiali/issues/7665.
func TestNewOAuthMixedClusters(t *testing.T) {
	require := require.New(t)
	metadataServer := fakeOAuthMetadataServer(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "openshift"

	openshift := kubetest.NewFakeK8sClient(&osoauth_v1.OAuthClient{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "kiali-istio-system",
		},
		RedirectURIs: []string{"http://localhost:20001/kiali"},
	})
	openshift.OpenShift = true
	vanilla := kubetest.NewFakeK8sClient()
	clients := map[string]kubernetes.ClientInterface{
		"openshift": openshift,
		"vanilla":   vanilla,
	}

	openshift.KubeClusterInfo.ClientConfig = &rest.Config{Host: metadataServer.URL}
	clientFactory := kubetest.NewFakeClientFactory(conf, clients)

	_, err := business.NewOpenshiftOAuthService(context.TODO(), conf, clients, clientFactory)
	require.NoError(err)
}
