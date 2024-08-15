package cache

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/exp/maps"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/store"
	"github.com/kiali/kiali/util"
)

const (
	ambientCheckExpirationTime = 10 * time.Minute
	meshExpirationTime         = 10 * time.Second
	waypointExpirationTime     = 1 * time.Minute
)

const (
	kialiCacheMeshKey = "mesh"
	ztunnelApp        = "ztunnel"
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
	GetBuildInfo() models.BuildInfo
	// SetBuildInfo is not threadsafe. Expected to just be called once at startup.
	SetBuildInfo(buildInfo models.BuildInfo)

	// GetClusters returns the list of clusters that the cache knows about.
	// This gets set by the mesh service.
	GetClusters() []models.KubeCluster
	GetKubeCaches() map[string]KubeCache
	GetKubeCache(cluster string) (KubeCache, error)

	GetMesh() (*models.Mesh, bool)
	SetMesh(*models.Mesh)

	// GetNamespace returns a namespace from the in memory cache if it exists.
	GetNamespace(cluster string, token string, name string) (models.Namespace, bool)

	// GetNamespaces returns all namespaces for the cluster/token from the in memory cache.
	GetNamespaces(cluster string, token string) ([]models.Namespace, bool)

	// GetZtunnelPods returns a list of ztunnel pods from the ztunnel daemonset
	GetZtunnelPods(cluster string) []v1.Pod

	// GetWaypointList returns a list of waypoint proxies workloads by cluster and namespace
	GetWaypointList() models.Workloads
	SetWaypointList(models.Workloads)
	IsWaypointListExpired() bool

	// IsAmbientEnabled checks if the istio Ambient profile was enabled
	// by checking if the ztunnel daemonset exists on the cluster.
	IsAmbientEnabled(cluster string) bool

	// RefreshTokenNamespaces clears the in memory cache of namespaces.
	RefreshTokenNamespaces(cluster string)

	RegistryStatusCache
	ProxyStatusCache

	// SetClusters sets the list of clusters that the cache knows about.
	SetClusters([]models.KubeCluster)

	// SetNamespaces sets the in memory cache of namespaces.
	// We cache all namespaces for cluster + token.
	SetNamespaces(token string, namespaces []models.Namespace)

	// SetNamespace caches a specific namespace by cluster + token.
	SetNamespace(token string, namespace models.Namespace)

	// DeleteNamespace cleans up some internals when it has been detected that a namespace has been deleted.
	DeleteNamespace(cluster string, namespace string, token string)

	// Stop stops the cache and all its kube caches.
	Stop()
}

type kialiCacheImpl struct {
	ambientChecksPerCluster store.Store[string, bool]
	// This isn't expected to change so it's not protected by a mutex.
	buildInfo models.BuildInfo
	cleanup   func()
	conf      config.Config

	clientFactory kubernetes.ClientFactory
	// Maps a cluster name to a KubeCache
	kubeCache map[string]KubeCache

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

	refreshDuration time.Duration
	// ProxyStatusStore stores the proxy status and should be key'd off cluster + namespace + pod.
	proxyStatusStore store.Store[string, *kubernetes.ProxyStatus]
	// RegistryStatusStore stores the registry status and should be key'd off of the cluster name.
	registryStatusStore store.Store[string, *kubernetes.RegistryStatus]

	waypointList models.WaypointStore

	// Info about the kube clusters that the cache knows about.
	clusters    []models.KubeCluster
	clusterLock sync.RWMutex
}

