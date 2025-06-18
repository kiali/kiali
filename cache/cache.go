package cache

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/exp/maps"
	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"sigs.k8s.io/controller-runtime/pkg/client"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/store"
	"github.com/kiali/kiali/util"
)

const (
	kialiCacheGatewaysKey    = "gateways"
	kialiCacheIstioStatusKey = "istioStatus"
	kialiCacheMeshKey        = "mesh"
	kialiCacheWaypointsKey   = "waypoints"
)

// KialiCache stores both kube objects and non-kube related data such as pods' proxy status.
// It is exclusively used by the business layer where it's expected to be a singleton.
// This business layer cache needs access to all the kiali service account has access
// to so it uses the kiali service account token instead of a user token. Access to
// the objects returned by the cache should be filtered/restricted to the user's
// token access but the cache returns objects without any filtering or restrictions.
// This object keeps one KubeCache per cluster.
// TODO: Consider removing the interface altogether in favor of just exporting the struct.
type KialiCache interface {
	CanListWebhooks(cluster string) bool
	GetBuildInfo() models.BuildInfo
	// SetBuildInfo is not threadsafe. Expected to just be called once at startup.
	SetBuildInfo(buildInfo models.BuildInfo)

	// GetClusters returns the list of clusters that the cache knows about.
	// This gets set by the mesh service.
	GetClusters() []models.KubeCluster

	GetGateways() (models.Workloads, bool)
	SetGateways(models.Workloads)

	GatewayAPIClasses(cluster string) []config.GatewayAPIClass

	GetIstioStatus() (kubernetes.IstioComponentStatus, bool)
	SetIstioStatus(kubernetes.IstioComponentStatus)

	GetKubeCache(cluster string) (client.Reader, error)

	GetMesh() (*models.Mesh, bool)
	SetMesh(*models.Mesh)

	// GetNamespace returns a namespace from the in memory cache if it exists.
	GetNamespace(cluster string, token string, name string) (models.Namespace, bool)

	// GetNamespaces returns all namespaces for the cluster/token from the in memory cache.
	GetNamespaces(cluster string, token string) ([]models.Namespace, bool)

	GetWaypoints() (models.Workloads, bool)
	SetWaypoints(models.Workloads)

	// GetZtunnelPods returns a list of ztunnel pods from the ztunnel daemonset
	GetZtunnelPods(cluster string) []v1.Pod

	// IsAmbientEnabled checks if the istio Ambient profile was enabled
	// by checking if the ztunnel daemonset exists on the cluster.
	IsAmbientEnabled(cluster string) bool

	// RefreshTokenNamespaces clears the in memory cache of namespaces.
	RefreshTokenNamespaces(cluster string)

	RegistryStatusCache
	ProxyStatusCache
	ZtunnelDumpCache

	// Validations caches validations for a cluster/namespace.
	Validations() store.Store[models.IstioValidationKey, *models.IstioValidation]

	// ValidationWatcher stores values used for detecting changes in config used for validation
	ValidationConfig() store.Store[string, string]

	// SetClusters sets the list of clusters that the cache knows about.
	SetClusters([]models.KubeCluster)

	// SetNamespaces sets the in memory cache of namespaces.
	// We cache all namespaces for cluster + token.
	SetNamespaces(token string, namespaces []models.Namespace)

	// SetNamespace caches a specific namespace by cluster + token.
	SetNamespace(token string, namespace models.Namespace)

	// Stop stops the cache and all its kube caches.
	Stop()
}

