package cache

import (
	"context"
	"sync"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// Istio uses caches for pods and controllers.
// Kiali will use caches for specific namespaces and types
// https://github.com/istio/istio/blob/master/mixer/adapter/kubernetesenv/cache.go

// KialiCache stores both kube objects and non-kube related data such as pods' proxy status.
// It is exclusively used by the business layer where it's expected to be a singleton.
// This business layer cache needs access to all the kiali service account has access
// to so it uses the kiali service account token instead of a user token. Access to
// the objects returned by the cache should be filtered/restricted to the user's
// token access but the cache returns objects without any filtering or restrictions.
type KialiCache interface {
	// Embedded for backward compatibility for business methods that just use one cluster.
	// All business methods should eventually use the multi-cluster cache.
	KubeCache
	NamespacesCache
	ProxyStatusCache
	RegistryStatusCache
}

// namespaceCache caches namespaces according to their token.
// TODO: Support multi-cluster.
type namespaceCache struct {
	created       time.Time
	namespaces    []models.Namespace
	nameNamespace map[string]models.Namespace
}

type podProxyStatus struct {
	namespace   string
	pod         string
	proxyStatus *kubernetes.ProxyStatus
}

type kialiCacheImpl struct {
	// Embedded for backward compatibility for business methods that just use one cluster.
	// All business methods should eventually use the multi-cluster cache.
	KubeCache

	// Stops the background goroutines which refresh the cache's
	// service account token and poll for istiod's proxy status.
	cleanup       func()
	clientManager *kubernetes.ClusterClientManager
	// Maps a cluster name to a KubeCache
	kubeCache              map[string]KubeCache
	refreshDuration        time.Duration
	tokenLock              sync.RWMutex
	tokenNamespaces        map[string]namespaceCache
	tokenNamespaceDuration time.Duration
	proxyStatusLock        sync.RWMutex
	proxyStatusNamespaces  map[string]map[string]podProxyStatus
	registryStatusLock     sync.RWMutex
	registryStatusCreated  *time.Time
	registryStatus         *kubernetes.RegistryStatus
}

func NewKialiCache(clientManager *kubernetes.ClusterClientManager, cfg config.Config, namespaceSeedList ...string) (KialiCache, error) {
	kialiCacheImpl := kialiCacheImpl{
		clientManager:          clientManager,
		kubeCache:              make(map[string]KubeCache),
		proxyStatusNamespaces:  make(map[string]map[string]podProxyStatus),
		refreshDuration:        time.Duration(cfg.KubernetesConfig.CacheDuration) * time.Second,
		tokenNamespaces:        make(map[string]namespaceCache),
		tokenNamespaceDuration: time.Duration(cfg.KubernetesConfig.CacheTokenNamespaceDuration) * time.Second,
	}

	// Starting background goroutines to:
	// 1. Refresh the cache's service account token
	// 2. Poll for istiod's proxy status.
	// These will stop when the context is cancelled.
	ctx, cancel := context.WithCancel(context.Background())
	if cfg.ExternalServices.Istio.IstioAPIEnabled {
		kialiCacheImpl.pollIstiodForProxyStatus(ctx)
	}

	kialiCacheImpl.watchForClientChanges(ctx, clientManager.KialiSAHomeCluster().GetToken())

	kialiCacheImpl.cleanup = func() {
		cancel()
	}

	for cluster, kialiClient := range clientManager.KialiSAClients() {
		cache, err := NewKubeCache(kialiClient, cfg, NewRegistryHandler(kialiCacheImpl.RefreshRegistryStatus), namespaceSeedList...)
		if err != nil {
			log.Errorf("[Kiali Cache] Error creating kube cache for cluster: %s. Err: %v", cluster, err)
			return nil, err
		}
		kialiCacheImpl.kubeCache[cluster] = cache
	}

	// TODO: Treat all clusters the same way.
	kialiCacheImpl.KubeCache = kialiCacheImpl.kubeCache["home"]

	return &kialiCacheImpl, nil
}

// Stops all caches across all clusters.
func (c *kialiCacheImpl) Stop() {
	log.Infof("Stopping Kiali Cache")

	wg := sync.WaitGroup{}
	for _, kc := range c.kubeCache {
		wg.Add(1)
		go func(c KubeCache) {
			defer wg.Done()
			c.Stop()
		}(kc)
	}
	wg.Wait()

	c.cleanup()
}

// watchForClientChanges watches for changes to the cache's service account client
// and recreates the cache(s) when the client changes. The client is updated when
// the token for the client changes.
func (c *kialiCacheImpl) watchForClientChanges(ctx context.Context, token string) {
	ticker := time.NewTicker(60 * time.Second)
	go func() {
		for {
			select {
			case <-ticker.C:
				if c.clientManager.KialiSAHomeCluster().GetToken() != token {
					log.Info("[Kiali Cache] Updating cache with new token")
					c.KubeCache.UpdateClient(c.clientManager.KialiSAHomeCluster())
					token = c.clientManager.KialiSAHomeCluster().GetToken()
				} else {
					log.Debug("[Kiali Cache] Nothing to refresh")
				}
			case <-ctx.Done():
				log.Debug("[Kiali Cache] Stopping watching for service account token changes")
				ticker.Stop()
				return
			}
		}
	}()
}
