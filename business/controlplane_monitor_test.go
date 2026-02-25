package business

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/certtest"
)

type fakeForwarder struct {
	kubernetes.UserClientInterface
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

	synczBytes := kubernetes.ReadFile(t, "../tests/data/registry/registry-syncz.json")

	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/debug/syncz":
			_, _ = w.Write(synczBytes)
		case "/debug", "/ready":
			w.WriteHeader(http.StatusOK)
		default:
			http.Error(w, "Unexpected request path: "+r.URL.Path, http.StatusInternalServerError)
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
				config.IstioRevisionLabel: "default",
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

	k8s := kubetest.NewFakeK8sClient(
		runningIstiodPod(),
		fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, true),
		kubetest.FakeNamespace("istio-system"),
	)
	// RefreshIstioCache relies on this being set.
	k8s.KubeClusterInfo.Name = conf.KubernetesConfig.ClusterName

	testServer := istiodTestServer(t)
	fakeForwarder := &fakeForwarder{
		UserClientInterface: k8s,
		testURL:             testServer.URL,
	}

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = fakeForwarder
	cf := kubetest.NewFakeClientFactory(conf, k8sclients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster: &models.KubeCluster{
					Name: conf.KubernetesConfig.ClusterName,
				},
				IstiodName:      "istio",
				IstiodNamespace: "istio-system",
				Revision:        "default",
				Status:          kubernetes.ComponentHealthy,
			}},
		},
	}
	cpm := NewControlPlaneMonitor(cache, cf, conf, discovery)
	err := cpm.RefreshIstioCache(context.TODO())
	require.NoError(err)

	// This is a pod that exists in the test data at: "../tests/data/registry/registry-syncz.json"
	podProxyStatus := cache.GetPodProxyStatus("Kubernetes", "beta", "b-client-8b97458bb-tghx9")
	require.NotNil(podProxyStatus)
	assert.Equal("Kubernetes", podProxyStatus.ClusterID)
}

func TestCancelingContextEndsPolling(t *testing.T) {
	conf := config.NewConfig()
	kubernetes.SetConfig(t, *conf)

	k8sclients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cf := kubetest.NewFakeClientFactory(conf, k8sclients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(k8sclients), cache, conf)
	cpm := NewControlPlaneMonitor(cache, cf, conf, discovery)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	cpm.PollIstiodForProxyStatus(ctx)
}

func TestPollingPopulatesCache(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()

	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels: map[string]string{
				config.IstioRevisionLabel: "default",
			},
		},
		Data: map[string]string{"mesh": ""},
	}

	testServer := istiodTestServer(t)

	k8s := kubetest.NewFakeK8sClient(
		runningIstiodPod(),
		fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, true),
		kubetest.FakeNamespace("istio-system"),
		istioConfigMap,
		certtest.FakeIstioCertificateConfigMap("istio-system"),
	)
	k8s.KubeClusterInfo.Name = conf.KubernetesConfig.ClusterName

	fakeForwarder := &fakeForwarder{
		UserClientInterface: k8s,
		testURL:             testServer.URL,
	}

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = fakeForwarder
	cf := kubetest.NewFakeClientFactory(conf, k8sclients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(k8sclients), cache, conf)
	cpm := NewControlPlaneMonitor(cache, cf, conf, discovery)
	cpm.pollingInterval = time.Millisecond * 1

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cpm.PollIstiodForProxyStatus(ctx)
	// Cache should be populated after PollIstiod returns because the
	// pump gets primed before polling starts.
	podProxyStatus := cache.GetPodProxyStatus("Kubernetes", "beta", "b-client-8b97458bb-tghx9")
	require.NotNil(podProxyStatus)
}
