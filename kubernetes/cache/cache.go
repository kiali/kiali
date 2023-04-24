package cache

import (
	"context"
	"errors"
	"fmt"
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
	GetKubeCaches() map[string]KubeCache
	GetKubeCache(cluster string) (KubeCache, error)

	// Embedded for backward compatibility for business methods that just use one cluster.
	// All business methods should eventually use the multi-cluster cache.
	KubeCache
	NamespacesCache
	ProxyStatusCache
	RegistryStatusCache
}

// namespaceCache caches namespaces according to their token.
type namespaceCache struct {
	created          time.Time
	namespaces       []models.Namespace                     // Merge namespaces with the same name and cluster
	clusterNamespace map[string]map[string]models.Namespace // By cluster, by namespace name
}

type podProxyStatus struct {
	cluster     string
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
	clientFactory kubernetes.ClientFactory
	// How often the cache will check for kiali SA client changes.
	clientRefreshPollingPeriod time.Duration
	// Maps a cluster name to a KubeCache
	kubeCache              map[string]KubeCache
	refreshDuration        time.Duration
	tokenLock              sync.RWMutex
	tokenNamespaces        map[string]namespaceCache // TODO: Another option can be define here the namespaces by token/cluster
	tokenNamespaceDuration time.Duration
	proxyStatusLock        sync.RWMutex
	proxyStatusNamespaces  map[string]map[string]map[string]podProxyStatus
	registryStatusLock     sync.RWMutex
	registryStatusCreated  *time.Time
	registryStatus         *kubernetes.RegistryStatus
}

func NewKialiCache(clientFactory kubernetes.ClientFactory, cfg config.Config, namespaceSeedList ...string) (KialiCache, error) {
	kialiCacheImpl := kialiCacheImpl{
		clientFactory:              clientFactory,
		clientRefreshPollingPeriod: time.Duration(time.Second * 60),
		kubeCache:                  make(map[string]KubeCache),
		proxyStatusNamespaces:      make(map[string]map[string]map[string]podProxyStatus),
		refreshDuration:            time.Duration(cfg.KubernetesConfig.CacheDuration) * time.Second,
		tokenNamespaces:            make(map[string]namespaceCache),
		tokenNamespaceDuration:     time.Duration(cfg.KubernetesConfig.CacheTokenNamespaceDuration) * time.Second,
	}

	for cluster, client := range clientFactory.GetSAClients() {
		cache, err := NewKubeCache(client, cfg, NewRegistryHandler(kialiCacheImpl.RefreshRegistryStatus), namespaceSeedList...)
		if err != nil {
			log.Errorf("[Kiali Cache] Error creating kube cache for cluster: [%s]. Err: %v", cluster, err)
			return nil, err
		}
		log.Infof("[Kiali Cache] Kube cache is active for cluster: [%s] and namespaces: %v", cluster, namespaceSeedList)

		kialiCacheImpl.kubeCache[cluster] = cache

		// TODO: Treat all clusters the same way.
		if cluster == cfg.KubernetesConfig.ClusterName {
			kialiCacheImpl.KubeCache = cache
		}
	}

	// TODO: Treat all clusters the same way.
	// Ensure home client got set.
	if kialiCacheImpl.KubeCache == nil {
		return nil, errors.New("home cluster not configured in kiali cache")
	}

	// Starting background goroutines to:
	// 1. Refresh the cache's service account token
	// 2. Poll for istiod's proxy status.
	// These will stop when the context is cancelled.
	// Starting goroutines after any errors are handled so as not to leak goroutines.
	ctx, cancel := context.WithCancel(context.Background())
	if cfg.ExternalServices.Istio.IstioAPIEnabled {
		kialiCacheImpl.pollIstiodForProxyStatus(ctx)
	}

	// Note that this only watches for changes to the home cluster's token since it is
	// expected that the remote cluster tokens will not change. However, that assumption
	// may be wrong and in the future the cache may want to watch for changes to all client tokens.
	kialiCacheImpl.watchForClientChanges(ctx, clientFactory.GetSAHomeClusterClient().GetToken())

	kialiCacheImpl.cleanup = cancel

	return &kialiCacheImpl, nil
}

// GetKubeCaches returns a kube cache for every configured Kiali Service Account client keyed by cluster name.
func (c *kialiCacheImpl) GetKubeCaches() map[string]KubeCache {
	return c.kubeCache
}

func (c *kialiCacheImpl) GetKubeCache(cluster string) (KubeCache, error) {
	cache, found := c.kubeCache[cluster]
	if !found {
		// This should not happen but it probably means the user clients have clusters that the cache doesn't know about.
		return nil, fmt.Errorf("cache for cluster [%s] not found", cluster)
	}
	return cache, nil
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
	ticker := time.NewTicker(c.clientRefreshPollingPeriod)
	go func() {
		for {
			select {
			case <-ticker.C:
				if c.clientFactory.GetSAHomeClusterClient().GetToken() != token {
					log.Info("[Kiali Cache] Updating cache with new token")

					if err := c.KubeCache.UpdateClient(c.clientFactory.GetSAHomeClusterClient()); err != nil {
						log.Errorf("[Kiali Cache] Error updating cache with new token. Err: %s", err)
						// Try again on the next tick without updating the token.
						continue
					}

					token = c.clientFactory.GetSAHomeClusterClient().GetToken()
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
