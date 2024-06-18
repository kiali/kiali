package business

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestRegistryServices(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	registryz := "../tests/data/registry/registry-registryz.json"
	bRegistryz, err := os.ReadFile(registryz)
	require.NoError(err)

	rRegistry := map[string][]byte{
		"istiod1": bRegistryz,
	}

	registry, err2 := parseRegistryServices(rRegistry)
	require.NoError(err2)
	require.NotNil(registry)

	assert.Equal(79, len(registry))
	assert.Equal("*.msn.com", registry[0].Attributes.Name)
}

type fakeForwarder struct {
	kubernetes.ClientInterface
	testURL string
}

func (f *fakeForwarder) ForwardGetRequest(namespace, podName string, destinationPort int, path string) ([]byte, error) {
	resp, err := http.Get(joinURL(f.testURL, path))
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func istiodTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var file string
		switch r.URL.Path {
		case "/debug/registryz":
			file = "../tests/data/registry/registry-registryz.json"
		case "/debug/syncz":
			file = "../tests/data/registry/registry-syncz.json"
		case "/debug":
			w.WriteHeader(http.StatusOK)
			return
		case "/ready":
			w.WriteHeader(http.StatusOK)
			return
		default:
			w.WriteHeader(http.StatusInternalServerError)
			t.Fatalf("Unexpected request path: %s", r.URL.Path)
			return
		}
		if _, err := w.Write(kubernetes.ReadFile(t, file)); err != nil {
			t.Fatalf("Error writing response: %s", err)
		}
	}))
	t.Cleanup(testServer.Close)
	return testServer
}

func runningIstiodPod() *core_v1.Pod {
	return &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "istiod-123",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				models.IstioRevisionLabel: "default",
			},
		},
		Status: core_v1.PodStatus{
			Phase: core_v1.PodRunning,
		},
	}
}

func fakeIstiodDeployment(cluster string, manageExternal bool) *apps_v1.Deployment {
	deployment := &apps_v1.Deployment{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				models.IstioRevisionLabel: "default",
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
									Value: cluster,
								},
							},
						},
					},
				},
			},
		},
	}
	if manageExternal {
		deployment.Spec.Template.Spec.Containers[0].Env = append(deployment.Spec.Template.Spec.Containers[0].Env, core_v1.EnvVar{
			Name:  "EXTERNAL_ISTIOD",
			Value: "true",
		})
	}
	return deployment
}

func TestRefreshIstioCache(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"

	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels: map[string]string{
				models.IstioRevisionLabel: "default",
			},
		},
		Data: map[string]string{"mesh": ""},
	}

	k8s := kubetest.NewFakeK8sClient(
		runningIstiodPod(),
		fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, true),
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		istioConfigMap,
	)
	// RefreshIstioCache relies on this being set.
	k8s.KubeClusterInfo.Name = conf.KubernetesConfig.ClusterName

	testServer := istiodTestServer(t)
	fakeForwarder := &fakeForwarder{
		ClientInterface: k8s,
		testURL:         testServer.URL,
	}

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = fakeForwarder
	cf := kubetest.NewFakeClientFactory(conf, k8sclients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(k8sclients, cache, conf)
	cpm := NewControlPlaneMonitor(cache, cf, *conf, discovery)

	assert.Nil(cache.GetRegistryStatus(conf.KubernetesConfig.ClusterName))
	err := cpm.RefreshIstioCache(context.TODO())
	require.NoError(err)

	registryServices := cache.GetRegistryStatus(conf.KubernetesConfig.ClusterName)
	require.NotNil(registryServices)

	assert.Len(registryServices.Services, 79)
	// This is a pod that exists in the test data at: "../tests/data/registry/registry-syncz.json"
	podProxyStatus := cache.GetPodProxyStatus("Kubernetes", "beta", "b-client-8b97458bb-tghx9")
	require.NotNil(podProxyStatus)
	assert.Equal("Kubernetes", podProxyStatus.ClusterID)
}

func TestCancelingContextEndsPolling(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	kubernetes.SetConfig(t, *conf)

	k8sclients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cf := kubetest.NewFakeClientFactory(conf, k8sclients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(k8sclients, cache, conf)
	cpm := NewControlPlaneMonitor(cache, cf, *conf, discovery)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	cpm.PollIstiodForProxyStatus(ctx)

	assert.Nil(cache.GetRegistryStatus(conf.KubernetesConfig.ClusterName))
}

func TestPollingPopulatesCache(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()

	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels: map[string]string{
				models.IstioRevisionLabel: "default",
			},
		},
		Data: map[string]string{"mesh": ""},
	}

	testServer := istiodTestServer(t)

	k8s := kubetest.NewFakeK8sClient(
		runningIstiodPod(),
		fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, true),
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		istioConfigMap,
	)
	// RefreshIstioCache relies on this being set.
	k8s.KubeClusterInfo.Name = conf.KubernetesConfig.ClusterName

	fakeForwarder := &fakeForwarder{
		ClientInterface: k8s,
		testURL:         testServer.URL,
	}

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = fakeForwarder
	cf := kubetest.NewFakeClientFactory(conf, k8sclients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(k8sclients, cache, conf)
	cpm := NewControlPlaneMonitor(cache, cf, *conf, discovery)
	// Make this really low so that we get something sooner.
	cpm.pollingInterval = time.Millisecond * 1

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	require.Nil(cache.GetRegistryStatus(conf.KubernetesConfig.ClusterName))
	cpm.PollIstiodForProxyStatus(ctx)
	// Cache should be populated after PollIstiod returns because the
	// pump gets primed before polling starts.
	require.NotNil(cache.GetRegistryStatus(conf.KubernetesConfig.ClusterName))

	// Clear the registry to make sure it gets populated again through polling.
	cache.SetRegistryStatus(nil)
	for {
		select {
		case <-time.After(time.Millisecond * 300):
			require.Fail("Timed out waiting for cache to be populated")
			return
		default:
			if cache.GetRegistryStatus(conf.KubernetesConfig.ClusterName) != nil {
				return
			}
		}
	}
}
