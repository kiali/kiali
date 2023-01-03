package cache

import (
	"context"
	"regexp"
	"strings"
	"sync"
	"time"

	istio "istio.io/client-go/pkg/clientset/versioned"
	istioext_v1alpha1_listers "istio.io/client-go/pkg/listers/extensions/v1alpha1"
	istionet_v1alpha3_listers "istio.io/client-go/pkg/listers/networking/v1alpha3"
	istionet_v1beta1_listers "istio.io/client-go/pkg/listers/networking/v1beta1"
	istiosec_v1beta1_listers "istio.io/client-go/pkg/listers/security/v1beta1"
	istiotelem_v1alpha1_listers "istio.io/client-go/pkg/listers/telemetry/v1alpha1"
	kube "k8s.io/client-go/kubernetes"
	apps_v1_listers "k8s.io/client-go/listers/apps/v1"
	core_v1_listers "k8s.io/client-go/listers/core/v1"
	"k8s.io/client-go/rest"
	gatewayapi "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"
	k8s_v1alpha2_listers "sigs.k8s.io/gateway-api/pkg/client/listers/apis/v1alpha2"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// Istio uses caches for pods and controllers.
// Kiali will use caches for specific namespaces and types
// https://github.com/istio/istio/blob/master/mixer/adapter/kubernetesenv/cache.go

type (
	// KialiCache stores both kube objects and non-kube related data such as pods' proxy status.
	// It is exclusively used by the business layer where it's expected to be a singleton.
	// This business layer cache needs access to all the kiali service account has access
	// to so it uses the kiali service account token instead of a user token. Access to
	// the objects returned by the cache should be filtered/restricted to the user's
	// token access but the cache returns objects without any filtering or restrictions.
	KialiCache interface {
		// Control methods
		// Check if a namespace is listed to be cached; if yes, creates a cache for that namespace
		CheckNamespace(namespace string) bool

		// Refresh will recreate the necessary cache. If the cache is cluster-scoped the "namespace" argument
		// is ignored and the whole cache is recreated, otherwise only the namespace-specific cache is updated.
		Refresh(namespace string)

		// Stop all caches
		Stop()

		// Kubernetes Client used for cache
		GetClient() *kubernetes.K8SClient

		KubernetesCache
		IstioCache
		NamespacesCache
		RegistryStatusCache
		ProxyStatusCache
	}

	// namespaceCache caches namespaces according to their token.
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

	// cacheLister combines a bunch of lister types into one.
	// This can probably be simplified or turned into an interface
	// with go generics.
	cacheLister struct {
		// Kube listers
		configMapLister   core_v1_listers.ConfigMapLister
		daemonSetLister   apps_v1_listers.DaemonSetLister
		deploymentLister  apps_v1_listers.DeploymentLister
		endpointLister    core_v1_listers.EndpointsLister
		podLister         core_v1_listers.PodLister
		replicaSetLister  apps_v1_listers.ReplicaSetLister
		serviceLister     core_v1_listers.ServiceLister
		statefulSetLister apps_v1_listers.StatefulSetLister

		// Istio listers
		authzLister           istiosec_v1beta1_listers.AuthorizationPolicyLister
		destinationRuleLister istionet_v1beta1_listers.DestinationRuleLister
		envoyFilterLister     istionet_v1alpha3_listers.EnvoyFilterLister
		gatewayLister         istionet_v1beta1_listers.GatewayLister
		k8sgatewayLister      k8s_v1alpha2_listers.GatewayLister
		k8shttprouteLister    k8s_v1alpha2_listers.HTTPRouteLister
		peerAuthnLister       istiosec_v1beta1_listers.PeerAuthenticationLister
		requestAuthnLister    istiosec_v1beta1_listers.RequestAuthenticationLister
		serviceEntryLister    istionet_v1beta1_listers.ServiceEntryLister
		sidecarLister         istionet_v1beta1_listers.SidecarLister
		telemetryLister       istiotelem_v1alpha1_listers.TelemetryLister
		virtualServiceLister  istionet_v1beta1_listers.VirtualServiceLister
		wasmPluginLister      istioext_v1alpha1_listers.WasmPluginLister
		workloadEntryLister   istionet_v1beta1_listers.WorkloadEntryLister
		workloadGroupLister   istionet_v1beta1_listers.WorkloadGroupLister
	}

	kialiCacheImpl struct {
		clusterScoped          bool // Creates either cluster-scoped or namespace-scoped informers
		istioClient            kubernetes.K8SClient
		k8sApi                 kube.Interface
		istioApi               istio.Interface
		gatewayApi             gatewayapi.Interface
		refreshDuration        time.Duration
		cacheNamespacesRegexps []regexp.Regexp
		cacheIstioTypes        map[string]bool
		stopNSChans            map[string]chan struct{}
		stopClusterScopedChan  chan struct{} // Close this channel to stop the cluster-scoped informers.
		cacheLock              sync.RWMutex
		tokenLock              sync.RWMutex
		tokenNamespaces        map[string]namespaceCache
		tokenNamespaceDuration time.Duration
		proxyStatusLock        sync.RWMutex
		proxyStatusNamespaces  map[string]map[string]podProxyStatus
		registryRefreshHandler RegistryRefreshHandler
		registryStatusLock     sync.RWMutex
		registryStatusCreated  *time.Time
		registryStatus         *kubernetes.RegistryStatus
		// Stops the background goroutines which refresh the cache's
		// service account token and poll for istiod's proxy status.
		stopPolling context.CancelFunc

		clusterCacheLister *cacheLister
		nsCacheLister      map[string]*cacheLister
	}
)

func NewKialiCache(namespaceSeedList ...string) (KialiCache, error) {
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

	cacheNamespacesRegexps := make([]regexp.Regexp, len(cacheNamespaces))
	for i, ns := range cacheNamespaces {
		cacheNamespacesRegexps[i] = *regexp.MustCompile(strings.TrimSpace(ns))
	}

	kialiCacheImpl := kialiCacheImpl{
		istioClient:            *istioClient,
		refreshDuration:        refreshDuration,
		cacheNamespacesRegexps: cacheNamespacesRegexps,
		cacheIstioTypes:        cacheIstioTypes,
		// Only when all namespaces are accessible should the cache be cluster scoped.
		// Otherwise, kiali may not have access to all namespaces since
		// the operator only grants clusterroles when all namespaces are accessible.
		clusterScoped:          kConfig.AllNamespacesAccessible(),
		tokenNamespaces:        make(map[string]namespaceCache),
		tokenNamespaceDuration: tokenNamespaceDuration,
		proxyStatusNamespaces:  make(map[string]map[string]podProxyStatus),
	}
	kialiCacheImpl.k8sApi = istioClient.GetK8sApi()
	kialiCacheImpl.istioApi = istioClient.Istio()
	kialiCacheImpl.gatewayApi = istioClient.GatewayAPI()

	// Cache launches some goroutines in the background to periodically poll some resources.
	// These are stopped by calling cancel.
	ctx, cancel := context.WithCancel(context.Background())
	kialiCacheImpl.stopPolling = cancel

	// Update SA Token
	kialiCacheImpl.refreshCache(ctx, istioConfig)

	// Populate cache from Istiod in the background. This routine gets stopped when the cache is stopped.
	kialiCacheImpl.pollIstiodForProxyStatus(ctx)

	kialiCacheImpl.registryRefreshHandler = NewRegistryHandler(kialiCacheImpl.RefreshRegistryStatus)

	if kialiCacheImpl.clusterScoped {
		log.Debug("[Kiali Cache] Using 'cluster' scoped Kiali Cache")
		kialiCacheImpl.createClusterScopedCache()
	} else {
		log.Debug("[Kiali Cache] Using 'namespace' scoped Kiali Cache")
		kialiCacheImpl.nsCacheLister = make(map[string]*cacheLister)
		kialiCacheImpl.stopNSChans = make(map[string]chan struct{})

		for _, ns := range namespaceSeedList {
			kialiCacheImpl.CheckNamespace(ns)
		}
	}

	log.Infof("Kiali Cache is active for namespaces %v", cacheNamespaces)
	return &kialiCacheImpl, nil
}

// It will indicate if a namespace should have a cache
func (c *kialiCacheImpl) isCached(namespace string) bool {
	for _, cacheNs := range c.cacheNamespacesRegexps {
		if cacheNs.MatchString(namespace) {
			return true
		}
	}
	return false
}

func (c *kialiCacheImpl) createNSCache(namespace string) bool {
	kubeInformerFactory := c.createKubernetesInformers(namespace)
	istioInformerFactory := c.createIstioInformers(namespace)
	gatewayInformerFactory := c.createGatewayInformers(namespace)

	if _, exist := c.stopNSChans[namespace]; !exist {
		c.stopNSChans[namespace] = make(chan struct{})
	}

	kubeInformerFactory.Start(c.stopNSChans[namespace])
	istioInformerFactory.Start(c.stopNSChans[namespace])
	gatewayInformerFactory.Start(c.stopNSChans[namespace])

	log.Infof("[Kiali Cache] waiting for [namespace: %s] cache to sync", namespace)

	for _, synced := range kubeInformerFactory.WaitForCacheSync(c.stopNSChans[namespace]) {
		if !synced {
			log.Errorf("[Kiali Cache] failed to sync [namespace: %s] kube cache", namespace)
			return false
		}
	}
	for _, synced := range istioInformerFactory.WaitForCacheSync(c.stopNSChans[namespace]) {
		if !synced {
			log.Errorf("[Kiali Cache] failed to sync [namespace: %s] Istio cache", namespace)
			return false
		}
	}
	for _, synced := range gatewayInformerFactory.WaitForCacheSync(c.stopNSChans[namespace]) {
		if !synced {
			log.Errorf("[Kiali Cache] failed to sync [namespace: %s] gateway-api cache", namespace)
			return false
		}
	}

	log.Infof("[Kiali Cache] started [namespace: %s] cache", namespace)

	return true
}

func (c *kialiCacheImpl) createClusterScopedCache() bool {
	kubeInformerFactory := c.createKubernetesInformers("")
	istioInformerFactory := c.createIstioInformers("")
	gatewayInformerFactory := c.createGatewayInformers("")

	c.stopClusterScopedChan = make(chan struct{})
	kubeInformerFactory.Start(c.stopClusterScopedChan)
	istioInformerFactory.Start(c.stopClusterScopedChan)
	gatewayInformerFactory.Start(c.stopClusterScopedChan)

	log.Info("[Kiali Cache] Waiting for cluster-scoped cache to sync")
	for _, synced := range kubeInformerFactory.WaitForCacheSync(c.stopClusterScopedChan) {
		if !synced {
			log.Error("[Kiali Cache] failed to sync kube cluster-scoped cache")
			return false
		}
	}
	for _, synced := range istioInformerFactory.WaitForCacheSync(c.stopClusterScopedChan) {
		if !synced {
			log.Error("[Kiali Cache] failed to sync Istio cluster-scoped cache")
			return false
		}
	}
	for _, synced := range gatewayInformerFactory.WaitForCacheSync(c.stopClusterScopedChan) {
		if !synced {
			log.Error("[Kiali Cache] failed to sync Istio cluster-scoped cache")
			return false
		}
	}

	log.Info("[Kiali Cache] started")

	return true
}

// CheckNamespace will
// - Validate if a namespace is included in the cache
// - Create and initialize a cache
func (c *kialiCacheImpl) CheckNamespace(namespace string) bool {
	if c.clusterScoped {
		return true
	} else if !c.isCached(namespace) {
		return false
	}

	c.cacheLock.RLock()
	_, isNsCached := c.nsCacheLister[namespace]
	c.cacheLock.RUnlock()

	if !isNsCached {
		defer c.cacheLock.Unlock()
		c.cacheLock.Lock()
		return c.createNSCache(namespace)
	}

	return true
}

// Refresh will recreate the necessary cache. If the cache is cluster-scoped the "namespace" argument
// is ignored and the whole cache is recreated, otherwise only the namespace-specific cache is updated.
func (c *kialiCacheImpl) Refresh(namespace string) {
	defer c.cacheLock.Unlock()
	c.cacheLock.Lock()

	if c.clusterScoped {
		c.stop("")
		c.createClusterScopedCache()
		return
	}

	c.stop(namespace)
	c.createNSCache(namespace)
}

// refreshCache watches for changes to the cache's service account token
// and recreates the cache(s) when the token changes.
func (c *kialiCacheImpl) refreshCache(ctx context.Context, istioConfig rest.Config) {
	ticker := time.NewTicker(60 * time.Second)
	go func() {
		for {
			select {
			case <-ticker.C:
				if newToken, err := kubernetes.GetKialiToken(); err != nil {
					log.Errorf("Error updating Kiali Token %v", err)
				} else {
					if istioConfig.BearerToken != newToken {
						oldToken := istioConfig.BearerToken
						log.Info("Kiali Cache: Updating cache with new token")
						istioConfig.BearerToken = newToken

						istioClient, errorInitClient := kubernetes.NewClientFromConfig(&istioConfig)
						if errorInitClient != nil {
							log.Errorf("Error creating new Client From Config %v", errorInitClient)
							istioConfig.BearerToken = oldToken
						} else {
							c.istioClient = *istioClient
							c.k8sApi = istioClient.GetK8sApi()
							c.istioApi = istioClient.Istio()
							c.gatewayApi = istioClient.GatewayAPI()
							if c.clusterScoped {
								c.Refresh("")
							} else {
								// Need to recreate all the namespace scoped caches
								// with the new token when it changes.
								for ns := range c.stopNSChans {
									c.Refresh(ns)
								}
							}
						}

					} else {
						log.Debug("Kiali Cache: Nothing to refresh")
					}
				}
			case <-ctx.Done():
				log.Debug("[Kiali Cache] Stopping watching for service account token changes")
				ticker.Stop()
				return
			}
		}
	}()
}

// Stop will stop either the cluster wide cache or all of the namespace caches.
func (c *kialiCacheImpl) Stop() {
	log.Infof("Stopping Kiali Cache")
	defer c.cacheLock.Unlock()
	c.cacheLock.Lock()
	if c.clusterScoped {
		c.stop("")
	} else {
		for namespace := range c.stopNSChans {
			c.stop(namespace)
		}
	}
	c.stopPolling()
}

func (c *kialiCacheImpl) stop(namespace string) {
	if c.clusterScoped {
		close(c.stopClusterScopedChan)
	} else {
		if nsChan, exist := c.stopNSChans[namespace]; exist {
			close(nsChan)
			delete(c.stopNSChans, namespace)
			delete(c.nsCacheLister, namespace)
		}
	}
}

func (c *kialiCacheImpl) GetClient() *kubernetes.K8SClient {
	return &c.istioClient
}
