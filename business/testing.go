package business

/*
	This file contains helper methods for unit testing with the business package.
	The utilities in this file are not meant to be used outside of unit tests.
*/

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
)

// SetWithBackends allows for specifying the ClientFactory and Prometheus clients to be used.
// Mock friendly. Used only with tests.
func setWithBackends(cf kubernetes.ClientFactory, prom prometheus.ClientInterface, cache cache.KialiCache) {
	clientFactory = cf
	prometheusClient = prom
	kialiCache = cache
}

// SetupBusinessLayer mocks out some global variables in the business package
// such as the kiali cache and the prometheus client.
func SetupBusinessLayer(t *testing.T, k8s kubernetes.ClientInterface, config config.Config) cache.KialiCache {
	t.Helper()

	cf := kubetest.NewK8SClientFactoryMock(k8s)

	cache := newTestingCache(t, cf, config)
	cache.SetRegistryStatus(&kubernetes.RegistryStatus{})

	setWithBackends(cf, nil, cache)

	return cache
}

// WithProm is a testing func that lets you replace the global prom client var.
func WithProm(prom prometheus.ClientInterface) {
	prometheusClient = prom
}

// WithKialiCache is a testing func that lets you replace the global cache var.
func WithKialiCache(cache cache.KialiCache) {
	kialiCache = cache
}

func newTestingCache(t *testing.T, cf kubernetes.ClientFactory, conf config.Config) cache.KialiCache {
	t.Helper()
	// Disabling Istio API for tests. Otherwise the cache will try and poll the Istio endpoint
	// when the cache is created.
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	cache, err := cache.NewKialiCache(cf, conf)
	if err != nil {
		t.Fatalf("Error creating KialiCache: %v", err)
	}
	t.Cleanup(cache.Stop)

	return cache
}

// NewTestingCache will create a cache for you from the kube client and will cleanup the cache
// when the test ends.
func NewTestingCache(t *testing.T, k8s kubernetes.ClientInterface, conf config.Config) cache.KialiCache {
	t.Helper()
	cf := kubetest.NewK8SClientFactoryMock(k8s)
	return newTestingCache(t, cf, conf)
}
