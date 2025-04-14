package cache

/*
	Contains utilities for unit testing with a cache.
*/

import (
	"testing"

	"k8s.io/client-go/tools/cache"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

func newTestingCache(t testing.TB, clients map[string]kubernetes.ClientInterface, conf config.Config) KialiCache {
	t.Helper()
	// Disabling Istio API for tests. Otherwise the cache will try and poll the Istio endpoint
	// when the cache is created.
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	cache, err := newKialiCache(clients, conf, ConstantWaitForSync)
	if err != nil {
		t.Fatalf("Error creating KialiCache: %v", err)
	}
	t.Cleanup(cache.Stop)

	return cache
}

// NewTestingCache will create a cache for you from the kube client and will cleanup the cache
// when the test ends.
func NewTestingCache(t *testing.T, k8s kubernetes.ClientInterface, conf config.Config) KialiCache {
	t.Helper()
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	return newTestingCache(t, clients, conf)
}

// NewTestingCacheWithFactory allows you to pass in a custom client factory. Good for testing multicluster.
func NewTestingCacheWithFactory(t testing.TB, cf kubernetes.ClientFactory, conf config.Config) KialiCache {
	t.Helper()
	return newTestingCache(t, cf.GetSAClients(), conf)
}

// NewTestingCacheWithClients allows you to pass in a map of clients instead of creating a client factory. Good for testing multicluster.
func NewTestingCacheWithClients(t *testing.T, clients map[string]kubernetes.ClientInterface, conf config.Config) KialiCache {
	t.Helper()
	return newTestingCache(t, clients, conf)
}

// ConstantWaitForSync waits continuously with zero interval. Only use this for testing.
func ConstantWaitForSync(stopCh <-chan struct{}, cacheSyncs ...cache.InformerSynced) bool {
	for {
		select {
		case <-stopCh:
			return false
		default:
			if allCachesSynced(cacheSyncs...) {
				return true
			}
		}
	}
}

func allCachesSynced(cacheSyncs ...cache.InformerSynced) bool {
	for _, syncFunc := range cacheSyncs {
		if !syncFunc() {
			return false
		}
	}
	return true
}
