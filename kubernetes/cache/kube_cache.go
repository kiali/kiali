package cache

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/exp/slices"
	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	"istio.io/client-go/pkg/apis/telemetry/v1alpha1"
	istio "istio.io/client-go/pkg/informers/externalversions"
	istioext_v1alpha1_listers "istio.io/client-go/pkg/listers/extensions/v1alpha1"
	istionet_v1alpha3_listers "istio.io/client-go/pkg/listers/networking/v1alpha3"
	istionet_v1beta1_listers "istio.io/client-go/pkg/listers/networking/v1beta1"
	istiosec_v1beta1_listers "istio.io/client-go/pkg/listers/security/v1beta1"
	istiotelem_v1alpha1_listers "istio.io/client-go/pkg/listers/telemetry/v1alpha1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/informers"
	apps_v1_listers "k8s.io/client-go/listers/apps/v1"
	core_v1_listers "k8s.io/client-go/listers/core/v1"
	"k8s.io/client-go/tools/cache"
	gatewayapi_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"
	gateway "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"
	k8s_v1beta1_listers "sigs.k8s.io/gateway-api/pkg/client/listers/apis/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// checkIstioAPIsExist checks if the istio APIs are present in the cluster
// and returns an error if they are not.
func checkIstioAPIsExist(client kubernetes.ClientInterface) error {
	if !client.IsIstioAPI() {
		return fmt.Errorf("istio APIs and resources are not present in cluster [%s]", client.ClusterInfo().Name)
	}
	return nil
}

type KubeCache interface {
	// Control methods
	// Check if a namespace is listed to be cached; if yes, creates a cache for that namespace
	CheckNamespace(namespace string) bool

	// Refresh will recreate the necessary cache. If the cache is cluster-scoped the "namespace" argument
	// is ignored and the whole cache is recreated, otherwise only the namespace-specific cache is updated.
	Refresh(namespace string)

	// Stop all caches
	Stop()

	// Client returns the underlying client for the KubeCache.
	// This is useful for when you want to talk directly to the kube API
	// using the Kiali Service Account client.
	Client() kubernetes.ClientInterface

	// UpdateClient will update the client used by the cache.
	// Useful for when the token is refreshed for the client.
	// This causes a full refresh of the cache.
	UpdateClient(client kubernetes.ClientInterface) error

	GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error)
	GetDaemonSets(namespace string) ([]apps_v1.DaemonSet, error)
	GetDaemonSet(namespace, name string) (*apps_v1.DaemonSet, error)
	GetDeployments(namespace string) ([]apps_v1.Deployment, error)
	GetDeploymentsWithSelector(namespace string, labelSelector string) ([]apps_v1.Deployment, error)
	GetDeployment(namespace, name string) (*apps_v1.Deployment, error)
	GetEndpoints(namespace, name string) (*core_v1.Endpoints, error)
	GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error)
	GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error)
	GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error)
	GetService(namespace string, name string) (*core_v1.Service, error)
	GetPods(namespace, labelSelector string) ([]core_v1.Pod, error)
	GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error)

	GetDestinationRule(namespace, name string) (*networking_v1beta1.DestinationRule, error)
	GetDestinationRules(namespace, labelSelector string) ([]*networking_v1beta1.DestinationRule, error)
	GetEnvoyFilter(namespace, name string) (*networking_v1alpha3.EnvoyFilter, error)
	GetEnvoyFilters(namespace, labelSelector string) ([]*networking_v1alpha3.EnvoyFilter, error)
	GetGateway(namespace, name string) (*networking_v1beta1.Gateway, error)
	GetGateways(namespace, labelSelector string) ([]*networking_v1beta1.Gateway, error)
	GetServiceEntry(namespace, name string) (*networking_v1beta1.ServiceEntry, error)
	GetServiceEntries(namespace, labelSelector string) ([]*networking_v1beta1.ServiceEntry, error)
	GetSidecar(namespace, name string) (*networking_v1beta1.Sidecar, error)
	GetSidecars(namespace, labelSelector string) ([]*networking_v1beta1.Sidecar, error)
	GetVirtualService(namespace, name string) (*networking_v1beta1.VirtualService, error)
	GetVirtualServices(namespace, labelSelector string) ([]*networking_v1beta1.VirtualService, error)
	GetWorkloadEntry(namespace, name string) (*networking_v1beta1.WorkloadEntry, error)
	GetWorkloadEntries(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadEntry, error)
	GetWorkloadGroup(namespace, name string) (*networking_v1beta1.WorkloadGroup, error)
	GetWorkloadGroups(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadGroup, error)
	GetWasmPlugin(namespace, name string) (*extentions_v1alpha1.WasmPlugin, error)
	GetWasmPlugins(namespace, labelSelector string) ([]*extentions_v1alpha1.WasmPlugin, error)
	GetTelemetry(namespace, name string) (*v1alpha1.Telemetry, error)
	GetTelemetries(namespace, labelSelector string) ([]*v1alpha1.Telemetry, error)

	GetK8sGateway(namespace, name string) (*gatewayapi_v1beta1.Gateway, error)
	GetK8sGateways(namespace, labelSelector string) ([]*gatewayapi_v1beta1.Gateway, error)
	GetK8sHTTPRoute(namespace, name string) (*gatewayapi_v1beta1.HTTPRoute, error)
	GetK8sHTTPRoutes(namespace, labelSelector string) ([]*gatewayapi_v1beta1.HTTPRoute, error)

	GetAuthorizationPolicy(namespace, name string) (*security_v1beta1.AuthorizationPolicy, error)
	GetAuthorizationPolicies(namespace, labelSelector string) ([]*security_v1beta1.AuthorizationPolicy, error)
	GetPeerAuthentication(namespace, name string) (*security_v1beta1.PeerAuthentication, error)
	GetPeerAuthentications(namespace, labelSelector string) ([]*security_v1beta1.PeerAuthentication, error)
	GetRequestAuthentication(namespace, name string) (*security_v1beta1.RequestAuthentication, error)
	GetRequestAuthentications(namespace, labelSelector string) ([]*security_v1beta1.RequestAuthentication, error)
}

