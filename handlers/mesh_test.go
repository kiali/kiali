package handlers_test

import (
	"encoding/json"
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
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
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

func FakeCertificateConfigMap(namespace string) *corev1.ConfigMap {
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "istio-ca-root-cert",
			Namespace: namespace,
		},
		Data: map[string]string{
			"root-cert.pem": `-----BEGIN CERTIFICATE-----
MIIC/DCCAeSgAwIBAgIQVv6mINjF1kQJS2O98zkkNzANBgkqhkiG9w0BAQsFADAY
MRYwFAYDVQQKEw1jbHVzdGVyLmxvY2FsMB4XDTIxMDcyNzE0MzcwMFoXDTMxMDcy
NTE0MzcwMFowGDEWMBQGA1UEChMNY2x1c3Rlci5sb2NhbDCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAMwHN+LAkWbC9qyAlXQ4Zwn+Yhgc4eCPuw9LQVjW
b9al44H5sV/1QIog8wOjDHx32k2lTXvdxRgOJd+ENXMQ9DmU6C9oeWhMZAmAvp4M
NBaYnY4BRcWAPqIhEb/26zRA9pXjPVJX+aN45R1EJWsJxP6ZPkmZZKILnYY6VwqU
wbbB3lp34HQruvkpePUo4Bux+N+DfQsu1g/C6UMbQlY/kl1d1KaTS4bYQAP1d4eT
sPxw5Rf9WRSQcGaAWiPbUxVBtA0LYCbHzOacAAwvYhJgvbinr73RiqKUMR5BV/p3
lyKyVDyrVXXbVNsQhsT/lM5e55DaQEJKyldgklSGseVYHy0CAwEAAaNCMEAwDgYD
VR0PAQH/BAQDAgIEMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFK7ZOPXlxd78
xUpOGYDaqgC/sdevMA0GCSqGSIb3DQEBCwUAA4IBAQACLa2gNuIxQWf4qiCxsbIj
qddqbjHBGOWVAcyFRk/k7ydmellkI5BcMJEhlPT7TBUutcjvX8lCsup+xGy47NpH
hRp4hxUYodGXLXQ2HfI+3CgAARBEIBXjh/73UDFcMtH/G6EtGfFEw8ZgbyaDQ9Ft
c10h5QnbMUBFWdmvwSFvbJwZoTlFM+skogwv+d55sujZS83jbZHs7lZlDy0hDYIm
tMAWt4FEJnLPrfFtCFJgddiXDYGtX/Apvqac2riSAFg8mQB5WRtxKH7TK9Qhvca7
V/InYncUvcXt0M4JJSUJi/u6VBKSYYDIHt3mk9Le2qlMQuHkOQ1ZcuEOM2CU/KtO
-----END CERTIFICATE-----`,
		},
	}
}

func TestGetMeshGraph(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	kubernetes.SetConfig(t, *conf)

	clients := map[string]kubernetes.UserClientInterface{
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
			FakeCertificateConfigMap(conf.IstioNamespace),
		),
	}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	grafana := grafana.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
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
