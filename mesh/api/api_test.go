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
)

// Setup mock

// firstKey returns the first key from the map.
// Useful when you don't care about ordering.
// Empty map returns empty K value.
func firstKey[K comparable, V any](m map[K]V) K {
	var k K
	for k = range m {
		break
	}
	return k
}

func setupMocks(t *testing.T) *business.Layer {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.InCluster = false
	conf.KubernetesConfig.ClusterName = "East"
	config.Set(conf)

	istioDeploymentMock := apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
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

	sidecarConfigMapMock := core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-sidecar-injector",
			Namespace: "istio-system",
		},
		Data: map[string]string{
			"values": "{ \"global\": { \"network\": \"kialiNetwork\" } }",
		},
	}

	kialiNs := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "istio-system"},
	}

	kialiSvc := []core_v1.Service{
		{
			ObjectMeta: v1.ObjectMeta{
				Annotations: map[string]string{
					"operator-sdk/primary-resource": "kiali-operator/myKialiCR",
				},
				Labels: map[string]string{
					"app.kubernetes.io/part-of": "kiali",
					"app.kubernetes.io/version": "v1.25",
				},
				Name:      "kiali-service",
				Namespace: "istio-system",
			},
			Spec: core_v1.ServiceSpec{
				Selector: map[string]string{
					"app.kubernetes.io/part-of": "kiali",
				},
			},
		},
	}

	objects := []api_runtime.Object{
		&istioDeploymentMock,
		&sidecarConfigMapMock,
		&kialiNs,
	}

	for _, obj := range kialiSvc {
		o := obj
		objects = append(objects, &o)
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.KubeClusterInfo = kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{
			Host: "http://127.0.0.2:9443",
		},
	}

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetupBusinessLayer(t, k8s, *conf)

	layer := business.NewWithBackends(mockClientFactory.Clients, mockClientFactory.Clients, nil, nil)
	meshSvc := layer.Mesh

	r := httptest.NewRequest("GET", "http://kiali.url.local/", nil)
	a, err := meshSvc.GetClusters(r)
	require.Nil(err, "GetClusters returned error: %v", err)

	require.NotNil(a, "GetClusters returned nil")
	require.Len(a, 1, "GetClusters didn't resolve the Kiali cluster")
	assert.Equal("East", a[0].Name, "Unexpected cluster name")
	assert.True(a[0].IsKialiHome, "Kiali cluster not properly marked as such")
	assert.Equal("http://127.0.0.2:9443", a[0].ApiEndpoint)
	assert.Equal("kialiNetwork", a[0].Network)

	require.Len(a[0].KialiInstances, 1, "GetClusters didn't resolve the local Kiali instance")
	assert.Equal("istio-system", a[0].KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")
	assert.Equal("kiali-operator/myKialiCR", a[0].KialiInstances[0].OperatorResource, "GetClusters didn't set the right operator resource of the Kiali instance")
	assert.Equal("http://kiali.url.local", a[0].KialiInstances[0].Url, "GetClusters didn't set the right URL of the Kiali instance")
	assert.Equal("v1.25", a[0].KialiInstances[0].Version, "GetClusters didn't set the right version of the Kiali instance")
	assert.Equal("kiali-service", a[0].KialiInstances[0].ServiceName, "GetClusters didn't set the right service name of the Kiali instance")

	return layer
}

// mockMeshGraph provides a common single-cluster mock
func mockMeshGraph(t *testing.T) (*business.Layer, error) {

	layer := setupMocks(t)

	return layer, nil
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
	layer, err := mockMeshGraph(t)
	if err != nil {
		t.Error(err)
		return
	}

	var fut func(ctx context.Context, b *business.Layer, o mesh.Options) (int, interface{})

	mr := mux.NewRouter()
	mr.HandleFunc("/api/mesh", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := authentication.SetAuthInfoContext(r.Context(), &api.AuthInfo{Token: "test"})
			code, config := fut(context, layer, mesh.NewOptions(r.WithContext(context)))
			respond(w, code, config)
		}))

	ts := httptest.NewServer(mr)
	defer ts.Close()

	fut = graphMesh
	url := ts.URL + "/api/mesh"
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