// cacheLister combines a bunch of lister types into one.
// This can probably be simplified or turned into an interface
// with go generics.
type cacheLister struct {
	// Kube listers
	configMapLister   core_v1_listers.ConfigMapLister
	daemonSetLister   apps_v1_listers.DaemonSetLister
	deploymentLister  apps_v1_listers.DeploymentLister
	endpointLister    core_v1_listers.EndpointsLister
	podLister         core_v1_listers.PodLister
	replicaSetLister  apps_v1_listers.ReplicaSetLister
	serviceLister     core_v1_listers.ServiceLister
	statefulSetLister apps_v1_listers.StatefulSetLister

	cachesSynced []cache.InformerSynced

	// Istio listers
	authzLister           istiosec_v1beta1_listers.AuthorizationPolicyLister
	destinationRuleLister istionet_v1beta1_listers.DestinationRuleLister
	envoyFilterLister     istionet_v1alpha3_listers.EnvoyFilterLister
	gatewayLister         istionet_v1beta1_listers.GatewayLister
	k8sgatewayLister      k8s_v1beta1_listers.GatewayLister
	k8shttprouteLister    k8s_v1beta1_listers.HTTPRouteLister
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

// kubeCache is a local cache of kube objects. Manages informers and listers.
type kubeCache struct {
	cacheLock              sync.RWMutex
	cfg                    config.Config
	client                 kubernetes.ClientInterface
	clusterCacheLister     *cacheLister
	clusterScoped          bool
	nsCacheLister          map[string]*cacheLister
	registryRefreshHandler RegistryRefreshHandler
	refreshDuration        time.Duration
	// Stops the cluster scoped informers when a refresh is necessary.
	// Close this channel to stop the cluster-scoped informers.
	stopClusterScopedChan chan struct{}
	// Stops the namespace scoped informers when a refresh is necessary.
	stopNSChans map[string]chan struct{}
}

// Starts all informers. These run until context is cancelled.
func NewKubeCache(kialiClient kubernetes.ClientInterface, cfg config.Config, refreshHandler RegistryRefreshHandler) (*kubeCache, error) {
	refreshDuration := time.Duration(cfg.KubernetesConfig.CacheDuration) * time.Second

	c := &kubeCache{
		cfg:    cfg,
		client: kialiClient,
		// Only when all namespaces are accessible should the cache be cluster scoped.
		// Otherwise, kiali may not have access to all namespaces since
		// the operator only grants clusterroles when all namespaces are accessible.
		clusterScoped:          cfg.AllNamespacesAccessible(),
		registryRefreshHandler: refreshHandler,
		refreshDuration:        refreshDuration,
	}

	if c.clusterScoped {
		log.Debug("[Kiali Cache] Using 'cluster' scoped Kiali Cache")
		if err := c.startInformers(""); err != nil {
			return nil, err
		}
	} else {
		log.Debug("[Kiali Cache] Using 'namespace' scoped Kiali Cache")
		c.nsCacheLister = make(map[string]*cacheLister)
		c.stopNSChans = make(map[string]chan struct{})
	}

	return c, nil
}

// It will indicate if a namespace should have a cache
func (c *kubeCache) isCached(namespace string) bool {
	if namespace != "" {
		return slices.Contains(c.cfg.Deployment.AccessibleNamespaces, namespace)
	}
	return false
}

// Client returns the underlying client for the KubeCache.
// This is useful for when you want to talk directly to the kube API
// using the Kiali Service Account client.
func (c *kubeCache) Client() kubernetes.ClientInterface {
	c.cacheLock.RLock()
	defer c.cacheLock.RUnlock()
	return c.client
}

// UpdateClient will update the client and refresh the cache.
// This is used when the client is updated with a new token.
func (c *kubeCache) UpdateClient(kialiClient kubernetes.ClientInterface) error {
	log.Debug("[Kiali Cache] Updating Kiali client. Refreshing cache.")
	c.cacheLock.Lock()
	defer c.cacheLock.Unlock()

	c.client = kialiClient
	if c.clusterScoped {
		if err := c.refresh(""); err != nil {
			return err
		}
	} else {
		for ns := range c.nsCacheLister {
			if err := c.refresh(ns); err != nil {
				return err
			}
		}
	}

	return nil
}

// CheckNamespace will
// - Validate if a namespace is included in the cache
// - Create and initialize a cache
func (c *kubeCache) CheckNamespace(namespace string) bool {
	if c.clusterScoped {
		return true
	} else if !c.isCached(namespace) {
		return false
	}

	var isNSCached bool
	// Separate func so we can defer
	func() {
		c.cacheLock.RLock()
		defer c.cacheLock.RUnlock()
		_, isNSCached = c.nsCacheLister[namespace]
	}()

	if !isNSCached {
		c.cacheLock.Lock()
		defer c.cacheLock.Unlock()
		if err := c.startInformers(namespace); err != nil {
			log.Errorf("[Kiali Cache] Error starting informers for namespace: %s. Err: %s", namespace, err)
			return false
		}
	}

	return true
}

// Stop will stop either the cluster wide cache or all of the namespace caches.
func (c *kubeCache) Stop() {
	log.Infof("Stopping Kiali Cache")
	c.cacheLock.Lock()
	defer c.cacheLock.Unlock()

	if c.clusterScoped {
		c.stop("")
	} else {
		for namespace := range c.stopNSChans {
			c.stop(namespace)
		}
	}
}

func (c *kubeCache) stop(namespace string) {
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

// Refresh will recreate the necessary cache. If the cache is cluster-scoped the "namespace" argument
// is ignored and the whole cache is recreated, otherwise only the namespace-specific cache is updated.
func (c *kubeCache) Refresh(namespace string) {
	c.cacheLock.Lock()
	defer c.cacheLock.Unlock()

	if err := c.refresh(namespace); err != nil {
		log.Errorf("[Kiali Cache] Error refreshing cache for namespace: %s. Err: %s", namespace, err)
	}
}

func (c *kubeCache) refresh(namespace string) error {
	if c.clusterScoped {
		namespace = ""
	}

	c.stop(namespace)
	return c.startInformers(namespace)
}

// starter is a small interface around the different informer factories that
// allows us to start them all.
type starter interface {
	Start(stopCh <-chan struct{})
}

func (c *kubeCache) startInformers(namespace string) error {
	informers := []starter{
		c.createKubernetesInformers(namespace),
		c.createIstioInformers(namespace),
		c.createGatewayInformers(namespace),
	}

	var scope string
	stop := make(chan struct{})
	if c.clusterScoped {
		scope = "cluster-scoped"
		c.stopClusterScopedChan = stop
	} else {
		scope = fmt.Sprintf("namespace-scoped for namespace: %s", namespace)
		c.stopNSChans[namespace] = stop
	}

	log.Debugf("[Kiali Cache] Starting %s informers", scope)

	// TODO: This calls should not happen. At the moment, prevent the errors from these calls
	if !c.clusterScoped && namespace == "" {
		log.Errorf("[Kiali Cache] Error starting namespace-scoped cache for empty namespace")
		return nil
	}

	for _, informer := range informers {
		go informer.Start(stop)
	}

	log.Infof("[Kiali Cache] Waiting for %s cache to sync", scope)
	if !cache.WaitForCacheSync(stop, c.getCacheLister(namespace).cachesSynced...) {
		log.Errorf("[Kiali Cache] Failed to sync %s cache", scope)
		return errors.New("failed to sync cache")
	}

	log.Info("[Kiali Cache] Started")
	return nil
}

func (c *kubeCache) createIstioInformers(namespace string) istio.SharedInformerFactory {
	var opts []istio.SharedInformerOption
	if namespace != "" {
		opts = append(opts, istio.WithNamespace(namespace))
	}

	sharedInformers := istio.NewSharedInformerFactoryWithOptions(c.client.Istio(), c.refreshDuration, opts...)
	lister := c.getCacheLister(namespace)

	if c.client.IsIstioAPI() {
		lister.authzLister = sharedInformers.Security().V1beta1().AuthorizationPolicies().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Security().V1beta1().AuthorizationPolicies().Informer().HasSynced)
		_, error := sharedInformers.Security().V1beta1().AuthorizationPolicies().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in AuthorizationPolicies cache : %s", error)
		}

		lister.destinationRuleLister = sharedInformers.Networking().V1beta1().DestinationRules().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Networking().V1beta1().DestinationRules().Informer().HasSynced)
		_, error = sharedInformers.Networking().V1beta1().DestinationRules().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in DestinationRules cache : %s", error)
		}

		lister.envoyFilterLister = sharedInformers.Networking().V1alpha3().EnvoyFilters().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Networking().V1alpha3().EnvoyFilters().Informer().HasSynced)
		_, error = sharedInformers.Networking().V1alpha3().EnvoyFilters().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in EnvoyFilters cache : %s", error)
		}

		lister.gatewayLister = sharedInformers.Networking().V1beta1().Gateways().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Networking().V1beta1().Gateways().Informer().HasSynced)
		_, error = sharedInformers.Networking().V1beta1().Gateways().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in Gateways cache : %s", error)
		}

		lister.peerAuthnLister = sharedInformers.Security().V1beta1().PeerAuthentications().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Security().V1beta1().PeerAuthentications().Informer().HasSynced)
		_, error = sharedInformers.Security().V1beta1().PeerAuthentications().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in PeerAuthentications cache : %s", error)
		}

		lister.requestAuthnLister = sharedInformers.Security().V1beta1().RequestAuthentications().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Security().V1beta1().RequestAuthentications().Informer().HasSynced)
		_, error = sharedInformers.Security().V1beta1().RequestAuthentications().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in RequestAuthentications cache : %s", error)
		}

		lister.serviceEntryLister = sharedInformers.Networking().V1beta1().ServiceEntries().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Networking().V1beta1().ServiceEntries().Informer().HasSynced)
		_, error = sharedInformers.Networking().V1beta1().ServiceEntries().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in ServiceEntries cache : %s", error)
		}

		lister.sidecarLister = sharedInformers.Networking().V1beta1().Sidecars().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Networking().V1beta1().Sidecars().Informer().HasSynced)
		_, error = sharedInformers.Networking().V1beta1().Sidecars().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in Sidecars cache : %s", error)
		}

		lister.telemetryLister = sharedInformers.Telemetry().V1alpha1().Telemetries().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Telemetry().V1alpha1().Telemetries().Informer().HasSynced)
		_, error = sharedInformers.Telemetry().V1alpha1().Telemetries().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in Telemetries cache : %s", error)
		}

		lister.virtualServiceLister = sharedInformers.Networking().V1beta1().VirtualServices().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Networking().V1beta1().VirtualServices().Informer().HasSynced)
		_, error = sharedInformers.Networking().V1beta1().VirtualServices().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in VirtualServices cache : %s", error)
		}

		lister.wasmPluginLister = sharedInformers.Extensions().V1alpha1().WasmPlugins().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Extensions().V1alpha1().WasmPlugins().Informer().HasSynced)
		_, error = sharedInformers.Extensions().V1alpha1().WasmPlugins().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in WasmPlugins cache : %s", error)
		}

		lister.workloadEntryLister = sharedInformers.Networking().V1beta1().WorkloadEntries().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Networking().V1beta1().WorkloadEntries().Informer().HasSynced)
		_, error = sharedInformers.Networking().V1beta1().WorkloadEntries().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in WorkloadEntries cache : %s", error)
		}

		lister.workloadGroupLister = sharedInformers.Networking().V1beta1().WorkloadGroups().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Networking().V1beta1().WorkloadGroups().Informer().HasSynced)
		_, error = sharedInformers.Networking().V1beta1().WorkloadGroups().Informer().AddEventHandler(c.registryRefreshHandler)
		if error != nil {
			log.Errorf("[Kiali Cache] Failed to Add event handler in WorkloadGroups cache : %s", error)
		}
	}

	return sharedInformers
}

