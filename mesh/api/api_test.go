package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"sort"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/tests/data"
)

// Setup mock
func setupMocks(t *testing.T) *mesh.GlobalInfo {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "cluster-primary"
	conf.ExternalServices.Tracing.Enabled = true
	config.Set(conf)

	istiodDeployment := apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				config.IstioRevisionLabel: "default",
			},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				Spec: core_v1.PodSpec{
					Containers: []core_v1.Container{
						{
							Name: "discovery",
							Env: []core_v1.EnvVar{
								{
									Name:  "CLUSTER_ID",
									Value: conf.KubernetesConfig.ClusterName,
								},
								{
									Name:  "EXTERNAL_ISTIOD",
									Value: "true",
								},
							},
						},
					},
				},
			},
		},
	}

	sidecarConfigMap := core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-sidecar-injector",
			Namespace: "istio-system",
		},
		Data: map[string]string{
			"values": "{ \"global\": { \"network\": \"kialiNetwork\" } }",
		},
	}

	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels: map[string]string{
				config.IstioRevisionLabel: "default",
			},
		},
		Data: map[string]string{"mesh": configMapData},
	}

	certificatesConfigMap := core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-ca-root-cert",
			Namespace: "istio-system",
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

	kialiSvc := core_v1.Service{
		ObjectMeta: v1.ObjectMeta{
			Name:      "kiali",
			Namespace: "istio-system",
			Labels:    map[string]string{"app.kubernetes.io/part-of": "kiali"},
		},
	}

	gwObject := data.CreateEmptyGateway("gateway", "istio-system", map[string]string{
		"istio": "ingressgateway",
	})

	wpObject := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "waypoint",
			Namespace: "data-plane-1",
			Labels: map[string]string{
				config.WaypointLabel: config.WaypointLabelValue,
				config.GatewayLabel:  "waypoint",
			},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Labels: map[string]string{
						config.WaypointLabel: config.WaypointLabelValue,
						config.GatewayLabel:  "waypoint",
					},
				},
			},
		},
	}

	ztunnelObject := &apps_v1.DaemonSet{
		TypeMeta: v1.TypeMeta{
			APIVersion: kubernetes.DaemonSets.GroupVersion().String(),
			Kind:       kubernetes.DaemonSets.Kind,
		},
		ObjectMeta: v1.ObjectMeta{
			Name:              "ztunnel",
			Namespace:         "istio-system",
			CreationTimestamp: v1.NewTime(time.Now()),
		},
		Spec: apps_v1.DaemonSetSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Labels: map[string]string{"app": "ztunnel"},
				},
			},
			Selector: &v1.LabelSelector{
				MatchLabels: map[string]string{"app": "ztunnel"},
			},
		},
		Status: apps_v1.DaemonSetStatus{
			DesiredNumberScheduled: 1,
			CurrentNumberScheduled: 1,
			NumberAvailable:        1,
		},
	}

	defaultInjection := map[string]string{models.IstioInjectionLabel: models.IstioInjectionEnabledLabelValue}
	revLabel := map[string]string{config.IstioRevisionLabel: "default"}
	primaryClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespaceWithLabels("data-plane-1", defaultInjection),
		kubetest.FakeNamespaceWithLabels("data-plane-2", revLabel),
		&certificatesConfigMap,
		&istiodDeployment,
		&istioConfigMap,
		&sidecarConfigMap,
		&kialiSvc,
		gwObject,
		wpObject,
		ztunnelObject,
	)
	primaryClient.KubeClusterInfo = kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{
			Host: "http://127.0.0.2:9443",
		},
	}
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: conf.KubernetesConfig.ClusterName},
			Labels:      map[string]string{"kubernetes.io/metadata.name": "istio-system"},
		}},
		kubetest.FakeNamespaceWithLabels("data-plane-3", defaultInjection),
		kubetest.FakeNamespaceWithLabels("data-plane-4", revLabel),
	)
	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: primaryClient,
		"cluster-remote":                  remoteClient,
	}
	factory := kubetest.NewK8SClientFactoryMock(nil)
	factory.SetClients(clients)

	cache := cache.NewTestingCacheWithFactory(t, factory, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
	business.WithDiscovery(discovery)
	business.WithKialiCache(cache)
	business.SetWithBackends(factory, nil)
	layer := business.NewWithBackends(clients, kubernetes.ConvertFromUserClients(clients), nil, nil)

	meshDef, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(meshDef.ControlPlanes, 1)
	require.Len(meshDef.ControlPlanes[0].ManagedClusters, 2)

	a, err := discovery.Clusters()
	sort.Slice(a, func(i, j int) bool {
		return a[i].Name < a[j].Name
	})
	require.Nil(err, "GetClusters returned error: %v", err)

	require.NotNil(a, "GetClusters returned nil")
	require.Len(a, 2, "GetClusters didn't resolve the Primnary and Remote clusters")
	assert.Equal("cluster-primary", a[0].Name, "Unexpected primary cluster name")
	assert.Equal("cluster-remote", a[1].Name, "Unexpected remote cluster name")
	assert.True(a[0].IsKialiHome, "Kiali cluster not properly marked as such")
	assert.Equal("http://127.0.0.2:9443", a[0].ApiEndpoint)
	// assert.Equal("kialiNetwork", a[0].Network)

	require.Len(a[0].KialiInstances, 1, "GetClusters didn't resolve the local Kiali instance")
	assert.Equal("istio-system", a[0].KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")

	globalInfo := mesh.NewGlobalInfo()
	globalInfo.Business = layer
	globalInfo.Conf = conf
	globalInfo.Discovery = discovery
	globalInfo.KialiCache = cache

	return globalInfo
}

// mockMeshGraph provides a common single-cluster mock
func mockMeshGraph(t *testing.T) (*mesh.GlobalInfo, error) {
	globalInfo := setupMocks(t)

	mesh.StatusGetter = func(context.Context, *config.Config, kubernetes.ClientFactory, cache.KialiCache, *grafana.Service) status.StatusInfo {
		return status.StatusInfo{
			ExternalServices: []models.ExternalServiceInfo{},
		}
	}

	return globalInfo, nil
}

type fakeMeshStatusGetter struct{}

// mock GetStatus function to obtain fake graph component status
func (f *fakeMeshStatusGetter) GetStatus(ctx context.Context) (kubernetes.IstioComponentStatus, error) {
	cluster := config.Get().KubernetesConfig.ClusterName
	return kubernetes.IstioComponentStatus{
		kubernetes.ComponentStatus{
			Name:    "istiod",
			Cluster: cluster,
			Status:  kubernetes.ComponentHealthy,
			IsCore:  true,
		},
		kubernetes.ComponentStatus{
			Name:    "prometheus",
			Cluster: cluster,
			Status:  kubernetes.ComponentHealthy,
			IsCore:  false,
		},
		kubernetes.ComponentStatus{
			Name:    "grafana",
			Cluster: cluster,
			Status:  kubernetes.ComponentHealthy,
			IsCore:  false,
		},
		kubernetes.ComponentStatus{
			Name:    "tracing",
			Cluster: cluster,
			Status:  kubernetes.ComponentHealthy,
			IsCore:  false,
		},
	}, nil
}

func respond(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		response = []byte(err.Error())
		code = http.StatusInternalServerError
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(response)
}

func TestMeshGraph(t *testing.T) {
	globalInfo, err := mockMeshGraph(t)
	if err != nil {
		t.Error(err)
		return
	}

	globalInfo.IstioStatusGetter = &fakeMeshStatusGetter{}

	mr := mux.NewRouter()
	mr.HandleFunc("/api/mesh/graph", func(w http.ResponseWriter, r *http.Request) {
		code, config := graphMesh(r.Context(), globalInfo, mesh.NewOptions(r, &globalInfo.Business.Namespace))
		respond(w, code, config)
	})

	ts := httptest.NewServer(mr)
	defer ts.Close()

	url := ts.URL + "/api/mesh/graph?queryTime=1523364075&includeGateways=true&includeWaypoints=true"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)
	t.Logf("Actual response body: %s", string(actual)) // Print the actual variable
	expectedFilename := "testdata/test_mesh_graph.expected"
	expected, _ := os.ReadFile(expectedFilename)

	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}

	if !assert.JSONEq(t, string(expected), string(actual)) {
		// The diff is more readable using cmp
		t.Logf("%s", cmp.Diff(string(expected), string(actual)))
		// The dump is more useful for updating the .expected file
		// t.Logf("%s", string(actual))
	}
	assert.Equal(t, 200, resp.StatusCode)
}