type kialiCacheImpl struct {
	ambientChecksPerCluster store.Store[string, bool]
	// This isn't expected to change so it's not protected by a mutex.
	buildInfo               models.BuildInfo
	canReadWebhookByCluster map[string]bool
	cleanup                 func()
	clients                 map[string]kubernetes.ClientInterface
	conf                    config.Config

	// Info about the kube clusters that the cache knows about.
	clusters    []models.KubeCluster
	clusterLock sync.RWMutex

	// TODO: do we want to remove this and pass the logger via a context to the cache interface functions?
	zl *zerolog.Logger

	// Cache gateways to speed up access for these specific workloads. The only key is kialiCacheGatewaysKey
	gatewayStore store.Store[string, models.Workloads]

	// There's only ever one IstioStatus but we want to reuse the store machinery
	// so using a store here but the only key should be kialiCacheIstioStatusKey.
	istioStatusStore store.Store[string, kubernetes.IstioComponentStatus]

	// Maps a cluster name to a KubeCache
	kubeCache map[string]client.Reader

	// There's only ever one mesh but we want to reuse the store machinery
	// so using a store here but the only key should be kialiCacheMeshKey.
	meshStore store.Store[string, *models.Mesh]

	// Store the namespaces per token + cluster as a map[string]namespace where string is the namespace name
	// so you can easily deref the namespace in GetNamespace and SetNamespace. The downside to this is that
	// we need an additional lock for the namespace map that gets returned from the store to ensure it is threadsafe.
	namespaceStore store.Store[namespacesKey, map[string]models.Namespace]

	// Only necessary because we want to cache the namespaces per cluster and token as a map
	// and maps are not thread safe. We need an additional lock on top of the Store to ensure
	// that the map returned from the store is threadsafe.
	namespacesLock sync.RWMutex

	// ProxyStatusStore stores the proxy status and should be key'd off cluster + namespace + pod.
	proxyStatusStore store.Store[string, *kubernetes.ProxyStatus]

	refreshDuration time.Duration

	// RegistryStatusStore stores the registry status and should be key'd off of the cluster name.
	registryStatusStore store.Store[string, *kubernetes.RegistryStatus]

	// validations key'd by the validation key
	validations      store.Store[models.IstioValidationKey, *models.IstioValidation]
	validationConfig store.Store[string, string]

	// Cache gateways to speed up access for these specific workloads. The only key is kialiCacheWaypointsKey
	waypointStore store.Store[string, models.Workloads]

	// ProxyStatusStore stores ztunnel config dump per cluster + namespace + pod.
	ztunnelConfigStore store.Store[string, *kubernetes.ZtunnelConfigDump]
}

func NewKialiCache(kialiSAClients map[string]kubernetes.ClientInterface, kubeCache map[string]client.Reader, conf config.Config) (KialiCache, error) {
	zl := log.WithGroup(log.KialiCacheLogName)
	ctx := log.ToContext(context.Background(), zl)
	ctx, cancel := context.WithCancel(ctx)
	namespaceKeyTTL := time.Duration(conf.KubernetesConfig.CacheTokenNamespaceDuration) * time.Second
	kialiCacheImpl := kialiCacheImpl{
		ambientChecksPerCluster: store.NewExpirationStore(ctx, store.New[string, bool](), util.AsPtr(conf.KialiInternal.CacheExpiration.AmbientCheck), nil),
		canReadWebhookByCluster: make(map[string]bool),
		cleanup:                 cancel,
		clients:                 kialiSAClients,
		conf:                    conf,
		zl:                      zl,
		gatewayStore:            store.NewExpirationStore(ctx, store.New[string, models.Workloads](), util.AsPtr(conf.KialiInternal.CacheExpiration.Gateway), nil),
		istioStatusStore:        store.NewExpirationStore(ctx, store.New[string, kubernetes.IstioComponentStatus](), util.AsPtr(conf.KialiInternal.CacheExpiration.IstioStatus), nil),
		kubeCache:               kubeCache,
		meshStore:               store.NewExpirationStore(ctx, store.New[string, *models.Mesh](), util.AsPtr(conf.KialiInternal.CacheExpiration.Mesh), nil),
		namespaceStore:          store.NewExpirationStore(ctx, store.New[namespacesKey, map[string]models.Namespace](), &namespaceKeyTTL, nil),
		proxyStatusStore:        store.New[string, *kubernetes.ProxyStatus](),
		refreshDuration:         time.Duration(conf.KubernetesConfig.CacheDuration) * time.Second,
		registryStatusStore:     store.New[string, *kubernetes.RegistryStatus](),
		waypointStore:           store.NewExpirationStore(ctx, store.New[string, models.Workloads](), util.AsPtr(conf.KialiInternal.CacheExpiration.Waypoint), nil),
		validations:             store.New[models.IstioValidationKey, *models.IstioValidation](),
		validationConfig:        store.New[string, string](),
		ztunnelConfigStore:      store.NewExpirationStore(ctx, store.New[string, *kubernetes.ZtunnelConfigDump](), util.AsPtr(conf.KialiInternal.CacheExpiration.ZtunnelConfig), nil),
	}

	for cluster, client := range kialiSAClients {
		// Check if the cluster can list webhooks
		reviews, err := client.GetSelfSubjectAccessReview(ctx, "", "admissionregistration.k8s.io", "mutatingwebhookconfigurations", []string{"list"})
		if err != nil {
			zl.Warn().Msgf("Unable to check if kiali can read mutating webhooks to autodetect tags: %s", err)
			kialiCacheImpl.canReadWebhookByCluster[cluster] = false
		}

		for _, review := range reviews {
			if review.Status.Allowed {
				kialiCacheImpl.canReadWebhookByCluster[cluster] = true
				break
			}
		}

		if canReadMutatingWebhooks := kialiCacheImpl.canReadWebhookByCluster[cluster]; !canReadMutatingWebhooks {
			zl.Info().Msgf("Unable to list webhooks for cluster [%s]. Give Kiali permission to read 'mutatingwebhookconfigurations'.", cluster)
		}
	}

	// All clusters are treated equally - no special validation for local cluster needed
	// as long as we have at least one accessible cluster
	if len(kialiCacheImpl.kubeCache) == 0 {
		return nil, fmt.Errorf("no accessible clusters configured in kiali cache")
	}

	return &kialiCacheImpl, nil
}

