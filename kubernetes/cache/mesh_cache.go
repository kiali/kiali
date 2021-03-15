package cache

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/tools/cache"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type (
	IstioCache interface {
		CheckIstioResource(resourceType string) bool
		GetIstioObjects(namespace string, resourceType string, labelSelector string) ([]kubernetes.IstioObject, error)
	}

	KialiMeshCache interface {
		// Control methods
		// Check if a namespace is listed to be cached; if yes, creates a cache for that namespace
		CheckNamespace(namespace string) bool

		// Clear a namespace's cache
		RefreshNamespace(namespace string)
		// Stop all caches
		Stop()

		IstioCache
		ProxyStatusCache
	}

	kialiMeshCacheImpl struct {
		istioClient            kubernetes.MeshK8SClient
		k8sApi                 kube.Interface
		istioNetworkingGetter  cache.Getter
		istioSecurityGetter    cache.Getter
		refreshDuration        time.Duration
		cacheNamespaces        []string
		cacheIstioTypes        map[string]bool
		stopChan               map[string]chan struct{}
		nsCache                map[string]typeCache
		cacheLock              sync.Mutex
		tokenLock              sync.RWMutex
		tokenNamespaces        map[string]namespaceCache
		tokenNamespaceDuration time.Duration
		proxyStatusLock        sync.RWMutex
		proxyStatusCreated     *time.Time
		proxyStatusNamespaces  map[string]map[string]podProxyStatus
	}
)

func (c *kialiMeshCacheImpl) CheckIstioResource(resourceType string) bool {
	// cacheIstioTypes stores the single types but for compatibility with kubernetes api resourceType will use plurals
	_, exist := c.cacheIstioTypes[kubernetes.PluralType[resourceType]]
	return exist
}

func (c *kialiMeshCacheImpl) createIstioInformers(namespace string, informer *typeCache) {
	// Networking API
	if c.CheckIstioResource(kubernetes.VirtualServices) {
		(*informer)[kubernetes.VirtualServices] = createIstioIndexInformer(c.istioNetworkingGetter, kubernetes.VirtualServices, c.refreshDuration, namespace)
	}
	if c.CheckIstioResource(kubernetes.DestinationRules) {
		(*informer)[kubernetes.DestinationRules] = createIstioIndexInformer(c.istioNetworkingGetter, kubernetes.DestinationRules, c.refreshDuration, namespace)
	}
	if c.CheckIstioResource(kubernetes.Gateways) {
		(*informer)[kubernetes.Gateways] = createIstioIndexInformer(c.istioNetworkingGetter, kubernetes.Gateways, c.refreshDuration, namespace)
	}
	if c.CheckIstioResource(kubernetes.ServiceEntries) {
		(*informer)[kubernetes.ServiceEntries] = createIstioIndexInformer(c.istioNetworkingGetter, kubernetes.ServiceEntries, c.refreshDuration, namespace)
	}
	if c.CheckIstioResource(kubernetes.Sidecars) {
		(*informer)[kubernetes.Sidecars] = createIstioIndexInformer(c.istioNetworkingGetter, kubernetes.Sidecars, c.refreshDuration, namespace)
	}
	if c.CheckIstioResource(kubernetes.PeerAuthentications) {
		(*informer)[kubernetes.PeerAuthentications] = createIstioIndexInformer(c.istioSecurityGetter, kubernetes.PeerAuthentications, c.refreshDuration, namespace)
	}
	if c.CheckIstioResource(kubernetes.RequestAuthentications) {
		(*informer)[kubernetes.RequestAuthentications] = createIstioIndexInformer(c.istioSecurityGetter, kubernetes.RequestAuthentications, c.refreshDuration, namespace)
	}
	if c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
		(*informer)[kubernetes.AuthorizationPolicies] = createIstioIndexInformer(c.istioSecurityGetter, kubernetes.AuthorizationPolicies, c.refreshDuration, namespace)
	}
}
func (c *kialiKubeCacheImpl) isIstioSynced(namespace string) bool {
	return true
}
func (c *kialiMeshCacheImpl) isIstioSynced(namespace string) bool {
	var isSynced bool
	if nsCache, exist := c.nsCache[namespace]; exist {
		isSynced = true
		if c.CheckIstioResource(kubernetes.VirtualServices) {
			isSynced = isSynced && nsCache[kubernetes.VirtualServices].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.DestinationRules) {
			isSynced = isSynced && nsCache[kubernetes.DestinationRules].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.Gateways) {
			isSynced = isSynced && nsCache[kubernetes.Gateways].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.ServiceEntries) {
			isSynced = isSynced && nsCache[kubernetes.ServiceEntries].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.Sidecars) {
			isSynced = isSynced && nsCache[kubernetes.Sidecars].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.PeerAuthentications) {
			isSynced = isSynced && nsCache[kubernetes.PeerAuthentications].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.RequestAuthentications) {
			isSynced = isSynced && nsCache[kubernetes.RequestAuthentications].HasSynced()
		}
		if c.CheckIstioResource(kubernetes.AuthorizationPolicies) {
			isSynced = isSynced && nsCache[kubernetes.AuthorizationPolicies].HasSynced()
		}
	} else {
		isSynced = false
	}
	return isSynced
}

