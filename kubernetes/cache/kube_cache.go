package cache

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/informers"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

type (
	KubernetesCache interface {
		GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error)
		GetDeployments(namespace string) ([]apps_v1.Deployment, error)
		GetDeployment(namespace, name string) (*apps_v1.Deployment, error)
		GetEndpoints(namespace, name string) (*core_v1.Endpoints, error)
		GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error)
		GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error)
		GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error)
		GetService(namespace string, name string) (*core_v1.Service, error)
		GetPods(namespace, labelSelector string) ([]core_v1.Pod, error)
		GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error)
	}

	KialiKubeCache interface {
		// Control methods
		// Check if a namespace is listed to be cached; if yes, creates a cache for that namespace
		CheckNamespace(namespace string) bool

		// Clear a namespace's cache
		RefreshNamespace(namespace string)
		// Stop all caches
		Stop()

		KubernetesCache
		NamespacesCache
	}

	kialiKubeCacheImpl struct {
		istioClient            kubernetes.KubeK8SClient
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

func NewKialiKubeCache() (KialiKubeCache, error) {
	config, err := kubernetes.ConfigClient(kubernetes.Remote)
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
	istioClient, err := kubernetes.NewKubeClientFromConfig(&istioConfig)
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

	kialiCacheImpl := kialiKubeCacheImpl{
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
	//kialiCacheImpl.istioNetworkingGetter = istioClient.GetIstioNetworkingApi()
	//kialiCacheImpl.istioSecurityGetter = istioClient.GetIstioSecurityApi()

	log.Infof("Kiali Cache is active for namespaces %v", cacheNamespaces)
	return &kialiCacheImpl, nil
}

// It will indicate if a namespace should have a cache
func (c *kialiKubeCacheImpl) isCached(namespace string) bool {
	for _, cacheNs := range c.cacheNamespaces {
		if matches, _ := regexp.MatchString(strings.TrimSpace(cacheNs), namespace); matches {
			return true
		}
	}
	return false
}

func (c *kialiKubeCacheImpl) createCache(namespace string) bool {
	if _, exist := c.nsCache[namespace]; exist {
		return true
	}
	informer := make(typeCache)
	c.createKubernetesInformers(namespace, &informer)
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
func (c *kialiKubeCacheImpl) CheckNamespace(namespace string) bool {
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
func (c *kialiKubeCacheImpl) RefreshNamespace(namespace string) {
	defer c.cacheLock.Unlock()
	c.cacheLock.Lock()
	if nsChan, exist := c.stopChan[namespace]; exist {
		close(nsChan)
		delete(c.stopChan, namespace)
	}
	delete(c.nsCache, namespace)
	c.createCache(namespace)
}

func (c *kialiKubeCacheImpl) Stop() {
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

func (c *kialiKubeCacheImpl) createKubernetesInformers(namespace string, informer *typeCache) {
	sharedInformers := informers.NewSharedInformerFactoryWithOptions(c.k8sApi, c.refreshDuration, informers.WithNamespace(namespace))
	(*informer)[kubernetes.DeploymentType] = sharedInformers.Apps().V1().Deployments().Informer()
	(*informer)[kubernetes.StatefulSetType] = sharedInformers.Apps().V1().StatefulSets().Informer()
	(*informer)[kubernetes.ReplicaSetType] = sharedInformers.Apps().V1().ReplicaSets().Informer()
	(*informer)[kubernetes.ServiceType] = sharedInformers.Core().V1().Services().Informer()
	(*informer)[kubernetes.PodType] = sharedInformers.Core().V1().Pods().Informer()
	(*informer)[kubernetes.ConfigMapType] = sharedInformers.Core().V1().ConfigMaps().Informer()
	(*informer)[kubernetes.EndpointsType] = sharedInformers.Core().V1().Endpoints().Informer()
}
func (c *kialiMeshCacheImpl) createKubernetesInformers(namespace string, informer *typeCache) {
	sharedInformers := informers.NewSharedInformerFactoryWithOptions(c.k8sApi, c.refreshDuration, informers.WithNamespace(namespace))
	(*informer)[kubernetes.DeploymentType] = sharedInformers.Apps().V1().Deployments().Informer()
	(*informer)[kubernetes.StatefulSetType] = sharedInformers.Apps().V1().StatefulSets().Informer()
	(*informer)[kubernetes.ReplicaSetType] = sharedInformers.Apps().V1().ReplicaSets().Informer()
	(*informer)[kubernetes.ServiceType] = sharedInformers.Core().V1().Services().Informer()
	(*informer)[kubernetes.PodType] = sharedInformers.Core().V1().Pods().Informer()
	(*informer)[kubernetes.ConfigMapType] = sharedInformers.Core().V1().ConfigMaps().Informer()
	(*informer)[kubernetes.EndpointsType] = sharedInformers.Core().V1().Endpoints().Informer()
}
func (c *kialiKubeCacheImpl) isKubernetesSynced(namespace string) bool {
	var isSynced bool
	if nsCache, exist := c.nsCache[namespace]; exist {
		isSynced = nsCache[kubernetes.DeploymentType].HasSynced() &&
			nsCache[kubernetes.StatefulSetType].HasSynced() &&
			nsCache[kubernetes.ReplicaSetType].HasSynced() &&
			nsCache[kubernetes.ServiceType].HasSynced() &&
			nsCache[kubernetes.PodType].HasSynced() &&
			nsCache[kubernetes.ConfigMapType].HasSynced() &&
			nsCache[kubernetes.EndpointsType].HasSynced()
	} else {
		isSynced = false
	}
	return isSynced
}
func (c *kialiMeshCacheImpl) isKubernetesSynced(namespace string) bool {
	var isSynced bool
	if nsCache, exist := c.nsCache[namespace]; exist {
		isSynced = nsCache[kubernetes.DeploymentType].HasSynced() &&
			nsCache[kubernetes.StatefulSetType].HasSynced() &&
			nsCache[kubernetes.ReplicaSetType].HasSynced() &&
			nsCache[kubernetes.ServiceType].HasSynced() &&
			nsCache[kubernetes.PodType].HasSynced() &&
			nsCache[kubernetes.ConfigMapType].HasSynced() &&
			nsCache[kubernetes.EndpointsType].HasSynced()
	} else {
		isSynced = false
	}
	return isSynced
}
func (c *kialiKubeCacheImpl) GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.ConfigMapType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			cm, ok := obj.(*core_v1.ConfigMap)
			if !ok {
				return nil, errors.New("bad ConfigMap type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: ConfigMap] for [namespace: %s] [name: %s]", namespace, name)
			return cm, nil
		}
	}
	return nil, nil
}
func (c *kialiMeshCacheImpl) GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.ConfigMapType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			cm, ok := obj.(*core_v1.ConfigMap)
			if !ok {
				return nil, errors.New("bad ConfigMap type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: ConfigMap] for [namespace: %s] [name: %s]", namespace, name)
			return cm, nil
		}
	}
	return nil, nil
}
func (c *kialiKubeCacheImpl) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		deps := nsCache[kubernetes.DeploymentType].GetStore().List()
		lenDeps := len(deps)
		if lenDeps > 0 {
			_, ok := deps[0].(*apps_v1.Deployment)
			if !ok {
				return nil, errors.New("bad Deployment type found in cache")
			}
			nsDeps := make([]apps_v1.Deployment, lenDeps)
			for i, dep := range deps {
				nsDeps[i] = *(dep.(*apps_v1.Deployment))
			}
			log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] = %d", namespace, lenDeps)
			return nsDeps, nil
		}
	}
	return []apps_v1.Deployment{}, nil
}
func (c *kialiMeshCacheImpl) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		deps := nsCache[kubernetes.DeploymentType].GetStore().List()
		lenDeps := len(deps)
		if lenDeps > 0 {
			_, ok := deps[0].(*apps_v1.Deployment)
			if !ok {
				return nil, errors.New("bad Deployment type found in cache")
			}
			nsDeps := make([]apps_v1.Deployment, lenDeps)
			for i, dep := range deps {
				nsDeps[i] = *(dep.(*apps_v1.Deployment))
			}
			log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] = %d", namespace, lenDeps)
			return nsDeps, nil
		}
	}
	return []apps_v1.Deployment{}, nil
}
func (c *kialiKubeCacheImpl) GetDeployment(namespace, name string) (*apps_v1.Deployment, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.DeploymentType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			dep, ok := obj.(*apps_v1.Deployment)
			if !ok {
				return nil, errors.New("bad Deployment type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] [name: %s]", namespace, name)
			return dep, nil
		}
	}
	return nil, nil
}
func (c *kialiMeshCacheImpl) GetDeployment(namespace, name string) (*apps_v1.Deployment, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.DeploymentType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			dep, ok := obj.(*apps_v1.Deployment)
			if !ok {
				return nil, errors.New("bad Deployment type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] [name: %s]", namespace, name)
			return dep, nil
		}
	}
	return nil, nil
}
func (c *kialiKubeCacheImpl) GetEndpoints(namespace, name string) (*core_v1.Endpoints, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.EndpointsType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			eps, ok := obj.(*core_v1.Endpoints)
			if !ok {
				return nil, errors.New("bad Endpoints type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Endpoints] for [namespace: %s] [name: %s]", namespace, name)
			return eps, nil
		}
	}
	return nil, nil
}
func (c *kialiMeshCacheImpl) GetEndpoints(namespace, name string) (*core_v1.Endpoints, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.EndpointsType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			eps, ok := obj.(*core_v1.Endpoints)
			if !ok {
				return nil, errors.New("bad Endpoints type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Endpoints] for [namespace: %s] [name: %s]", namespace, name)
			return eps, nil
		}
	}
	return nil, nil
}
func (c *kialiKubeCacheImpl) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		ss := nsCache[kubernetes.StatefulSetType].GetStore().List()
		lenSs := len(ss)
		if lenSs > 0 {
			_, ok := ss[0].(*apps_v1.StatefulSet)
			if !ok {
				return nil, errors.New("bad StatefulSet type found in cache")
			}
			nsSs := make([]apps_v1.StatefulSet, lenSs)
			for i, s := range ss {
				nsSs[i] = *(s.(*apps_v1.StatefulSet))
			}
			log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] = %d", namespace, lenSs)
			return nsSs, nil
		}
	}
	return []apps_v1.StatefulSet{}, nil
}
func (c *kialiMeshCacheImpl) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		ss := nsCache[kubernetes.StatefulSetType].GetStore().List()
		lenSs := len(ss)
		if lenSs > 0 {
			_, ok := ss[0].(*apps_v1.StatefulSet)
			if !ok {
				return nil, errors.New("bad StatefulSet type found in cache")
			}
			nsSs := make([]apps_v1.StatefulSet, lenSs)
			for i, s := range ss {
				nsSs[i] = *(s.(*apps_v1.StatefulSet))
			}
			log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] = %d", namespace, lenSs)
			return nsSs, nil
		}
	}
	return []apps_v1.StatefulSet{}, nil
}

