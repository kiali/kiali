package handlers_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util/certtest"
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

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace(config.IstioNamespaceDefault),
			// Ideally we wouldn't need to set all this stuff up here but there's not a good way
			// mock out the business.IstioStatus service since it's a struct.
			&appsv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istiod",
					Namespace: config.IstioNamespaceDefault,
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
					Namespace: config.IstioNamespaceDefault,
					Labels:    map[string]string{"istio.io/rev": "default"},
				},
				Data: map[string]string{"mesh": ""},
			},
			certtest.FakeIstioCertificateConfigMap(config.IstioNamespaceDefault),
		),
	}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	grafana := grafana.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
	persesSvc := perses.NewService(conf, clients[conf.KubernetesConfig.ClusterName])

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)
	prom.Inject(xapi)

	// Add mock expectation for Buildinfo to fix the test
	xapi.On("Buildinfo", mock.AnythingOfType("*context.valueCtx")).Return(prom_v1.BuildinfoResult{
		Version:   "2.35.0",
		BuildDate: "2023-01-01T00:00:00Z",
		Revision:  "abcdef123456",
	}, nil)

	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return nil }

	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	handler := handlers.MeshGraph(conf, cf, cache, grafana, persesSvc, prom, traceLoader, discovery, cpm)
	server := httptest.NewServer(handlers.WithAuthInfo(authInfo, handler))
	t.Cleanup(server.Close)

	resp, err := http.Get(server.URL + "/api/mesh/graph")
	require.NoError(err)
	checkStatus(t, http.StatusOK, resp)
}

func TestControlPlanes(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	clients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{
			{
				Cluster:         &models.KubeCluster{Name: "east"},
				ManagedClusters: []*models.KubeCluster{{Name: "east"}},
			},
		},
	}
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: mesh,
	}

	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	handler := handlers.WithAuthInfo(authInfo, handlers.ControlPlanes(cache, cf, conf, discovery))
	r := httptest.NewRequest("GET", "/api/mesh/controlplanes", nil)
	w := httptest.NewRecorder()

	handler(w, r)

	resp := w.Result()
	body, err := io.ReadAll(resp.Body)
	require.NoError(err)
	require.Equal(200, resp.StatusCode)

	var controlPlaneResponse []models.ControlPlane
	require.NoError(json.Unmarshal(body, &controlPlaneResponse))

	require.Len(controlPlaneResponse, 1)
}

func TestControlPlanesUnauthorized(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	clients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{
			{
				Cluster:         &models.KubeCluster{Name: "east"},
				ManagedClusters: []*models.KubeCluster{{Name: "east"}},
			},
		},
	}
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: mesh,
	}

	handler := handlers.ControlPlanes(cache, cf, conf, discovery)
	r := httptest.NewRequest("GET", "/api/mesh/controlplanes", nil)
	w := httptest.NewRecorder()

	handler(w, r)

	resp := w.Result()
	require.Equal(500, resp.StatusCode)
}
