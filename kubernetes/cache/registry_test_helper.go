package cache

import (
	"time"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"

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

// Fake KialiCache used for RegistryServices and All IstioConfigs Scenarios
// It populates the Namespaces, Informers and Registry information needed
func FakeServicesKialiCache(rss []*kubernetes.RegistryService,
	gws []networking_v1alpha3.Gateway,
	vss []networking_v1alpha3.VirtualService,
	drs []networking_v1alpha3.DestinationRule,
	ses []networking_v1alpha3.ServiceEntry,
	sds []networking_v1alpha3.Sidecar,
	ras []security_v1beta1.RequestAuthentication,
	wes []networking_v1alpha3.WorkloadEntry) KialiCache {
	kialiCacheImpl := kialiCacheImpl{
		tokenNamespaces: make(map[string]namespaceCache),
		// ~ long duration for unit testing
		refreshDuration: time.Hour,
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