func (c *kubeCache) createGatewayInformers(namespace string) gateway.SharedInformerFactory {
	var opts []gateway.SharedInformerOption
	if namespace != "" {
		opts = append(opts, gateway.WithNamespace(namespace))
	}

	sharedInformers := gateway.NewSharedInformerFactoryWithOptions(c.client.GatewayAPI(), c.refreshDuration, opts...)
	lister := c.getCacheLister(namespace)

	if c.client.IsGatewayAPI() {
		lister.k8sgatewayLister = sharedInformers.Gateway().V1beta1().Gateways().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Gateway().V1beta1().Gateways().Informer().HasSynced)
		_, err := sharedInformers.Gateway().V1beta1().Gateways().Informer().AddEventHandler(c.registryRefreshHandler)
		if err != nil {
			log.Errorf("[Kiali Cache] Error adding Handler to Informer Gateways: %s", err.Error())
		}

		lister.k8shttprouteLister = sharedInformers.Gateway().V1beta1().HTTPRoutes().Lister()
		lister.cachesSynced = append(lister.cachesSynced, sharedInformers.Gateway().V1beta1().HTTPRoutes().Informer().HasSynced)
		_, err = sharedInformers.Gateway().V1beta1().HTTPRoutes().Informer().AddEventHandler(c.registryRefreshHandler)
		if err != nil {
			log.Errorf("[Kiali Cache] Error adding Handler to Informer HTTPRoutes : %s", err.Error())
		}
	}
	return sharedInformers
}

