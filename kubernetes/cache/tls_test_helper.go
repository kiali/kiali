package cache

import (
	"time"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	"k8s.io/client-go/tools/cache"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type fakeInformer struct {
	cache.SharedIndexInformer
	Store *cache.FakeCustomStore
}

func (f *fakeInformer) GetStore() cache.Store {
	return f.Store
}

// Fake KialiCache used for TLS Scenarios
// It populates the Namespaces, Informers and Registry information needed
func FakeTlsKialiCache(token string, namespaces []string, pa []security_v1beta1.PeerAuthentication, dr []networking_v1beta1.DestinationRule) KialiCache {
	kialiCacheImpl := kialiCacheImpl{
		tokenNamespaces: make(map[string]namespaceCache),
		// ~ long duration for unit testing
		refreshDuration: time.Hour,
	}
	// Populate namespaces and PeerAuthentication informers
	nss := []models.Namespace{}
	for _, ns := range namespaces {
		nss = append(nss, models.Namespace{Name: ns})
	}
	kialiCacheImpl.SetNamespaces(token, nss)

	// Populate all DestinationRules using the Registry
	registryStatus := kubernetes.RegistryStatus{
		Configuration: &kubernetes.RegistryConfiguration{
			DestinationRules:    []networking_v1beta1.DestinationRule{},
			PeerAuthentications: []security_v1beta1.PeerAuthentication{},
		},
	}
	registryStatus.Configuration.DestinationRules = append(registryStatus.Configuration.DestinationRules, dr...)
	registryStatus.Configuration.PeerAuthentications = append(registryStatus.Configuration.PeerAuthentications, pa...)
	kialiCacheImpl.SetRegistryStatus(&registryStatus)

	return &kialiCacheImpl
}
