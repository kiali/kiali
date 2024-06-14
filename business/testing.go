package business

/*
	This file contains helper methods for unit testing with the business package.
	The utilities in this file are not meant to be used outside of unit tests.
*/

import (
	"slices"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
)

// SetWithBackends allows for specifying the ClientFactory and Prometheus clients to be used.
// Mock friendly. Used only with tests.
func setWithBackends(cf kubernetes.ClientFactory, prom prometheus.ClientInterface, cache cache.KialiCache, cpm ControlPlaneMonitor, d meshDiscovery) {
	clientFactory = cf
	discovery = d
	kialiCache = cache
	poller = cpm
	prometheusClient = prom
}

// SetupBusinessLayer mocks out some global variables in the business package
// such as the kiali cache and the prometheus client.
func SetupBusinessLayer(t *testing.T, k8s kubernetes.ClientInterface, config config.Config) cache.KialiCache {
	t.Helper()

	originalClientFactory := clientFactory
	originalPrometheusClient := prometheusClient
	originalKialiCache := kialiCache
	originalDiscovery := discovery
	t.Cleanup(func() {
		clientFactory = originalClientFactory
		prometheusClient = originalPrometheusClient
		kialiCache = originalKialiCache
		discovery = originalDiscovery
	})

	cf := kubetest.NewK8SClientFactoryMock(k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, config)
	cpm := &FakeControlPlaneMonitor{}
	d := istio.NewDiscovery(cf.Clients, cache, &config)

	setWithBackends(cf, nil, cache, cpm, d)
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

// WithControlPlaneMonitor is a testing func that lets you replace the global cpm var.
func WithControlPlaneMonitor(cpm ControlPlaneMonitor) {
	poller = cpm
}

// WithDiscovery is a testing func that lets you replace the global discovery var.
func WithDiscovery(disc meshDiscovery) {
	discovery = disc
}

// FindOrFail will find an element in a slice or fail the test.
func FindOrFail[T any](t *testing.T, s []T, f func(T) bool) T {
	t.Helper()
	idx := slices.IndexFunc(s, f)
	if idx == -1 {
		t.Fatal("Element not in slice")
	}
	return s[idx]
}
