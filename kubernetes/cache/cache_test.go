package cache

import (
	"regexp"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// TODO: pass in interface?
func newTestKialiCache(k8s *kubetest.FakeK8sClient) *kialiCacheImpl {
	kialiCache := &kialiCacheImpl{
		k8sApi:                k8s.KubeClientset,
		istioApi:              k8s.IstioClientset,
		gatewayApi:            k8s.GatewayAPIClientset,
		clusterScoped:         false,
		stopClusterScopedChan: make(chan struct{}),
		stopNSChans:           make(map[string]chan struct{}),
		nsCacheLister:         make(map[string]*cacheLister),
		stopPolling:           func() {},
	}
	kialiCache.registryRefreshHandler = NewRegistryHandler(kialiCache.RefreshRegistryStatus)
	return kialiCache
}

func TestNewKialiCache_isCached(t *testing.T) {
	assert := assert.New(t)

	kialiCacheImpl := kialiCacheImpl{
		istioClient:            kubernetes.K8SClient{},
		refreshDuration:        0,
		cacheNamespacesRegexps: []regexp.Regexp{*regexp.MustCompile("bookinfo"), *regexp.MustCompile("a.*"), *regexp.MustCompile("galicia")},
	}

	assert.True(kialiCacheImpl.isCached("bookinfo"))
	assert.True(kialiCacheImpl.isCached("a"))
	assert.True(kialiCacheImpl.isCached("abcdefghi"))
	assert.False(kialiCacheImpl.isCached("b"))
	assert.False(kialiCacheImpl.isCached("bbcdefghi"))
	assert.True(kialiCacheImpl.isCached("galicia"))
}

func TestClusterScopedCacheStopped(t *testing.T) {
	assert := assert.New(t)

	kialiCacheImpl := newTestKialiCache(kubetest.NewFakeK8sClient())
	stopCh := make(chan struct{})
	kialiCacheImpl.stopClusterScopedChan = stopCh
	kialiCacheImpl.clusterScoped = true
	kialiCacheImpl.Refresh("")

	kialiCacheImpl.Stop()
	select {
	case <-time.After(300 * time.Millisecond):
		assert.Fail("Cache should have been stopped")
	case <-stopCh:
	}
}

func TestNSScopedCacheStopped(t *testing.T) {
	assert := assert.New(t)

	stopChs := map[string]chan struct{}{
		"ns1": make(chan struct{}),
		"ns2": make(chan struct{}),
	}
	kialiCacheImpl := newTestKialiCache(kubetest.NewFakeK8sClient())
	kialiCacheImpl.stopNSChans = stopChs
	kialiCacheImpl.clusterScoped = false

	kialiCacheImpl.Stop()
	for ns, stopCh := range stopChs {
		select {
		case <-time.After(300 * time.Millisecond):
			assert.Failf("Cache for namespace: %s should have been stopped", ns)
		case <-stopCh:
		}
	}

	assert.Empty(kialiCacheImpl.nsCacheLister)
}

func TestRefreshClusterScoped(t *testing.T) {
	assert := assert.New(t)

	svc := &corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "svc1", Namespace: "ns1"}}
	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient(svc))
	kialiCache.clusterScoped = true
	kialiCache.clusterCacheLister = &cacheLister{}
	oldLister := kialiCache.clusterCacheLister
	kialiCache.Refresh("")
	assert.NotEqual(kialiCache.clusterCacheLister, oldLister)
}

func TestRefreshMultipleTimesClusterScoped(t *testing.T) {
	assert := assert.New(t)

	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient())
	kialiCache.clusterScoped = true
	kialiCache.clusterCacheLister = &cacheLister{}
	oldLister := kialiCache.clusterCacheLister

	kialiCache.Refresh("")
	kialiCache.Refresh("")
	assert.NotEqual(kialiCache.clusterCacheLister, oldLister)
}

func TestRefreshNSScoped(t *testing.T) {
	assert := assert.New(t)

	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient())
	kialiCache.clusterScoped = false
	kialiCache.nsCacheLister = map[string]*cacheLister{}

	kialiCache.Refresh("ns1")
	assert.NotEqual(kialiCache.nsCacheLister, map[string]*cacheLister{})
	assert.Contains(kialiCache.nsCacheLister, "ns1")
}

func TestCheckNamespaceClusterScoped(t *testing.T) {
	assert := assert.New(t)

	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient())
	kialiCache.clusterScoped = true

	// Should always return true for cluster scoped cache.
	assert.True(kialiCache.CheckNamespace("ns1"))
}

func TestCheckNamespaceNotIncluded(t *testing.T) {
	assert := assert.New(t)

	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient())
	kialiCache.clusterScoped = false

	assert.False(kialiCache.CheckNamespace("ns1"))
}

func TestCheckNamespaceIsIncluded(t *testing.T) {
	assert := assert.New(t)

	regex := regexp.MustCompile("ns.*")
	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient())
	kialiCache.clusterScoped = false
	kialiCache.cacheNamespacesRegexps = []regexp.Regexp{*regex}

	assert.True(kialiCache.CheckNamespace("ns1"))
}
