package business_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// TestCanaryUpgradeNotConfigured verifies that when there is no canary upgrade configured, both the migrated and pending namespace lists are empty
func TestCanaryUpgradeNotConfigured(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()

	config.Set(conf)

	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("ClusterInfo").Return(kubernetes.ClusterInfo{Name: conf.KubernetesConfig.ClusterName})
	k8s.On("GetNamespaces", "istio-injection=enabled").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=default").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=canary").Return([]core_v1.Namespace{}, nil)

	// Create a MeshService and invoke IsMeshConfigured
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	layer := business.NewWithBackends(k8sclients, k8sclients, nil, nil)
	meshSvc := layer.Mesh

	canaryUpgradeStatus, err := meshSvc.CanaryUpgradeStatus()

	check.Nil(err, "IstiodCanariesStatus failed: %s", err)
	check.NotNil(canaryUpgradeStatus)
}

// TestCanaryUpgradeConfigured verifies that when there is a canary upgrade in place, the migrated and pending namespaces should have namespaces
func TestCanaryUpgradeConfigured(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	kubernetes.SetConfig(t, *conf)
	config.Set(conf)

	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("IsIstioAPI").Return(true)
	k8s.On("ClusterInfo").Return(kubernetes.ClusterInfo{Name: conf.KubernetesConfig.ClusterName})

	migratedNamespace := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "travel-agency"},
	}
	migratedNamespaces := []core_v1.Namespace{migratedNamespace}

	pendingNamespace := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "travel-portal"},
	}
	pendingNamespaces := []core_v1.Namespace{pendingNamespace}

	k8s.On("GetNamespaces", "istio-injection=enabled").Return(pendingNamespaces, nil)
	k8s.On("GetNamespaces", "istio.io/rev=default").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=canary").Return(migratedNamespaces, nil)

	k8sclients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: conf.IstioNamespace}},
			// Ideally we wouldn't need to set all this stuff up here but there's not a good way
			// mock out the business.IstioStatus service since it's a struct.
			&appsv1.Deployment{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istiod",
					Namespace: conf.IstioNamespace,
					Labels: map[string]string{
						"app":          "istiod",
						"istio.io/rev": "default",
					},
				},
				Spec: appsv1.DeploymentSpec{
					Template: core_v1.PodTemplateSpec{
						ObjectMeta: v1.ObjectMeta{
							Labels: map[string]string{"app": "istiod", "istio.io/rev": "default"},
						},
					},
				},
			},
			&core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio",
					Namespace: conf.IstioNamespace,
					Labels:    map[string]string{"istio.io/rev": "default"},
				},
				Data: map[string]string{"mesh": ""},
			},
			&appsv1.Deployment{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istiod-canary",
					Namespace: conf.IstioNamespace,
					Labels: map[string]string{
						"app":          "istiod",
						"istio.io/rev": "canary",
					},
				},
				Spec: appsv1.DeploymentSpec{
					Template: core_v1.PodTemplateSpec{
						ObjectMeta: v1.ObjectMeta{
							Labels: map[string]string{"app": "istiod", "istio.io/rev": "canary"},
						},
					},
				},
			},
			&core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-canary",
					Namespace: conf.IstioNamespace,
					Labels:    map[string]string{"istio.io/rev": "canary"},
				},
				Data: map[string]string{"mesh": ""},
			},
			runningIstiodPod(),
			runningIstiodCanaryPod(),
			&migratedNamespace,
			&pendingNamespace,
		),
	}

	//k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	cf := kubetest.NewFakeClientFactory(conf, k8sclients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(k8sclients, cache, conf)
	nsService := business.NewNamespaceService(k8sclients, k8sclients, cache, conf, discovery)
	business.SetupBusinessLayer(t, k8sclients[conf.KubernetesConfig.ClusterName], *conf)
	business.WithKialiCache(cache)
	business.WithDiscovery(discovery)
	meshSvc := business.NewMeshService(k8sclients, cache, nsService, conf, discovery)

	canaryUpgradeStatus, err := meshSvc.CanaryUpgradeStatus()

	check.Nil(err, "IstiodCanariesStatus failed: %s", err)
	check.Contains(canaryUpgradeStatus.MigratedNamespaces, "travel-agency")
	check.Equal(1, len(canaryUpgradeStatus.MigratedNamespaces))
	check.Contains(canaryUpgradeStatus.PendingNamespaces, "travel-portal")
	check.Equal(1, len(canaryUpgradeStatus.PendingNamespaces))
}

func runningIstiodPod() *core_v1.Pod {
	return &core_v1.Pod{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod-123",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":          "istiod",
				"istio.io/rev": "default",
			},
		},
		Status: core_v1.PodStatus{
			Phase: core_v1.PodRunning,
		},
	}
}

func runningIstiodCanaryPod() *core_v1.Pod {
	return &core_v1.Pod{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod-456",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":          "istiod",
				"istio.io/rev": "canary",
			},
		},
		Status: core_v1.PodStatus{
			Phase: core_v1.PodRunning,
		},
	}
}