// createKubernetesInformers creates kube informers for all objects kiali watches and
// saves them to the typeCache. If namespace is not empty, the informers are scoped
// to the namespace. Otherwise, the informers are cluster-wide.
func (c *kubeCache) createKubernetesInformers(namespace string) informers.SharedInformerFactory {
	var opts []informers.SharedInformerOption
	if namespace != "" {
		opts = append(opts, informers.WithNamespace(namespace))
	}

	sharedInformers := informers.NewSharedInformerFactoryWithOptions(c.client.Kube(), c.refreshDuration, opts...)

	lister := &cacheLister{
		deploymentLister:  sharedInformers.Apps().V1().Deployments().Lister(),
		statefulSetLister: sharedInformers.Apps().V1().StatefulSets().Lister(),
		daemonSetLister:   sharedInformers.Apps().V1().DaemonSets().Lister(),
		serviceLister:     sharedInformers.Core().V1().Services().Lister(),
		endpointLister:    sharedInformers.Core().V1().Endpoints().Lister(),
		podLister:         sharedInformers.Core().V1().Pods().Lister(),
		replicaSetLister:  sharedInformers.Apps().V1().ReplicaSets().Lister(),
		configMapLister:   sharedInformers.Core().V1().ConfigMaps().Lister(),
	}
	lister.cachesSynced = append(lister.cachesSynced,
		sharedInformers.Apps().V1().Deployments().Informer().HasSynced,
		sharedInformers.Apps().V1().StatefulSets().Informer().HasSynced,
		sharedInformers.Apps().V1().DaemonSets().Informer().HasSynced,
		sharedInformers.Core().V1().Services().Informer().HasSynced,
		sharedInformers.Core().V1().Endpoints().Informer().HasSynced,
		sharedInformers.Core().V1().Pods().Informer().HasSynced,
		sharedInformers.Apps().V1().ReplicaSets().Informer().HasSynced,
		sharedInformers.Core().V1().ConfigMaps().Informer().HasSynced,
	)
	_, err := sharedInformers.Core().V1().Services().Informer().AddEventHandler(c.registryRefreshHandler)
	if err != nil {
		log.Errorf("Error adding Handler to Informer services: %s", err.Error())
	}
	_, err = sharedInformers.Core().V1().Endpoints().Informer().AddEventHandler(c.registryRefreshHandler)
	if err != nil {
		log.Errorf("Error adding Handler to Informer Endpoints: %s", err.Error())
	}

	if c.clusterScoped {
		c.clusterCacheLister = lister
	} else {
		c.nsCacheLister[namespace] = lister
	}

	return sharedInformers
}

