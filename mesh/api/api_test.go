package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	api_runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/status"
)

// Setup mock
func setupMocks(t *testing.T) *mesh.AppenderGlobalInfo {
	istiodDeployment := apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels:    map[string]string{"app": "istiod"},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istiod",
					Namespace: "istio-system",
					Labels:    map[string]string{"app": "istiod"},
				},
				Spec: core_v1.PodSpec{
					Containers: []core_v1.Container{
						{
							Env: []core_v1.EnvVar{
								{
									Name:  "CLUSTER_ID",
									Value: "East",
								},
								{
									Name:  "PILOT_SCOPE_GATEWAY_TO_NAMESPACE",
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

	objects := []api_runtime.Object{
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "data-plane-1"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "data-plane-2"}},
		&istiodDeployment,
		&istioConfigMap,
		&sidecarConfigMap,
		&kialiSvc,
	}

	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.InCluster = false
	conf.KubernetesConfig.ClusterName = "East"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.KubeClusterInfo = kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{
			Host: "http://127.0.0.2:9443",
		},
	}

	//mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetupBusinessLayer(t, k8s, *conf)
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	layer := business.NewWithBackends(clients, clients, nil, nil)
	meshSvc := layer.Mesh

	//r := httptest.NewRequest("GET", "http://kiali.url.local/", nil)
	a, err := meshSvc.GetClusters()
	require.Nil(err, "GetClusters returned error: %v", err)

	require.NotNil(a, "GetClusters returned nil")
	require.Len(a, 1, "GetClusters didn't resolve the Kiali cluster")
	assert.Equal("East", a[0].Name, "Unexpected cluster name")
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

	mesh.StatusGetter = func() status.StatusInfo {
		return status.StatusInfo{
			ExternalServices: []status.ExternalServiceInfo{},
		}
	}

	return globalInfo, nil
}

type fakeIstioStatusGetter struct{}

// mock GetStatus function to obtain fake graph component status
func (f *fakeIstioStatusGetter) GetStatus(ctx context.Context, cluster string) (kubernetes.IstioComponentStatus, error) {
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

// Helper method that tests the objects are equal and if they aren't will
// unmarshal them into a json object and diff them. This way the output of the failure
// is actually useful. Otherwise printing the byte slice results is incomprehensible.
func assertObjectsEqual(t *testing.T, expected, actual []byte) {
	if !assert.ObjectsAreEqual(expected, actual) {
		t.Log("Actual response does not equal expected golden copy. If you've updated the golden copy, ensure it ends with a newline.")
		t.Fail()

		var (
			ev any
			av any
		)
		err := func() error {
			if err := json.Unmarshal(expected, &ev); err != nil {
				t.Logf("Failed to unmarshal expected value: %s", err)
				return err
			}

			if err := json.Unmarshal(actual, &av); err != nil {
				t.Logf("Failed to unmarshal actual value: %s", err)
				return err
			}

			return nil
		}()
		if err != nil {
			t.Logf("Failed to unmarshal expected or actual value. Falling back to string comparison.\nExpected: %s\nActual: %s", string(expected), string(actual))
			return
		}

		t.Logf("Diff: %s", cmp.Diff(ev, av))
	}
}

func TestMeshGraph(t *testing.T) {
	globalInfo, err := mockMeshGraph(t)
	if err != nil {
		t.Error(err)
		return
	}

	globalInfo.IstioStatusGetter = &fakeIstioStatusGetter{}

	var fut func(ctx context.Context, globalInfo *mesh.AppenderGlobalInfo, o mesh.Options) (int, interface{})

	mr := mux.NewRouter()
	mr.HandleFunc("/api/mesh", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := authentication.SetAuthInfoContext(r.Context(), &api.AuthInfo{Token: "test"})
			code, config := fut(context, globalInfo, mesh.NewOptions(r.WithContext(context)))
			respond(w, code, config)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphMesh
	url := ts.URL + "/api/mesh?queryTime=1523364075"
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

	if !assert.ObjectsAreEqual(expected, actual) {
		fmt.Printf("Actual:\n%s", actual)
		assertObjectsEqual(t, expected, actual)
	}
	assert.Equal(t, 200, resp.StatusCode)
}
