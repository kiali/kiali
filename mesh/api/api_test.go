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

	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
)

// Setup mock
func setupMocks(t *testing.T) *mesh.AppenderGlobalInfo {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "cluster-primary"
	config.Set(conf)

	istiodDeployment := apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels:    map[string]string{"app": "istiod"},
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
		},
		Data: map[string]string{"mesh": configMapData},
	}

	kialiSvc := core_v1.Service{
		ObjectMeta: v1.ObjectMeta{
			Name:      "kiali",
			Namespace: "istio-system",
			Labels:    map[string]string{"app.kubernetes.io/part-of": "kiali"},
		},
	}

	primaryClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "data-plane-1"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "data-plane-2"}},
		&istiodDeployment,
		&istioConfigMap,
		&sidecarConfigMap,
		&kialiSvc,
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
		}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "data-plane-3"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "data-plane-4"}},
	)
	clients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: primaryClient,
		"cluster-remote":                  remoteClient,
	}
	factory := kubetest.NewK8SClientFactoryMock(nil)
	factory.SetClients(clients)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(nil)
	mockClientFactory.SetClients(clients)
	cache := cache.NewTestingCacheWithFactory(t, mockClientFactory, *conf)
	business.WithKialiCache(cache)
	business.SetWithBackends(mockClientFactory, nil)
	layer := business.NewWithBackends(clients, clients, nil, nil)
	meshSvc := layer.Mesh

	meshDef, err := meshSvc.GetMesh(context.TODO())
	require.NoError(err)
	require.Len(meshDef.ControlPlanes, 1)
	require.Len(meshDef.ControlPlanes[0].ManagedClusters, 2)

	a, err := meshSvc.GetClusters()
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
	assert.Equal("kialiNetwork", a[0].Network)

	require.Len(a[0].KialiInstances, 1, "GetClusters didn't resolve the local Kiali instance")
	assert.Equal("istio-system", a[0].KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")

	globalInfo := mesh.NewAppenderGlobalInfo()
	globalInfo.Business = layer

	return globalInfo
}

// mockMeshGraph provides a common single-cluster mock
func mockMeshGraph(t *testing.T) (*mesh.AppenderGlobalInfo, error) {
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
func (f *fakeMeshStatusGetter) GetStatus(ctx context.Context, cluster string) (kubernetes.IstioComponentStatus, error) {
	return kubernetes.IstioComponentStatus{
		kubernetes.ComponentStatus{
			Name:   "istiod",
			Status: kubernetes.ComponentHealthy,
			IsCore: true,
		},
		kubernetes.ComponentStatus{
			Name:   "prometheus",
			Status: kubernetes.ComponentHealthy,
			IsCore: false,
		},
		kubernetes.ComponentStatus{
			Name:   "grafana",
			Status: kubernetes.ComponentHealthy,
			IsCore: false,
		},
		kubernetes.ComponentStatus{
			Name:   "tracing",
			Status: kubernetes.ComponentHealthy,
			IsCore: false,
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

	globalInfo.MeshStatusGetter = &fakeMeshStatusGetter{}

	var fut func(ctx context.Context, globalInfo *mesh.AppenderGlobalInfo, o mesh.Options) (int, interface{})

	mr := mux.NewRouter()
	mr.HandleFunc("/api/mesh/graph", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := authentication.SetAuthInfoContext(r.Context(), &api.AuthInfo{Token: "test"})
			code, config := fut(context, globalInfo, mesh.NewOptions(r.WithContext(context)))
			respond(w, code, config)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphMesh
	url := ts.URL + "/api/mesh/graph?queryTime=1523364075"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)
	expected, _ := os.ReadFile("testdata/test_mesh_graph.expected")
	if runtime.GOOS == "windows" {
		expected = bytes.Replace(expected, []byte("\r\n"), []byte("\n"), -1)
	}
	expected = expected[:len(expected)-1] // remove EOF byte

	if !assert.JSONEq(t, string(expected), string(actual)) {
		// The diff is more readable using cmp
		t.Logf("%s", cmp.Diff(string(expected), string(actual)))
	}
	assert.Equal(t, 200, resp.StatusCode)
}
