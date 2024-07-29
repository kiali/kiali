package business_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
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

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	kubernetes.SetConfig(t, *conf)
	config.Set(conf)

	migratedNamespace := *kubetest.FakeNamespaceWithLabels("travel-agency", map[string]string{"istio.io/rev": "canary"})
	pendingNamespace := *kubetest.FakeNamespaceWithLabels("travel-portal", map[string]string{"istio-injection": "enabled"})

	// Create a MeshService and invoke IsMeshConfigured
	k8sclients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: conf.IstioNamespace}},
			runningIstiodPod(),
			&migratedNamespace,
			&pendingNamespace,
		),
	}

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
	check.NotNil(canaryUpgradeStatus)
	check.Equal(0, len(canaryUpgradeStatus.NamespacesPerRevision))
}

// TestCanaryUpgradeConfigured verifies that when there is a canary upgrade in place, the migrated and pending namespaces should have namespaces
func TestCanaryUpgradeConfigured(t *testing.T) {
	check := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	kubernetes.SetConfig(t, *conf)
	config.Set(conf)

	migratedNamespace := *kubetest.FakeNamespaceWithLabels("travel-agency", map[string]string{"istio.io/rev": "canary"})
	pendingNamespace := *kubetest.FakeNamespaceWithLabels("travel-portal", map[string]string{"istio-injection": "enabled"})

	k8sclients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace(conf.IstioNamespace),
			runningIstiodPod(),
			runningIstiodCanaryPod(),
			&migratedNamespace,
			&pendingNamespace,
		),
	}

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
	check.Contains(canaryUpgradeStatus.NamespacesPerRevision["canary"], "travel-agency")
	check.Equal(1, len(canaryUpgradeStatus.NamespacesPerRevision["canary"]))
	check.Contains(canaryUpgradeStatus.NamespacesPerRevision["default"], "travel-portal")
	check.Equal(1, len(canaryUpgradeStatus.NamespacesPerRevision["default"]))
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
