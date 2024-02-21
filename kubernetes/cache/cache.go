package cache

import (
	"errors"
	"fmt"
	"sync"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/store"
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

	// GetClusters returns the list of clusters that the cache knows about.
	// This gets set by the mesh service.
	GetClusters() []kubernetes.Cluster

	// SetClusters sets the list of clusters that the cache knows about.
	SetClusters([]kubernetes.Cluster)

	// Embedded for backward compatibility for business methods that just use one cluster.
	// All business methods should eventually use the multi-cluster cache.
	// Instead of using the interface directly for kube objects, use the GetKubeCache() method.
	KubeCache

	RegistryStatusCache
	ProxyStatusCache
	NamespacesCache

	// IsAmbientEnabled determines if ambient is enabled in the cluster.
	IsAmbientEnabled(cluster string) bool
}

// namespaceCache caches namespaces according to their token.
type namespaceCache struct {
	created          time.Time
	namespaces       []models.Namespace                     // Merge namespaces with the same name and cluster
	clusterNamespace map[string]map[string]models.Namespace // By cluster, by namespace name
}

type kialiCacheImpl struct {
	ambientEnabled        *bool
	ambientLastUpdateTime *time.Time
	conf                  config.Config

	// Embedded for backward compatibility for business methods that just use one cluster.
	// All business methods should eventually use the multi-cluster cache.
	// TODO: Get rid of embedding.
	KubeCache

	clientFactory kubernetes.ClientFactory
	// Maps a cluster name to a KubeCache
	kubeCache              map[string]KubeCache
	refreshDuration        time.Duration
	tokenLock              sync.RWMutex
	tokenNamespaces        map[string]namespaceCache // TODO: Another option can be define here the namespaces by token/cluster
	tokenNamespaceDuration time.Duration
	// ProxyStatusStore stores the proxy status and should be key'd off cluster + namespace + pod.
	proxyStatusStore store.Store[*kubernetes.ProxyStatus]
	// RegistryStatusStore stores the registry status and should be key'd off of the cluster name.
	registryStatusStore store.Store[*kubernetes.RegistryStatus]

	// Info about the kube clusters that the cache knows about.
	clusters    []kubernetes.Cluster
	clusterLock sync.RWMutex
}

func NewKialiCache(clientFactory kubernetes.ClientFactory, cfg config.Config) (KialiCache, error) {
	kialiCacheImpl := kialiCacheImpl{
		clientFactory:          clientFactory,
		conf:                   cfg,
		kubeCache:              make(map[string]KubeCache),
		refreshDuration:        time.Duration(cfg.KubernetesConfig.CacheDuration) * time.Second,
		tokenNamespaces:        make(map[string]namespaceCache),
		tokenNamespaceDuration: time.Duration(cfg.KubernetesConfig.CacheTokenNamespaceDuration) * time.Second,
		proxyStatusStore:       store.New[*kubernetes.ProxyStatus](),
		registryStatusStore:    store.New[*kubernetes.RegistryStatus](),
	}

	for cluster, client := range clientFactory.GetSAClients() {
		cache, err := NewKubeCache(client, cfg)
		if err != nil {
			log.Errorf("[Kiali Cache] Error creating kube cache for cluster: [%s]. Err: %v", cluster, err)
			return nil, err
		}
		log.Infof("[Kiali Cache] Kube cache is active for cluster: [%s]", cluster)

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
}

func (c *kialiCacheImpl) GetClusters() []kubernetes.Cluster {
	defer c.clusterLock.RUnlock()
	c.clusterLock.RLock()
	return c.clusters
}

func (c *kialiCacheImpl) SetClusters(clusters []kubernetes.Cluster) {
	defer c.clusterLock.Unlock()
	c.clusterLock.Lock()
	c.clusters = clusters
}

// Check if istio Ambient profile was enabled
// ATM it is defined in the istio-cni-config configmap
func (in *kialiCacheImpl) IsAmbientEnabled(cluster string) bool {
	currentTime := time.Now()
	if in.ambientLastUpdateTime == nil {
		in.ambientLastUpdateTime = new(time.Time)
		in.ambientLastUpdateTime = &currentTime
	}

	if in.ambientEnabled == nil || currentTime.Sub(*in.ambientLastUpdateTime) > time.Minute {
		in.ambientEnabled = new(bool)
		kubeCache, err := in.GetKubeCache(cluster)
		if err != nil {
			log.Debugf("Unable to get kube cache when checking for ambient profile: %s", err)
			return false
		}

		_, err = kubeCache.GetDaemonSet(in.conf.IstioNamespace, "ztunnel")
		if err != nil {
			if k8serrors.IsNotFound(err) {
				log.Debugf("No ztunnel found in istio namespace: %s ", err.Error())
			} else {
				log.Debugf("Error checking for ztunnel in istio namespace: %s", err.Error())
			}
			return false
		}

		*in.ambientEnabled = true
		in.ambientLastUpdateTime = &currentTime
	}

	return *in.ambientEnabled
}

// Interface guard for kiali cache impl
var _ KialiCache = (*kialiCacheImpl)(nil)
