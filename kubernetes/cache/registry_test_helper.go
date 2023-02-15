package cache

import (
	"fmt"
	"time"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

var emptyHandler = NewRegistryHandler(func() {})

// Fake KialiCache used for Gateway Scenarios
// It populates the Namespaces, Informers and Gateway information needed
func FakeGatewaysKialiCache(gws []*networking_v1beta1.Gateway) KialiCache {
	cfg := config.Get()
	cfg.Deployment.AccessibleNamespaces = []string{"bookinfo"}
	cfg.KubernetesConfig.CacheNamespaces = []string{"test"}
	cache, err := NewKubeCache(kubetest.NewFakeK8sClient(), *cfg, emptyHandler)
	if err != nil {
		panic(fmt.Sprintf("Error creating KialiCache in testing. Err: %v", err))
	}
	kialiCacheImpl := kialiCacheImpl{
		tokenNamespaces: make(map[string]map[string]namespaceCache),
		// ~ long duration for unit testing
		refreshDuration: time.Hour,
		KubeCache:       cache,
	}

	// Populate all Gateways using the Registry
	registryStatus := kubernetes.RegistryStatus{
		Configuration: &kubernetes.RegistryConfiguration{
			Gateways: gws,
		},
	}

	kialiCacheImpl.SetRegistryStatus(&registryStatus)

	return &kialiCacheImpl
}

// Fake KialiCache used for RegistryServices and All IstioConfigs Scenarios
// It populates the Namespaces, Informers and Registry information needed
func FakeServicesKialiCache(rss []*kubernetes.RegistryService,
	gws []*networking_v1beta1.Gateway,
	vss []*networking_v1beta1.VirtualService,
	drs []*networking_v1beta1.DestinationRule,
	ses []*networking_v1beta1.ServiceEntry,
	sds []*networking_v1beta1.Sidecar,
	ras []*security_v1beta1.RequestAuthentication,
	wes []*networking_v1beta1.WorkloadEntry,
) KialiCache {
	// Tests that use this rely on namespaced scoped caches.
	cfg := config.Get()
	cfg.Deployment.AccessibleNamespaces = []string{"bookinfo"}
	cfg.KubernetesConfig.CacheNamespaces = []string{"test"}
	cache, err := NewKubeCache(kubetest.NewFakeK8sClient(), *cfg, emptyHandler)
	if err != nil {
		panic(fmt.Sprintf("Error creating KialiCache in testing. Err: %v", err))
	}
	kialiCacheImpl := kialiCacheImpl{
		tokenNamespaces: make(map[string]map[string]namespaceCache),
		// ~ long duration for unit testing
		refreshDuration: time.Hour,
		KubeCache:       cache,
	}

	// Populate all DestinationRules using the Registry
	registryStatus := kubernetes.RegistryStatus{
		Services: rss,
		Configuration: &kubernetes.RegistryConfiguration{
			Gateways:               gws,
			DestinationRules:       drs,
			VirtualServices:        vss,
			ServiceEntries:         ses,
			Sidecars:               sds,
			WorkloadEntries:        wes,
			RequestAuthentications: ras,
		},
	}

	kialiCacheImpl.SetRegistryStatus(&registryStatus)

	return &kialiCacheImpl
}