func (c *kubeCache) getCacheLister(namespace string) *cacheLister {
	if c.clusterScoped {
		return c.clusterCacheLister
	}
	return c.nsCacheLister[namespace]
}

func (c *kubeCache) GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	log.Tracef("[Kiali Cache] Get [resource: ConfigMap] for [namespace: %s] [name: %s]", namespace, name)
	cfg, err := c.getCacheLister(namespace).configMapLister.ConfigMaps(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retCM := cfg.DeepCopy()
	retCM.Kind = kubernetes.ConfigMapType
	return retCM, nil
}

func (c *kubeCache) GetDaemonSets(namespace string) ([]apps_v1.DaemonSet, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	daemonSets, err := c.getCacheLister(namespace).daemonSetLister.DaemonSets(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: DaemonSet] for [namespace: %s] = %d", namespace, len(daemonSets))

	retSets := []apps_v1.DaemonSet{}
	for _, ds := range daemonSets {
		// Do not modify what is returned by the lister since that is shared and will cause data races.
		d := ds.DeepCopy()
		d.Kind = kubernetes.DaemonSetType
		retSets = append(retSets, *d)
	}
	return retSets, nil
}

func (c *kubeCache) GetDaemonSet(namespace, name string) (*apps_v1.DaemonSet, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	log.Tracef("[Kiali Cache] Get [resource: DaemonSet] for [namespace: %s] [name: %s]", namespace, name)
	ds, err := c.getCacheLister(namespace).daemonSetLister.DaemonSets(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retDS := ds.DeepCopy()
	retDS.Kind = kubernetes.DaemonSetType
	return retDS, nil
}

func (c *kubeCache) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	deployments, err := c.getCacheLister(namespace).deploymentLister.Deployments(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] = %d", namespace, len(deployments))

	retDeployments := []apps_v1.Deployment{}
	for _, deployment := range deployments {
		// Do not modify what is returned by the lister since that is shared and will cause data races.
		d := deployment.DeepCopy()
		d.Kind = kubernetes.DeploymentType
		retDeployments = append(retDeployments, *d)
	}
	return retDeployments, nil
}

func (c *kubeCache) GetDeploymentsWithSelector(namespace string, labelSelector string) ([]apps_v1.Deployment, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()

	selector, err := labels.ConvertSelectorToLabelsMap(labelSelector)
	if err != nil {
		return nil, err
	}

	deployments, err := c.getCacheLister(namespace).deploymentLister.Deployments(namespace).List(selector.AsSelector())
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] = %d", namespace, len(deployments))

	retDeployments := []apps_v1.Deployment{}
	for _, deployment := range deployments {
		// Do not modify what is returned by the lister since that is shared and will cause data races.
		d := deployment.DeepCopy()
		d.Kind = kubernetes.DeploymentType
		retDeployments = append(retDeployments, *d)
	}
	return retDeployments, nil
}

func (c *kubeCache) GetDeployment(namespace, name string) (*apps_v1.Deployment, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] [name: %s]", namespace, name)
	deployment, err := c.getCacheLister(namespace).deploymentLister.Deployments(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retDep := deployment.DeepCopy()
	retDep.Kind = kubernetes.DeploymentType
	return retDep, nil
}

func (c *kubeCache) GetEndpoints(namespace, name string) (*core_v1.Endpoints, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	log.Tracef("[Kiali Cache] Get [resource: Endpoints] for [namespace: %s] [name: %s]", namespace, name)
	endpoints, err := c.getCacheLister(namespace).endpointLister.Endpoints(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retEnd := endpoints.DeepCopy()
	retEnd.Kind = kubernetes.EndpointsType
	return retEnd, nil
}

func (c *kubeCache) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	statefulSets, err := c.getCacheLister(namespace).statefulSetLister.StatefulSets(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] = %d", namespace, len(statefulSets))

	retSets := []apps_v1.StatefulSet{}
	for _, ss := range statefulSets {
		// Do not modify what is returned by the lister since that is shared and will cause data races.
		s := ss.DeepCopy()
		s.Kind = kubernetes.StatefulSetType
		retSets = append(retSets, *s)
	}
	return retSets, nil
}

func (c *kubeCache) GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] [name: %s]", namespace, name)
	statefulSet, err := c.getCacheLister(namespace).statefulSetLister.StatefulSets(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retSet := statefulSet.DeepCopy()
	retSet.Kind = kubernetes.StatefulSetType
	return retSet, nil
}

func (c *kubeCache) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()

	var services []*core_v1.Service
	var err error
	if namespace == metav1.NamespaceAll {
		services, err = c.getCacheLister(namespace).serviceLister.List(labels.Set(selectorLabels).AsSelector())
	} else {
		services, err = c.getCacheLister(namespace).serviceLister.Services(namespace).List(labels.Set(selectorLabels).AsSelector())
	}
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] = %d", namespace, len(services))

	retServices := []core_v1.Service{}
	for _, service := range services {
		// Do not modify what is returned by the lister since that is shared and will cause data races.
		svc := service.DeepCopy()
		svc.Kind = kubernetes.ServiceType
		retServices = append(retServices, *svc)
	}
	return retServices, nil
}

func (c *kubeCache) GetService(namespace, name string) (*core_v1.Service, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] [name: %s]", namespace, name)
	service, err := c.getCacheLister(namespace).serviceLister.Services(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retSvc := service.DeepCopy()
	retSvc.Kind = kubernetes.ServiceType
	return retSvc, nil
}

