package cache

import (
	"regexp"
	"strings"
	"sync"
	"time"

	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// Istio uses caches for pods and controllers.
// Kiali will use caches for specific namespaces and types
// https://github.com/istio/istio/blob/master/mixer/adapter/kubernetesenv/cache.go

type (
	KialiCache interface {
		// Control methods
		// Check if a namespace is listed to be cached; if yes, creates a cache for that namespace
		CheckNamespace(namespace string) bool

		// Clear a namespace's cache
		RefreshNamespace(namespace string)
		// Stop all caches
		Stop()

		KubernetesCache
		IstioCache
		NamespacesCache
		ProxyStatusCache
	}

	// This map will store Informers per specific types
	// i.e. map["Deployment"], map["Service"]
	typeCache map[string]cache.SharedIndexInformer

	namespaceCache struct {
		created       time.Time
		namespaces    []models.Namespace
		nameNamespace map[string]models.Namespace
	}

	podProxyStatus struct {
		namespace   string
		pod         string
		proxyStatus *kubernetes.ProxyStatus
	}

	kialiCacheImpl struct {
		istioClient            kubernetes.K8SClient
		k8sApi                 kube.Interface
		istioNetworkingGetter  cache.Getter
		istioSecurityGetter    cache.Getter
		refreshDuration        time.Duration
		cacheNamespaces        []string
		cacheIstioTypes        map[string]bool
		stopChan               map[string]chan struct{}
		nsCache                map[string]typeCache
		cacheLock              sync.RWMutex
		tokenLock              sync.RWMutex
		tokenNamespaces        map[string]namespaceCache
		tokenNamespaceDuration time.Duration
		proxyStatusLock        sync.RWMutex
		proxyStatusCreated     *time.Time
		proxyStatusNamespaces  map[string]map[string]podProxyStatus
	}
)

func NewKialiCache() (KialiCache, error) {
	config, err := kubernetes.ConfigClient()
	if err != nil {
		return nil, err
	}
	// Kiali Cache will use ServiceAccount token instead of user token
	// Cache creates watchers that have a long cycle to sync with k8s backend maintaining a cache from events
	// Cache will be used only for *Get* operations, update/delete operations will executed directly against the API
	// Cache will see what ServiceAccount can see, so when using OpenShift scenarios, user token is used to fetch the
	// list of projects/namespaces a specific user can see. When using cache, business layer needs to check if a
	// specific user can see a specific namespace
	cacheToken := ""
	kConfig := kialiConfig.Get()
	if kConfig.InCluster {
		if saToken, err := kubernetes.GetKialiToken(); err != nil {
			return nil, err
		} else {
			cacheToken = saToken
		}
	}
	istioConfig := rest.Config{
		Host:            config.Host,
		TLSClientConfig: config.TLSClientConfig,
		QPS:             config.QPS,
		BearerToken:     cacheToken,
		Burst:           config.Burst,
	}
	istioClient, err := kubernetes.NewClientFromConfig(&istioConfig)
	if err != nil {
		return nil, err
	}

	refreshDuration := time.Duration(kConfig.KubernetesConfig.CacheDuration) * time.Second
	tokenNamespaceDuration := time.Duration(kConfig.KubernetesConfig.CacheTokenNamespaceDuration) * time.Second
	cacheNamespaces := kConfig.KubernetesConfig.CacheNamespaces
	cacheIstioTypes := make(map[string]bool)
	for _, iType := range kConfig.KubernetesConfig.CacheIstioTypes {
		cacheIstioTypes[iType] = true
	}
	log.Tracef("[Kiali Cache] cacheIstioTypes %v", cacheIstioTypes)

	stopChan := make(map[string]chan struct{})

	for _, ns := range cacheNamespaces {
		stopChan[ns] = make(chan struct{})
	}

	kialiCacheImpl := kialiCacheImpl{
		istioClient:            *istioClient,
		refreshDuration:        refreshDuration,
		cacheNamespaces:        cacheNamespaces,
		cacheIstioTypes:        cacheIstioTypes,
		stopChan:               stopChan,
		nsCache:                make(map[string]typeCache),
		tokenNamespaces:        make(map[string]namespaceCache),
		tokenNamespaceDuration: tokenNamespaceDuration,
		proxyStatusNamespaces:  make(map[string]map[string]podProxyStatus),
	}

	kialiCacheImpl.k8sApi = istioClient.GetK8sApi()
	kialiCacheImpl.istioNetworkingGetter = istioClient.GetIstioNetworkingApi()
	kialiCacheImpl.istioSecurityGetter = istioClient.GetIstioSecurityApi()

	log.Infof("Kiali Cache is active for namespaces %v", cacheNamespaces)
	return &kialiCacheImpl, nil
}

// It will indicate if a namespace should have a cache
func (c *kialiCacheImpl) isCached(namespace string) bool {
	for _, cacheNs := range c.cacheNamespaces {
		if matches, _ := regexp.MatchString(strings.TrimSpace(cacheNs), namespace); matches {
			return true
		}
	}
	return false
}

func (c *kialiCacheImpl) createCache(namespace string) bool {
	if _, exist := c.nsCache[namespace]; exist {
		return true
	}
	informer := make(typeCache)
	c.createKubernetesInformers(namespace, &informer)
	c.createIstioInformers(namespace, &informer)
	c.nsCache[namespace] = informer

	if _, exist := c.stopChan[namespace]; !exist {
		c.stopChan[namespace] = make(chan struct{})
	}

	go func(stopCh <-chan struct{}) {
		for _, informer := range c.nsCache[namespace] {
			go informer.Run(stopCh)
		}
		<-stopCh
		log.Infof("Kiali cache for [namespace: %s] stopped", namespace)
	}(c.stopChan[namespace])

	log.Infof("Waiting for Kiali cache for [namespace: %s] to sync", namespace)
	isSynced := func() bool {
		hasSynced := true
		for _, informer := range c.nsCache[namespace] {
			hasSynced = hasSynced && informer.HasSynced()
		}
		return hasSynced
	}
	if synced := cache.WaitForCacheSync(c.stopChan[namespace], isSynced); !synced {
		c.stopChan[namespace] <- struct{}{}
		log.Errorf("Kiali cache for [namespace: %s] sync failure", namespace)
		return false
	}
	log.Infof("Kiali cache for [namespace: %s] started", namespace)

	return true
}

// CheckNamespace will
// - Validate if a namespace is included in the cache
// - Create and initialize a cache
// - Validate if a cache is synced
func (c *kialiCacheImpl) CheckNamespace(namespace string) bool {
	if !c.isCached(namespace) {
		return false
	}

	c.cacheLock.RLock()
	_, isNsCached := c.nsCache[namespace]
	c.cacheLock.RUnlock()

	if !isNsCached {
		defer c.cacheLock.Unlock()
		c.cacheLock.Lock()
		return c.createCache(namespace)
	}
	return c.isKubernetesSynced(namespace) && c.isIstioSynced(namespace)
}

// RefreshNamespace will delete the specific namespace's cache and create a new one.
func (c *kialiCacheImpl) RefreshNamespace(namespace string) {
	defer c.cacheLock.Unlock()
	c.cacheLock.Lock()
	if nsChan, exist := c.stopChan[namespace]; exist {
		close(nsChan)
		delete(c.stopChan, namespace)
	}
	delete(c.nsCache, namespace)
	c.createCache(namespace)
}

func (c *kialiCacheImpl) Stop() {
	log.Infof("Stopping Kiali Cache")
	defer c.cacheLock.Unlock()
	c.cacheLock.Lock()
	for namespace, nsChan := range c.stopChan {
		close(nsChan)
		delete(c.stopChan, namespace)
	}
	log.Infof("Clearing Kiali Cache")
	for ns := range c.nsCache {
		delete(c.nsCache, ns)
	}
}