func NewKialiCache(clientFactory kubernetes.ClientFactory, cfg config.Config) (KialiCache, error) {
	ctx, cancel := context.WithCancel(context.Background())
	namespaceKeyTTL := time.Duration(cfg.KubernetesConfig.CacheTokenNamespaceDuration) * time.Second
	kialiCacheImpl := kialiCacheImpl{
		ambientChecksPerCluster: store.NewExpirationStore(ctx, store.New[string, bool](), util.AsPtr(ambientCheckExpirationTime), nil),
		cleanup:                 cancel,
		clientFactory:           clientFactory,
		conf:                    cfg,
		kubeCache:               make(map[string]KubeCache),
		meshStore:               store.NewExpirationStore(ctx, store.New[string, *models.Mesh](), util.AsPtr(meshExpirationTime), nil),
		namespaceStore:          store.NewExpirationStore(ctx, store.New[namespacesKey, map[string]models.Namespace](), &namespaceKeyTTL, nil),
		refreshDuration:         time.Duration(cfg.KubernetesConfig.CacheDuration) * time.Second,
		proxyStatusStore:        store.New[string, *kubernetes.ProxyStatus](),
		registryStatusStore:     store.New[string, *kubernetes.RegistryStatus](),
	}

	for cluster, client := range clientFactory.GetSAClients() {
		cache, err := NewKubeCache(client, cfg, &kialiCacheImpl)
		if err != nil {
			log.Errorf("[Kiali Cache] Error creating kube cache for cluster: [%s]. Err: %v", cluster, err)
			return nil, err
		}
		log.Infof("[Kiali Cache] Kube cache is active for cluster: [%s]", cluster)

		kialiCacheImpl.kubeCache[cluster] = cache
	}

	// TODO: Treat all clusters the same way.
	// Ensure home client got set.
	if _, found := kialiCacheImpl.kubeCache[cfg.KubernetesConfig.ClusterName]; !found {
		return nil, fmt.Errorf("home cluster not configured in kiali cache")
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

// IsAmbientEnabled checks if the istio Ambient profile was enabled
// by checking if the ztunnel daemonset exists on the cluster.
func (in *kialiCacheImpl) IsAmbientEnabled(cluster string) bool {
	check, found := in.ambientChecksPerCluster.Get(cluster)
	if !found {
		kubeCache, err := in.GetKubeCache(cluster)
		if err != nil {
			log.Debugf("Unable to get kube cache when checking for ambient profile: %s", err)
			return false
		}

		selector := map[string]string{
			"app": ztunnelApp,
		}
		daemonsets, err := kubeCache.GetDaemonSetsWithSelector(metav1.NamespaceAll, selector)
		if err != nil {
			// Don't set the check so we will check again the next time since this error may be transient.
			log.Debugf("Error checking for ztunnel in Kiali accessible namespaces in cluster '%s': %s", cluster, err.Error())
			return false
		}

		if len(daemonsets) == 0 {
			log.Debugf("No ztunnel daemonsets found in Kiali accessible namespaces in cluster '%s'", cluster)
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
	ztunnelPods := []v1.Pod{}
	kubeCache, err := in.GetKubeCache(cluster)
	if err != nil {
		log.Debugf("Unable to get kube cache when checking for ambient profile: %s", err)
		return ztunnelPods

	}
	selector := map[string]string{
		"app": ztunnelApp,
	}
	daemonsets, err := kubeCache.GetDaemonSetsWithSelector(metav1.NamespaceAll, selector)
	if err != nil {
		// Don't set the check so we will check again the next time since this error may be transient.
		log.Debugf("Error checking for ztunnel in Kiali accessible namespaces in cluster '%s': %s", cluster, err.Error())
		return ztunnelPods
	}

	if len(daemonsets) == 0 {
		log.Debugf("No ztunnel daemonsets found in Kiali accessible namespaces in cluster '%s'", cluster)
		return ztunnelPods
	}

	dsPods, err := kubeCache.GetPods(daemonsets[0].Namespace, "")
	if err != nil {
		log.Errorf("Unable to get ztunnel pods: %s", err)
		return ztunnelPods

	}

	for _, pod := range dsPods {
		if strings.Contains(pod.Name, ztunnelApp) {
			ztunnelPods = append(ztunnelPods, pod)
		}
	}

	return ztunnelPods
}

// GetWaypointList Returns a list of waypoint proxies by cluster and namespace
func (c *kialiCacheImpl) GetWaypointList() models.Workloads {
	return c.waypointList.Waypoints
}

// SetWaypointList Modifies the list of waypoint proxies by cluster and namespace
func (c *kialiCacheImpl) SetWaypointList(wpList models.Workloads) {
	c.waypointList.Waypoints = wpList
	c.waypointList.LastUpdate = time.Now()
}

func (c *kialiCacheImpl) IsWaypointListExpired() bool {
	currentTime := time.Now()
	expirationTime := c.waypointList.LastUpdate.Add(waypointExpirationTime)
	return currentTime.After(expirationTime)
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

// DeleteNamespace should be called when it has been detected that a namespace was deleted from a particular cluster.
// This cleans up some internals related to the namespace that is now gone.
func (c *kialiCacheImpl) DeleteNamespace(cluster string, namespace string, token string) {
	c.namespacesLock.Lock()
	defer c.namespacesLock.Unlock()

	key := namespacesKey{cluster: cluster, token: token}
	c.namespaceStore.Remove(key)

	if kubeCache, err := c.GetKubeCache(cluster); err == nil {
		kubeCache.StopNamespace(namespace)
	}
}

func (c *kialiCacheImpl) GetBuildInfo() models.BuildInfo {
	return c.buildInfo
}

func (c *kialiCacheImpl) SetBuildInfo(buildInfo models.BuildInfo) {
	c.buildInfo = buildInfo
}

// Interface guard for kiali cache impl
var _ KialiCache = (*kialiCacheImpl)(nil)
