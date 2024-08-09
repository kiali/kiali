package handlers_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
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
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
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
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	kubernetes.SetConfig(t, *conf)

	clients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace(conf.IstioNamespace),
			// Ideally we wouldn't need to set all this stuff up here but there's not a good way
			// mock out the business.IstioStatus service since it's a struct.
			&appsv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istiod",
					Namespace: conf.IstioNamespace,
					Labels: map[string]string{
						"app":          "istiod",
						"istio.io/rev": "default",
					},
				},
				Spec: appsv1.DeploymentSpec{
					Template: corev1.PodTemplateSpec{
						ObjectMeta: metav1.ObjectMeta{
							Labels: map[string]string{"app": "istiod", "istio.io/rev": "default"},
						},
					},
				},
			},
			&corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio",
					Namespace: conf.IstioNamespace,
					Labels:    map[string]string{"istio.io/rev": "default"},
				},
				Data: map[string]string{"mesh": ""},
			},
		),
	}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	grafana := grafana.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	discovery := istio.NewDiscovery(clients, cache, conf)
	business.SetupBusinessLayer(t, clients[conf.KubernetesConfig.ClusterName], *conf)
	business.WithKialiCache(cache)
	business.WithDiscovery(discovery)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient()
	require.NoError(err)
	prom.Inject(xapi)
	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return nil }

	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	handler := handlers.MeshGraph(conf, cf, cache, grafana, prom, traceLoader, discovery, cpm)
	server := httptest.NewServer(handlers.WithAuthInfo(authInfo, handler))
	t.Cleanup(server.Close)

	resp, err := http.Get(server.URL + "/api/mesh/graph")
	require.NoError(err)
	checkStatus(t, http.StatusOK, resp)
}