func (c *kialiCacheImpl) CanListWebhooks(cluster string) bool {
	return c.canReadWebhookByCluster[cluster]
}

func (c *kialiCacheImpl) GetKubeCache(cluster string) (client.Reader, error) {
	cache, found := c.kubeCache[cluster]
	if !found {
		// This should not happen but it probably means the user clients have clusters that the cache doesn't know about.
		return nil, fmt.Errorf("cache for cluster [%s] not found", cluster)
	}
	return cache, nil
}

// Stops all caches across all clusters.
func (c *kialiCacheImpl) Stop() {
	c.zl.Info().Msgf("Stopping Kiali Cache")
	c.cleanup()
}

func (c *kialiCacheImpl) GetClusters() []models.KubeCluster {
	defer c.clusterLock.RUnlock()
	c.clusterLock.RLock()
	return c.clusters
}

func (c *kialiCacheImpl) SetClusters(clusters []models.KubeCluster) {
	defer c.clusterLock.Unlock()
	c.clusterLock.Lock()
	c.clusters = clusters
}

func (c *kialiCacheImpl) GetMesh() (*models.Mesh, bool) {
	return c.meshStore.Get(kialiCacheMeshKey)
}

func (c *kialiCacheImpl) SetMesh(mesh *models.Mesh) {
	c.meshStore.Set(kialiCacheMeshKey, mesh)
}

func (c *kialiCacheImpl) GetIstioStatus() (kubernetes.IstioComponentStatus, bool) {
	return c.istioStatusStore.Get(kialiCacheIstioStatusKey)
}

func (c *kialiCacheImpl) SetIstioStatus(istioStatus kubernetes.IstioComponentStatus) {
	c.istioStatusStore.Set(kialiCacheIstioStatusKey, istioStatus)
}

func (c *kialiCacheImpl) Validations() store.Store[models.IstioValidationKey, *models.IstioValidation] {
	return c.validations
}

func (c *kialiCacheImpl) ValidationConfig() store.Store[string, string] {
	return c.validationConfig
}

// IsAmbientEnabled checks if the istio Ambient profile was enabled
// by checking if the ztunnel daemonset exists on the cluster.
func (in *kialiCacheImpl) IsAmbientEnabled(cluster string) bool {
	check, found := in.ambientChecksPerCluster.Get(cluster)
	if !found {
		kubeCache, err := in.GetKubeCache(cluster)
		if err != nil {
			in.zl.Debug().Msgf("Unable to get kube cache when checking for ambient profile: %s", err)
			return false
		}

		daemonSetList := &appsv1.DaemonSetList{}
		selector := map[string]string{
			config.KubernetesAppLabel: config.Ztunnel,
		}
		listOpts := []client.ListOption{client.MatchingLabels(selector)}
		if err := kubeCache.List(context.TODO(), daemonSetList, listOpts...); err != nil {
			// Don't set the check so we will check again the next time since this error may be transient.
			in.zl.Debug().Msgf("Error checking for ztunnel in Kiali accessible namespaces in cluster '%s': %s", cluster, err.Error())
			return false
		}

		if len(daemonSetList.Items) == 0 {
			in.zl.Debug().Msgf("No ztunnel daemonsets found in Kiali accessible namespaces in cluster '%s'", cluster)
			in.ambientChecksPerCluster.Set(cluster, false)
			return false
		}

		in.ambientChecksPerCluster.Set(cluster, true)
		return true
	}

	return check
}

