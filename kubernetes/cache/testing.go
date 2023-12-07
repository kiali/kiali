package cache

/*
	Contains utilities for unit testing with a cache.
*/

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func newTestingCache(t *testing.T, cf kubernetes.ClientFactory, conf config.Config) KialiCache {
	t.Helper()
	// Disabling Istio API for tests. Otherwise the cache will try and poll the Istio endpoint
	// when the cache is created.
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	cache, err := NewKialiCache(cf, conf)
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
	cf := kubetest.NewK8SClientFactoryMock(k8s)
	return newTestingCache(t, cf, conf)
}

// NewTestingCacheWithFactory allows you to pass in a custom client factory. Good for testing multicluster.
func NewTestingCacheWithFactory(t *testing.T, cf kubernetes.ClientFactory, conf config.Config) KialiCache {
	t.Helper()
	return newTestingCache(t, cf, conf)
}