func (c *kialiKubeCacheImpl) GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.StatefulSetType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			ss, ok := obj.(*apps_v1.StatefulSet)
			if !ok {
				return nil, errors.New("bad StatefulSet type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] [name: %s]", namespace, name)
			return ss, nil
		}
	}
	return nil, nil
}
func (c *kialiMeshCacheImpl) GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.StatefulSetType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			ss, ok := obj.(*apps_v1.StatefulSet)
			if !ok {
				return nil, errors.New("bad StatefulSet type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] [name: %s]", namespace, name)
			return ss, nil
		}
	}
	return nil, nil
}
func (c *kialiKubeCacheImpl) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		services := nsCache[kubernetes.ServiceType].GetStore().List()
		lenServices := len(services)
		if lenServices > 0 {
			_, ok := services[0].(*core_v1.Service)
			if !ok {
				return []core_v1.Service{}, errors.New("bad Service type found in cache")
			}
			nsServices := make([]core_v1.Service, lenServices)
			for i, service := range services {
				nsServices[i] = *(service.(*core_v1.Service))
			}
			log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] = %d", namespace, lenServices)
			if selectorLabels == nil {
				return nsServices, nil
			}
			var filteredServices []core_v1.Service
			labelsMap := labels.Set(selectorLabels)
			for _, svc := range nsServices {
				svcSelector := labels.Set(svc.Spec.Selector).AsSelector()
				if !svcSelector.Empty() && svcSelector.Matches(labelsMap) {
					filteredServices = append(filteredServices, svc)
				}
			}
			return filteredServices, nil
		}
	}
	return []core_v1.Service{}, nil
}
func (c *kialiMeshCacheImpl) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		services := nsCache[kubernetes.ServiceType].GetStore().List()
		lenServices := len(services)
		if lenServices > 0 {
			_, ok := services[0].(*core_v1.Service)
			if !ok {
				return []core_v1.Service{}, errors.New("bad Service type found in cache")
			}
			nsServices := make([]core_v1.Service, lenServices)
			for i, service := range services {
				nsServices[i] = *(service.(*core_v1.Service))
			}
			log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] = %d", namespace, lenServices)
			if selectorLabels == nil {
				return nsServices, nil
			}
			var filteredServices []core_v1.Service
			labelsMap := labels.Set(selectorLabels)
			for _, svc := range nsServices {
				svcSelector := labels.Set(svc.Spec.Selector).AsSelector()
				if !svcSelector.Empty() && svcSelector.Matches(labelsMap) {
					filteredServices = append(filteredServices, svc)
				}
			}
			return filteredServices, nil
		}
	}
	return []core_v1.Service{}, nil
}
func (c *kialiKubeCacheImpl) GetService(namespace, name string) (*core_v1.Service, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.ServiceType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			svc, ok := obj.(*core_v1.Service)
			if !ok {
				return nil, errors.New("bad Service type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] [name: %s]", namespace, name)
			return svc, nil
		}
	}
	return nil, nil
}
func (c *kialiMeshCacheImpl) GetService(namespace, name string) (*core_v1.Service, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.ServiceType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			svc, ok := obj.(*core_v1.Service)
			if !ok {
				return nil, errors.New("bad Service type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] [name: %s]", namespace, name)
			return svc, nil
		}
	}
	return nil, nil
}
func (c *kialiKubeCacheImpl) GetPods(namespace, labelSelector string) ([]core_v1.Pod, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		pods := nsCache[kubernetes.PodType].GetStore().List()
		lenPods := len(pods)
		if lenPods > 0 {
			_, ok := pods[0].(*core_v1.Pod)
			if !ok {
				return []core_v1.Pod{}, errors.New("bad Pod type found in cache")
			}
			nsPods := make([]core_v1.Pod, lenPods)
			for i, pod := range pods {
				nsPods[i] = *(pod.(*core_v1.Pod))
			}
			log.Tracef("[Kiali Cache] Get [resource: Pod] for [namespace: %s] = %d", namespace, lenPods)
			if labelSelector == "" {
				return nsPods, nil
			}
			var filteredPods []core_v1.Pod
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []core_v1.Pod{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, pod := range nsPods {
				if selector.Matches(labels.Set(pod.Labels)) {
					filteredPods = append(filteredPods, pod)
				}
			}
			return filteredPods, nil
		}
	}
	return []core_v1.Pod{}, nil
}
func (c *kialiMeshCacheImpl) GetPods(namespace, labelSelector string) ([]core_v1.Pod, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		pods := nsCache[kubernetes.PodType].GetStore().List()
		lenPods := len(pods)
		if lenPods > 0 {
			_, ok := pods[0].(*core_v1.Pod)
			if !ok {
				return []core_v1.Pod{}, errors.New("bad Pod type found in cache")
			}
			nsPods := make([]core_v1.Pod, lenPods)
			for i, pod := range pods {
				nsPods[i] = *(pod.(*core_v1.Pod))
			}
			log.Tracef("[Kiali Cache] Get [resource: Pod] for [namespace: %s] = %d", namespace, lenPods)
			if labelSelector == "" {
				return nsPods, nil
			}
			var filteredPods []core_v1.Pod
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []core_v1.Pod{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, pod := range nsPods {
				if selector.Matches(labels.Set(pod.Labels)) {
					filteredPods = append(filteredPods, pod)
				}
			}
			return filteredPods, nil
		}
	}
	return []core_v1.Pod{}, nil
}

