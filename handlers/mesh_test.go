package handlers_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// Fails if resp status is non-200
func checkStatus(t *testing.T, expectedCode int, resp *http.Response) {
	if resp.StatusCode != expectedCode {
		// Attempt to read body to get more info.
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Logf("Unable to read response body: %s", err)
		}
		t.Fatalf("Expected status code 200, got %d. Body: %s", resp.StatusCode, string(body))
	}
}

func TestGetMeshGraph(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	kubernetes.SetConfig(t, *conf)

	clients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: conf.IstioNamespace}},
		),
	}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	grafana := grafana.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	discovery := istio.NewDiscovery(clients, cache, conf)
	business.SetupBusinessLayer(t, clients[conf.KubernetesConfig.ClusterName], *conf)
	business.WithKialiCache(cache)
	business.WithDiscovery(discovery)

	authInfo := &api.AuthInfo{Token: "test"}
	handler := handlers.MeshGraph(conf, cf, cache, grafana, discovery)
	server := httptest.NewServer(handlers.WithAuthInfo(authInfo, handler))
	t.Cleanup(server.Close)

	resp, err := http.Get(server.URL + "/api/mesh/graph")
	require.NoError(err)
	checkStatus(t, http.StatusOK, resp)
}
