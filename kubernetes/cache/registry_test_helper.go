package cache

import (
	"time"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/kubernetes"
)

// Fake KialiCache used for Gateway Scenarios
// It populates the Namespaces, Informers and Gateway information needed
func FakeGatewaysKialiCache(gws []networking_v1alpha3.Gateway) KialiCache {
	kialiCacheImpl := kialiCacheImpl{
		tokenNamespaces: make(map[string]namespaceCache),
		// ~ long duration for unit testing
		refreshDuration: time.Hour,
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

// Fake KialiCache used for RegistryServices and ExportedResources Scenarios
// It populates the Namespaces, Informers and Registry information needed
func FakeServicesKialiCache(rss []*kubernetes.RegistryService,
	gws []networking_v1alpha3.Gateway,
	vss []networking_v1alpha3.VirtualService,
	drs []networking_v1alpha3.DestinationRule,
	ses []networking_v1alpha3.ServiceEntry) KialiCache {
	kialiCacheImpl := kialiCacheImpl{
		tokenNamespaces: make(map[string]namespaceCache),
		// ~ long duration for unit testing
		refreshDuration: time.Hour,
	}

	// Populate all DestinationRules using the Registry
	registryStatus := kubernetes.RegistryStatus{
		Services: rss,
		Configuration: &kubernetes.RegistryConfiguration{
			Gateways:         gws,
			DestinationRules: drs,
			VirtualServices:  vss,
			ServiceEntries:   ses,
		},
	}

	kialiCacheImpl.SetRegistryStatus(&registryStatus)

	return &kialiCacheImpl
}