// GetZtunnelPods returns the pods list from ztunnel daemonset
func (in *kialiCacheImpl) GetZtunnelPods(cluster string) []v1.Pod {
	kubeCache, err := in.GetKubeCache(cluster)
	if err != nil {
		in.zl.Debug().Msgf("Unable to get kube cache when checking for ambient profile: %s", err)
		return nil
	}

	daemonSetList := &appsv1.DaemonSetList{}
	selector := map[string]string{
		config.KubernetesAppLabel: config.Ztunnel,
	}
	listOpts := []client.ListOption{client.MatchingLabels(selector)}
	if err := kubeCache.List(context.TODO(), daemonSetList, listOpts...); err != nil {
		// Don't set the check so we will check again the next time since this error may be transient.
		in.zl.Debug().Msgf("Error checking for ztunnel in Kiali accessible namespaces in cluster '%s': %s", cluster, err.Error())
		return nil
	}

	if len(daemonSetList.Items) == 0 {
		in.zl.Debug().Msgf("No ztunnel daemonsets found in Kiali accessible namespaces in cluster '%s'", cluster)
		return nil
	}

	podList := &v1.PodList{}
	if err := kubeCache.List(context.TODO(), podList, client.InNamespace(daemonSetList.Items[0].Namespace), client.MatchingLabels{"app": config.Ztunnel}); err != nil {
		in.zl.Error().Msgf("Unable to get ztunnel pods: %s", err)
		return nil
	}

	return podList.Items
}

// GetGateways Returns a list of all gateway workloads by cluster and namespace
func (c *kialiCacheImpl) GetGateways() (models.Workloads, bool) {
	return c.gatewayStore.Get(kialiCacheGatewaysKey)
}

// SetGateways Sets a list of all gateway workloads by cluster and namespace
func (c *kialiCacheImpl) SetGateways(gateways models.Workloads) {
	c.gatewayStore.Set(kialiCacheGatewaysKey, gateways)
}

// GatewayAPIClasses returns list of K8s GatewayAPIClass objects
// K8s Gateway API classes can come from  different places depending on the configuration:
// 1. From explicitly listed classes in the configuration if set
// 2. Auto-discovered classes that use Istio as a controller and matching a label selector in the configuration (if set)
func (c *kialiCacheImpl) GatewayAPIClasses(cluster string) []config.GatewayAPIClass {
	result := []config.GatewayAPIClass{}
	userClient := c.clients[cluster]
	if userClient == nil {
		c.zl.Error().Msgf("K8s Client [%s] is not found or is not accessible for Kiali", cluster)
		return result
	}
	// do not continue if Gateway API is not configured on cluster
	if !userClient.IsGatewayAPI() {
		return result
	}
	kubeCache, err := c.GetKubeCache(cluster)
	if err != nil {
		c.zl.Debug().Msgf("Unable to get kube cache when checking for GatewayAPIClasses: %s", err)
		return result
	}

	// First case: defined classes in config
	definedClasses := c.conf.ExternalServices.Istio.GatewayAPIClasses
	for i, gwClass := range definedClasses {
		if gwClass.ClassName != "" && gwClass.Name != "" {
			result = append(result, gwClass)
			continue
		}

		c.zl.Warn().Msgf("Gateway API class %d is missing a name or class name field. Currently set name %q, class name %q.",
			i, gwClass.Name, gwClass.ClassName)
	}

	labelSelector, err := labels.ConvertSelectorToLabelsMap(config.Get().ExternalServices.Istio.GatewayAPIClassesLabelSelector)
	if err != nil {
		c.zl.Error().Msgf("bad gateway_api_classes_label_selector: %s", err)
	}
	// If there are no configured classes, get classes using the Istio controller
	listOpts := []client.ListOption{client.MatchingLabels(labelSelector)}
	classList := &k8s_networking_v1.GatewayClassList{}
	if len(result) == 0 {
		err := kubeCache.List(context.TODO(), classList, listOpts...)
		if err != nil {
			return result
		}

		for _, class := range classList.Items {
			// Filter out classes that don't use Istio as a controller when the label filter is set
			if strings.HasPrefix(string(class.Spec.ControllerName), "istio.io") || len(labelSelector) > 0 {
				result = append(result, config.GatewayAPIClass{Name: class.Name, ClassName: class.Name})
			}
		}
	}

	if len(result) == 0 {
		c.zl.Error().Msgf("No GatewayAPIClasses configured or found in cluster '%s' by label selector '%s'", cluster, labelSelector)
	}

	return result
}