func (c *kubeCache) GetPods(namespace, labelSelector string) ([]core_v1.Pod, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	pods, err := c.getCacheLister(namespace).podLister.Pods(namespace).List(selector)
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: Pod] for [namespace: %s] = %d", namespace, len(pods))

	retPods := []core_v1.Pod{}
	for _, pod := range pods {
		// Do not modify what is returned by the lister since that is shared and will cause data races.
		p := pod.DeepCopy()
		p.Kind = kubernetes.PodType
		retPods = append(retPods, *p)
	}
	return retPods, nil
}

// GetReplicaSets returns the cached ReplicaSets for the namespace.  For any given RS for a given
// Owner (i.e. Deployment), only the most recent version of the RS will be included in the returned list.
// When an owning Deployment is configured with revisionHistoryLimit > 0, then k8s may return multiple
// versions of the RS for the same Deployment (current and older revisions). Note that it is still possible
// to have multiple RS for the same owner. In which case the most recent version of each is returned.
// see also: ../kubernetes.go
func (c *kubeCache) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	reps, err := c.getCacheLister(namespace).replicaSetLister.ReplicaSets(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}

	result := []apps_v1.ReplicaSet{}
	if len(reps) > 0 {
		activeRSMap := map[string]*apps_v1.ReplicaSet{}
		for _, rs := range reps {
			if len(rs.OwnerReferences) > 0 {
				for _, ownerRef := range rs.OwnerReferences {
					if ownerRef.Controller != nil && *ownerRef.Controller {
						key := fmt.Sprintf("%s_%s_%s", ownerRef.Name, rs.Name, rs.ResourceVersion)
						if currRS, ok := activeRSMap[key]; ok {
							if currRS.CreationTimestamp.Time.Before(rs.CreationTimestamp.Time) {
								activeRSMap[key] = rs
							}
						} else {
							activeRSMap[key] = rs
						}
					}
				}
			} else {
				// it is it's own controller
				activeRSMap[rs.Name] = rs
			}
		}

		lenRS := len(activeRSMap)
		result = make([]apps_v1.ReplicaSet, lenRS)
		i := 0
		for _, activeRS := range activeRSMap {
			// Do not modify what is returned by the lister since that is shared and will cause data races.
			rs := activeRS.DeepCopy()
			rs.Kind = kubernetes.ReplicaSetType
			result[i] = *rs
			i = i + 1
		}
		log.Tracef("[Kiali Cache] Get [resource: ReplicaSet] for [namespace: %s] = %d", namespace, lenRS)
	}
	return result, nil
}