func (c *kialiKubeCacheImpl) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		reps := nsCache[kubernetes.ReplicaSetType].GetStore().List()
		lenReps := len(reps)
		if lenReps > 0 {
			_, ok := reps[0].(*apps_v1.ReplicaSet)
			if !ok {
				return nil, errors.New("bad ReplicaSet type found in cache")
			}
			nsReps := make([]apps_v1.ReplicaSet, lenReps)
			for i, rep := range reps {
				nsReps[i] = *(rep.(*apps_v1.ReplicaSet))
			}
			log.Tracef("[Kiali Cache] Get [resource: ReplicaSet] for [namespace: %s] = %d", namespace, lenReps)
			return nsReps, nil
		}
	}
	return []apps_v1.ReplicaSet{}, nil
}
func (c *kialiMeshCacheImpl) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		reps := nsCache[kubernetes.ReplicaSetType].GetStore().List()
		lenReps := len(reps)
		if lenReps > 0 {
			_, ok := reps[0].(*apps_v1.ReplicaSet)
			if !ok {
				return nil, errors.New("bad ReplicaSet type found in cache")
			}
			nsReps := make([]apps_v1.ReplicaSet, lenReps)
			for i, rep := range reps {
				nsReps[i] = *(rep.(*apps_v1.ReplicaSet))
			}
			log.Tracef("[Kiali Cache] Get [resource: ReplicaSet] for [namespace: %s] = %d", namespace, lenReps)
			return nsReps, nil
		}
	}
	return []apps_v1.ReplicaSet{}, nil
}
