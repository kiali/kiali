package business

/*
	This file contains helper methods for unit testing with the business package.
	The utilities in this file are not meant to be used outside of unit tests.
*/

import (
	"testing"

	"golang.org/x/exp/slices"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
)

// SetWithBackends allows for specifying the ClientFactory and Prometheus clients to be used.
// Mock friendly. Used only with tests.
func setWithBackends(cf kubernetes.ClientFactory, prom prometheus.ClientInterface, cache cache.KialiCache, cpm ControlPlaneMonitor) {
	clientFactory = cf
	prometheusClient = prom
	kialiCache = cache
	poller = cpm
}

// SetupBusinessLayer mocks out some global variables in the business package
// such as the kiali cache and the prometheus client.
func SetupBusinessLayer(t *testing.T, k8s kubernetes.ClientInterface, config config.Config) cache.KialiCache {
	t.Helper()

	cf := kubetest.NewK8SClientFactoryMock(k8s)

	cache := cache.NewTestingCacheWithFactory(t, cf, config)

	originalClientFactory := clientFactory
	originalPrometheusClient := prometheusClient
	originalKialiCache := kialiCache
	t.Cleanup(func() {
		clientFactory = originalClientFactory
		prometheusClient = originalPrometheusClient
		kialiCache = originalKialiCache
	})

	cpm := &FakeControlPlaneMonitor{}

	setWithBackends(cf, nil, cache, cpm)
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

// FindOrFail will find an element in a slice or fail the test.
func FindOrFail[T any](t *testing.T, s []T, f func(T) bool) T {
	t.Helper()
	idx := slices.IndexFunc(s, f)
	if idx == -1 {
		t.Fatal("Element not in slice")
	}
	return s[idx]
}