func (c *kubeCache) GetDestinationRule(namespace, name string) (*networking_v1beta1.DestinationRule, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	dr, err := c.getCacheLister(namespace).destinationRuleLister.DestinationRules(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retDR := dr.DeepCopy()
	retDR.Kind = kubernetes.DestinationRuleType
	return retDR, nil
}

func (c *kubeCache) GetDestinationRules(namespace, labelSelector string) ([]*networking_v1beta1.DestinationRule, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	drs, err := c.getCacheLister(namespace).destinationRuleLister.DestinationRules(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if drs == nil {
		return []*networking_v1beta1.DestinationRule{}, nil
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	var retDRs []*networking_v1beta1.DestinationRule
	for _, dr := range drs {
		d := dr.DeepCopy()
		d.Kind = kubernetes.DestinationRuleType
		retDRs = append(retDRs, d)
	}
	return retDRs, nil
}

func (c *kubeCache) GetEnvoyFilter(namespace, name string) (*networking_v1alpha3.EnvoyFilter, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	ef, err := c.getCacheLister(namespace).envoyFilterLister.EnvoyFilters(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	// Do not modify what is returned by the lister since that is shared and will cause data races.
	retEF := ef.DeepCopy()
	retEF.Kind = kubernetes.EnvoyFilterType
	return retEF, nil
}

func (c *kubeCache) GetEnvoyFilters(namespace, labelSelector string) ([]*networking_v1alpha3.EnvoyFilter, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	efs, err := c.getCacheLister(namespace).envoyFilterLister.EnvoyFilters(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if efs == nil {
		return []*networking_v1alpha3.EnvoyFilter{}, nil
	}

	var retEFs []*networking_v1alpha3.EnvoyFilter
	for _, ef := range efs {
		e := ef.DeepCopy()
		e.Kind = kubernetes.EnvoyFilterType
		retEFs = append(retEFs, e)
	}
	return retEFs, nil
}

func (c *kubeCache) GetGateway(namespace, name string) (*networking_v1beta1.Gateway, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	gw, err := c.getCacheLister(namespace).gatewayLister.Gateways(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retGW := gw.DeepCopy()
	retGW.Kind = kubernetes.GatewayType
	return retGW, nil
}

func (c *kubeCache) GetGateways(namespace, labelSelector string) ([]*networking_v1beta1.Gateway, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	gateways, err := c.getCacheLister(namespace).gatewayLister.Gateways(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if gateways == nil {
		return []*networking_v1beta1.Gateway{}, nil
	}

	var retGateways []*networking_v1beta1.Gateway
	for _, gw := range gateways {
		g := gw.DeepCopy()
		g.Kind = kubernetes.GatewayType
		retGateways = append(retGateways, g)
	}
	return retGateways, nil
}

func (c *kubeCache) GetServiceEntry(namespace, name string) (*networking_v1beta1.ServiceEntry, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	se, err := c.getCacheLister(namespace).serviceEntryLister.ServiceEntries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retSE := se.DeepCopy()
	retSE.Kind = kubernetes.ServiceEntryType
	return retSE, nil
}

func (c *kubeCache) GetServiceEntries(namespace, labelSelector string) ([]*networking_v1beta1.ServiceEntry, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	ses, err := c.getCacheLister(namespace).serviceEntryLister.ServiceEntries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if ses == nil {
		return []*networking_v1beta1.ServiceEntry{}, nil
	}

	var retSEs []*networking_v1beta1.ServiceEntry
	for _, se := range ses {
		s := se.DeepCopy()
		s.Kind = kubernetes.ServiceEntryType
		retSEs = append(retSEs, s)
	}
	return retSEs, nil
}

func (c *kubeCache) GetSidecar(namespace, name string) (*networking_v1beta1.Sidecar, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	sc, err := c.getCacheLister(namespace).sidecarLister.Sidecars(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retSC := sc.DeepCopy()
	retSC.Kind = kubernetes.SidecarType
	return retSC, nil
}

func (c *kubeCache) GetSidecars(namespace, labelSelector string) ([]*networking_v1beta1.Sidecar, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	sidecars, err := c.getCacheLister(namespace).sidecarLister.Sidecars(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if sidecars == nil {
		return []*networking_v1beta1.Sidecar{}, nil
	}

	var retSC []*networking_v1beta1.Sidecar
	for _, sc := range sidecars {
		s := sc.DeepCopy()
		s.Kind = kubernetes.SidecarType
		retSC = append(retSC, s)
	}
	return retSC, nil
}

func (c *kubeCache) GetVirtualService(namespace, name string) (*networking_v1beta1.VirtualService, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	vs, err := c.getCacheLister(namespace).virtualServiceLister.VirtualServices(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retVS := vs.DeepCopy()
	retVS.Kind = kubernetes.VirtualServiceType
	return retVS, nil
}

func (c *kubeCache) GetVirtualServices(namespace, labelSelector string) ([]*networking_v1beta1.VirtualService, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	vs, err := c.getCacheLister(namespace).virtualServiceLister.VirtualServices(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if vs == nil {
		return []*networking_v1beta1.VirtualService{}, nil
	}

	var retVS []*networking_v1beta1.VirtualService
	for _, v := range vs {
		vv := v.DeepCopy()
		vv.Kind = kubernetes.VirtualServiceType
		retVS = append(retVS, vv)
	}
	return retVS, nil
}

func (c *kubeCache) GetWorkloadEntry(namespace, name string) (*networking_v1beta1.WorkloadEntry, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	we, err := c.getCacheLister(namespace).workloadEntryLister.WorkloadEntries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retWE := we.DeepCopy()
	retWE.Kind = kubernetes.WorkloadEntryType
	return retWE, nil
}

func (c *kubeCache) GetWorkloadEntries(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadEntry, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	we, err := c.getCacheLister(namespace).workloadEntryLister.WorkloadEntries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if we == nil {
		return []*networking_v1beta1.WorkloadEntry{}, nil
	}

	var retWE []*networking_v1beta1.WorkloadEntry
	for _, w := range we {
		ww := w.DeepCopy()
		ww.Kind = kubernetes.WorkloadEntryType
		retWE = append(retWE, ww)
	}
	return retWE, nil
}

func (c *kubeCache) GetWorkloadGroup(namespace, name string) (*networking_v1beta1.WorkloadGroup, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	wg, err := c.getCacheLister(namespace).workloadGroupLister.WorkloadGroups(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retWG := wg.DeepCopy()
	retWG.Kind = kubernetes.WorkloadGroupType
	return retWG, nil
}

func (c *kubeCache) GetWorkloadGroups(namespace, labelSelector string) ([]*networking_v1beta1.WorkloadGroup, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	wg, err := c.getCacheLister(namespace).workloadGroupLister.WorkloadGroups(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if wg == nil {
		return []*networking_v1beta1.WorkloadGroup{}, nil
	}

	var retWG []*networking_v1beta1.WorkloadGroup
	for _, w := range wg {
		ww := w.DeepCopy()
		ww.Kind = kubernetes.WorkloadGroupType
		retWG = append(retWG, ww)
	}
	return retWG, nil
}

func (c *kubeCache) GetWasmPlugin(namespace, name string) (*extentions_v1alpha1.WasmPlugin, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	wp, err := c.getCacheLister(namespace).wasmPluginLister.WasmPlugins(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retWP := wp.DeepCopy()
	retWP.Kind = kubernetes.WasmPluginType
	return retWP, nil
}

func (c *kubeCache) GetWasmPlugins(namespace, labelSelector string) ([]*extentions_v1alpha1.WasmPlugin, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	wp, err := c.getCacheLister(namespace).wasmPluginLister.WasmPlugins(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if wp == nil {
		return []*extentions_v1alpha1.WasmPlugin{}, nil
	}

	var retWP []*extentions_v1alpha1.WasmPlugin
	for _, w := range wp {
		ww := w.DeepCopy()
		ww.Kind = kubernetes.WasmPluginType
		retWP = append(retWP, ww)
	}
	return retWP, nil
}

func (c *kubeCache) GetTelemetry(namespace, name string) (*v1alpha1.Telemetry, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	t, err := c.getCacheLister(namespace).telemetryLister.Telemetries(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retT := t.DeepCopy()
	retT.Kind = kubernetes.TelemetryType
	return retT, nil
}

func (c *kubeCache) GetTelemetries(namespace, labelSelector string) ([]*v1alpha1.Telemetry, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	t, err := c.getCacheLister(namespace).telemetryLister.Telemetries(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if t == nil {
		return []*v1alpha1.Telemetry{}, nil
	}

	var retT []*v1alpha1.Telemetry
	for _, w := range t {
		tt := w.DeepCopy()
		tt.Kind = kubernetes.TelemetryType
		retT = append(retT, tt)
	}

	return retT, nil
}

func (c *kubeCache) GetK8sGateway(namespace, name string) (*gatewayapi_v1beta1.Gateway, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	g, err := c.getCacheLister(namespace).k8sgatewayLister.Gateways(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retG := g.DeepCopy()
	retG.Kind = kubernetes.K8sGatewayType
	return retG, nil
}

func (c *kubeCache) GetK8sGateways(namespace, labelSelector string) ([]*gatewayapi_v1beta1.Gateway, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	g, err := c.getCacheLister(namespace).k8sgatewayLister.Gateways(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if g == nil {
		return []*gatewayapi_v1beta1.Gateway{}, nil
	}

	var retG []*gatewayapi_v1beta1.Gateway
	for _, w := range g {
		gg := w.DeepCopy()
		gg.Kind = kubernetes.K8sGatewayType
		retG = append(retG, gg)
	}

	return retG, nil
}

func (c *kubeCache) GetK8sHTTPRoute(namespace, name string) (*gatewayapi_v1beta1.HTTPRoute, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	g, err := c.getCacheLister(namespace).k8shttprouteLister.HTTPRoutes(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retG := g.DeepCopy()
	retG.Kind = kubernetes.K8sHTTPRouteType
	return retG, nil
}

func (c *kubeCache) GetK8sHTTPRoutes(namespace, labelSelector string) ([]*gatewayapi_v1beta1.HTTPRoute, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	r, err := c.getCacheLister(namespace).k8shttprouteLister.HTTPRoutes(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if r == nil {
		return []*gatewayapi_v1beta1.HTTPRoute{}, nil
	}

	var retRoutes []*gatewayapi_v1beta1.HTTPRoute
	for _, w := range r {
		ww := w.DeepCopy()
		ww.Kind = kubernetes.K8sHTTPRouteType
		retRoutes = append(retRoutes, ww)
	}

	return retRoutes, nil
}

func (c *kubeCache) GetAuthorizationPolicy(namespace, name string) (*security_v1beta1.AuthorizationPolicy, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	ap, err := c.getCacheLister(namespace).authzLister.AuthorizationPolicies(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retAP := ap.DeepCopy()
	retAP.Kind = kubernetes.AuthorizationPoliciesType
	return retAP, nil
}

func (c *kubeCache) GetAuthorizationPolicies(namespace, labelSelector string) ([]*security_v1beta1.AuthorizationPolicy, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	authPolicies, err := c.getCacheLister(namespace).authzLister.AuthorizationPolicies(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if authPolicies == nil {
		return []*security_v1beta1.AuthorizationPolicy{}, nil
	}

	var retAPs []*security_v1beta1.AuthorizationPolicy
	for _, ap := range authPolicies {
		a := ap.DeepCopy()
		a.Kind = kubernetes.AuthorizationPoliciesType
		retAPs = append(retAPs, a)
	}
	return retAPs, nil
}

func (c *kubeCache) GetPeerAuthentication(namespace, name string) (*security_v1beta1.PeerAuthentication, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	pa, err := c.getCacheLister(namespace).peerAuthnLister.PeerAuthentications(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retPA := pa.DeepCopy()
	retPA.Kind = kubernetes.PeerAuthenticationsType
	return retPA, nil
}

func (c *kubeCache) GetPeerAuthentications(namespace, labelSelector string) ([]*security_v1beta1.PeerAuthentication, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	peerAuths, err := c.getCacheLister(namespace).peerAuthnLister.PeerAuthentications(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if peerAuths == nil {
		return []*security_v1beta1.PeerAuthentication{}, nil
	}

	var retPAs []*security_v1beta1.PeerAuthentication
	for _, pa := range peerAuths {
		p := pa.DeepCopy()
		p.Kind = kubernetes.PeerAuthenticationsType
		retPAs = append(retPAs, p)
	}
	return retPAs, nil
}

func (c *kubeCache) GetRequestAuthentication(namespace, name string) (*security_v1beta1.RequestAuthentication, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	ra, err := c.getCacheLister(namespace).requestAuthnLister.RequestAuthentications(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	retRA := ra.DeepCopy()
	retRA.Kind = kubernetes.RequestAuthenticationsType
	return retRA, nil
}

func (c *kubeCache) GetRequestAuthentications(namespace, labelSelector string) ([]*security_v1beta1.RequestAuthentication, error) {
	if err := checkIstioAPIsExist(c.client); err != nil {
		return nil, err
	}

	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	// Read lock will prevent the cache from being refreshed while we are reading from the lister
	// but it won't prevent other routines from reading from the lister.
	defer c.cacheLock.RUnlock()
	c.cacheLock.RLock()
	reqAuths, err := c.getCacheLister(namespace).requestAuthnLister.RequestAuthentications(namespace).List(selector)
	if err != nil {
		return nil, err
	}

	// Lister returns nil when there are no results but callers of the cache expect an empty array
	// so keeping the behavior the same since it matters for json marshalling.
	if reqAuths == nil {
		return []*security_v1beta1.RequestAuthentication{}, nil
	}

	var retRAs []*security_v1beta1.RequestAuthentication
	for _, ra := range reqAuths {
		r := ra.DeepCopy()
		r.Kind = kubernetes.RequestAuthenticationsType
		retRAs = append(retRAs, r)
	}
	return retRAs, nil
}