func createIstioIndexInformer(getter cache.Getter, resourceType string, refreshDuration time.Duration, namespace string) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(cache.NewListWatchFromClient(getter, resourceType, namespace, fields.Everything()),
		&kubernetes.GenericIstioObject{},
		refreshDuration,
		cache.Indexers{},
	)
}

func (c *kialiMeshCacheImpl) GetIstioObjects(namespace string, resourceType string, labelSelector string) ([]kubernetes.IstioObject, error) {
	if !c.CheckIstioResource(resourceType) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resourceType: %s]", resourceType)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		resources := nsCache[resourceType].GetStore().List()
		lenResources := len(resources)
		if lenResources > 0 {
			_, ok := resources[0].(*kubernetes.GenericIstioObject)
			if !ok {
				return nil, fmt.Errorf("bad GenericIstioObject type found in cache for [resourceType: %s]", resourceType)
			}
			iResources := make([]kubernetes.IstioObject, lenResources)
			for i, r := range resources {
				iResources[i] = (r.(*kubernetes.GenericIstioObject)).DeepCopyIstioObject()
				// TODO iResource[i].SetTypeMeta(typeMeta) is missing/needed ??
			}
			if labelSelector != "" {
				if selector, err := labels.Parse(labelSelector); err == nil {
					iResources = kubernetes.FilterIstioObjectsForSelector(selector, iResources)
				} else {
					return []kubernetes.IstioObject{}, err
				}
			}
			log.Tracef("[Kiali Cache] Get [resourceType: %s] for [namespace: %s] =  %d", resourceType, namespace, lenResources)
			return iResources, nil
		}
	}
	return []kubernetes.IstioObject{}, nil
}

func NewKialiMeshCache() (KialiMeshCache, error) {
	config, err := kubernetes.ConfigClient(kubernetes.Primary)
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
	istioClient, err := kubernetes.NewMeshClientFromConfig(&istioConfig)
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

	kialiCacheImpl := kialiMeshCacheImpl{
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
func (c *kialiMeshCacheImpl) isCached(namespace string) bool {
	for _, cacheNs := range c.cacheNamespaces {
		if matches, _ := regexp.MatchString(strings.TrimSpace(cacheNs), namespace); matches {
			return true
		}
	}
	return false
}

func (c *kialiMeshCacheImpl) createCache(namespace string) bool {
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
func (c *kialiMeshCacheImpl) CheckNamespace(namespace string) bool {
	if !c.isCached(namespace) {
		return false
	}
	if _, exist := c.nsCache[namespace]; !exist {
		defer c.cacheLock.Unlock()
		c.cacheLock.Lock()
		return c.createCache(namespace)
	}
	return c.isKubernetesSynced(namespace) && c.isIstioSynced(namespace)
}

// RefreshNamespace will delete the specific namespace's cache and create a new one.
func (c *kialiMeshCacheImpl) RefreshNamespace(namespace string) {
	defer c.cacheLock.Unlock()
	c.cacheLock.Lock()
	if nsChan, exist := c.stopChan[namespace]; exist {
		close(nsChan)
		delete(c.stopChan, namespace)
	}
	delete(c.nsCache, namespace)
	c.createCache(namespace)
}

func (c *kialiMeshCacheImpl) Stop() {
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