// GetWaypoints Returns a list of waypoint proxies by cluster and namespace
func (c *kialiCacheImpl) GetWaypoints() (models.Workloads, bool) {
	return c.waypointStore.Get(kialiCacheWaypointsKey)
}

// SetWaypoints Sets a list of all waypoint workloads by cluster and namespace
func (c *kialiCacheImpl) SetWaypoints(waypoints models.Workloads) {
	c.waypointStore.Set(kialiCacheWaypointsKey, waypoints)
}

type namespacesKey struct {
	cluster string
	token   string
}

func (n namespacesKey) String() string {
	return fmt.Sprintf("cluster: %s\ttoken: xxx", n.cluster)
}

func (c *kialiCacheImpl) GetNamespace(cluster string, token string, namespace string) (models.Namespace, bool) {
	c.namespacesLock.RLock()
	defer c.namespacesLock.RUnlock()

	key := namespacesKey{cluster: cluster, token: token}
	namespaces, found := c.namespaceStore.Get(key)
	if !found {
		return models.Namespace{}, false
	}

	ns, found := namespaces[namespace]
	return ns, found
}

func (c *kialiCacheImpl) GetNamespaces(cluster string, token string) ([]models.Namespace, bool) {
	c.namespacesLock.RLock()
	defer c.namespacesLock.RUnlock()

	key := namespacesKey{cluster: cluster, token: token}
	namespaces, found := c.namespaceStore.Get(key)

	return maps.Values(namespaces), found
}

func (c *kialiCacheImpl) RefreshTokenNamespaces(cluster string) {
	c.namespacesLock.Lock()
	defer c.namespacesLock.Unlock()

	for _, key := range c.namespaceStore.Keys() {
		if key.cluster == cluster {
			c.namespaceStore.Remove(key)
		}
	}
}

func (c *kialiCacheImpl) SetNamespaces(token string, namespaces []models.Namespace) {
	c.namespacesLock.Lock()
	defer c.namespacesLock.Unlock()

	namespacesByCluster := make(map[string][]models.Namespace)
	for _, namespace := range namespaces {
		namespacesByCluster[namespace.Cluster] = append(namespacesByCluster[namespace.Cluster], namespace)
	}

	for cluster, clusterNamespaces := range namespacesByCluster {
		key := namespacesKey{cluster: cluster, token: token}
		ns := make(map[string]models.Namespace)
		for _, namespace := range clusterNamespaces {
			ns[namespace.Name] = namespace
		}
		c.namespaceStore.Set(key, ns)
	}
}

func (c *kialiCacheImpl) SetNamespace(token string, namespace models.Namespace) {
	c.namespacesLock.Lock()
	defer c.namespacesLock.Unlock()

	key := namespacesKey{cluster: namespace.Cluster, token: token}
	ns, found := c.namespaceStore.Get(key)
	if !found {
		ns = make(map[string]models.Namespace)
	}

	ns[namespace.Name] = namespace
	c.namespaceStore.Set(key, ns)
}

func (c *kialiCacheImpl) GetBuildInfo() models.BuildInfo {
	return c.buildInfo
}

func (c *kialiCacheImpl) SetBuildInfo(buildInfo models.BuildInfo) {
	c.buildInfo = buildInfo
}

// Interface guard for kiali cache impl
var _ KialiCache = (*kialiCacheImpl)(nil)
