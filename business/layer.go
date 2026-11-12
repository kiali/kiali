package business

import (
	"context"
	"errors"
	"slices"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util/sliceutil"
)

// Layer is a container for fast access to inner services.
// A business layer is created per token/user. Any data that
// needs to be saved across layers is saved in the Kiali Cache.
type Layer struct {
	App          AppService
	Health       HealthService
	IstioConfig  IstioConfigService
	IstioStatus  IstioStatusService
	Tracing      TracingService
	Mesh         MeshService
	Namespace    NamespaceService
	ProxyLogging ProxyLoggingService
	ProxyStatus  ProxyStatusService
	Svc          SvcService
	TLS          TLSService
	Validations  IstioValidationsService
	Workload     WorkloadService

	conf       *config.Config
	kialiCache cache.KialiCache
}

// CheckClusterCacheAvailable returns a non-nil error when the Kiali service-account kube
// cache for the named cluster cannot serve reads - the cluster's access was revoked and its
// cache torn down, or no cache is configured for it. Aggregating callers that span multiple
// clusters (e.g. the graph engine) use this to skip such clusters instead of failing the
// whole request; the home cluster is not skippable.
func (in *Layer) CheckClusterCacheAvailable(cluster string) error {
	_, err := in.kialiCache.GetKubeCache(cluster)
	return err
}

// SkipUnavailableCluster decides what a per-cluster request should do when the cluster's
// service-account cache cannot serve reads (see CheckClusterCacheAvailable). The home
// cluster is not skippable: the error is returned so the request fails cleanly. A remote
// cluster is skipped: the caller should serve its empty result (an empty list, a zero
// status) rather than fail the whole page.
//
// A cluster with no cache configured at all is a configuration error - the cluster name
// appears in the configuration but no connected cluster matches it (a typo, or a cluster
// that does not exist in this environment), so no cache was ever created and it will not
// recover until the configuration is fixed - so it fails the request too: the caller
// explicitly named this cluster, and an error tells them the name is wrong instead of
// silently returning an empty result. Aggregating surfaces (the mesh resolution, the
// graph, the validations reconciler) deliberately do not fail on such a cluster - they
// skip it with an error-level log - so a single misconfigured cluster name cannot break
// cross-cluster views.
//
// The skip applies to list and status surfaces, where an empty result is meaningful.
// Entity-detail surfaces (a single workload, app, service or config object) fail cleanly
// on any unavailable cache: no meaningful empty entity exists to serve.
func (in *Layer) SkipUnavailableCluster(ctx context.Context, cluster string) (bool, error) {
	err := in.CheckClusterCacheAvailable(cluster)
	if err == nil {
		return false, nil
	}
	if cluster == in.conf.KubernetesConfig.ClusterName || errors.Is(err, cache.ErrClusterNotCached) {
		return false, err
	}
	log.FromContext(ctx).Warn().Msgf("Skipping cluster [%s]: %s", cluster, err)
	return true, nil
}

// excludeRevokedNamespaces drops the cluster's partially-revoked namespaces from the
// list. A namespace is revoked when its access was taken away while the rest of the
// cluster remains readable: its informers cannot refresh, so reads from it would serve
// stale data - resources that may no longer exist. Coarse grain: a namespace counts as
// revoked when it denies any resource type the access check swept.
func excludeRevokedNamespaces(kialiCache cache.KialiCache, cluster string, namespaces []string) []string {
	revoked := kialiCache.RevokedNamespaces(cluster)
	if len(revoked) == 0 {
		return namespaces
	}
	revokedSet := make(map[string]struct{}, len(revoked))
	for _, ns := range revoked {
		revokedSet[ns] = struct{}{}
	}
	return sliceutil.Filter(namespaces, func(ns string) bool {
		_, isRevoked := revokedSet[ns]
		return !isRevoked
	})
}

// namespaceRevoked reports whether the namespace's access on the cluster was partially
// revoked; see excludeRevokedNamespaces for why callers must not serve its data.
func namespaceRevoked(kialiCache cache.KialiCache, cluster, namespace string) bool {
	return slices.Contains(kialiCache.RevokedNamespaces(cluster), namespace)
}

func newLayer(
	userClients map[string]kubernetes.UserClientInterface,
	kialiSAClients map[string]kubernetes.ClientInterface,
	prom prometheus.ClientInterface,
	traceClient tracing.ClientInterface,
	cache cache.KialiCache,
	conf *config.Config,
	grafana *grafana.Service,
	discovery istio.MeshDiscovery,
	cpm ControlPlaneMonitor,
) *Layer {
	temporaryLayer := &Layer{
		conf:       conf,
		kialiCache: cache,
	}

	homeClusterName := conf.KubernetesConfig.ClusterName

	// TODO: Modify the k8s argument to other services to pass the whole k8s map if needed
	temporaryLayer.App = NewAppService(temporaryLayer, conf, cache, prom, grafana, userClients)
	temporaryLayer.Health = NewHealthService(temporaryLayer, conf, cache, prom, userClients)
	temporaryLayer.IstioConfig = IstioConfigService{conf: conf, userClients: userClients, saClients: kialiSAClients, kialiCache: cache, businessLayer: temporaryLayer, controlPlaneMonitor: cpm}
	temporaryLayer.IstioStatus = NewIstioStatusService(cache, conf, discovery, kialiSAClients[homeClusterName], &temporaryLayer.Tracing, userClients, &temporaryLayer.Workload, &temporaryLayer.Health, &temporaryLayer.Namespace)
	temporaryLayer.Namespace = NewNamespaceService(cache, conf, discovery, kialiSAClients, userClients)
	temporaryLayer.Mesh = NewMeshService(conf, discovery, kialiSAClients)
	temporaryLayer.ProxyStatus = NewProxyStatusService(conf, cache, discovery, kialiSAClients, &temporaryLayer.Namespace)
	// Out of order because it relies on ProxyStatus
	temporaryLayer.ProxyLogging = ProxyLoggingService{conf: conf, userClients: userClients, proxyStatus: &temporaryLayer.ProxyStatus}
	temporaryLayer.Svc = SvcService{conf: conf, kialiCache: cache, businessLayer: temporaryLayer, prom: prom, userClients: userClients}
	temporaryLayer.TLS = TLSService{conf: conf, discovery: discovery, userClients: userClients, kialiCache: cache, businessLayer: temporaryLayer}
	temporaryLayer.Validations = NewValidationsService(conf, &temporaryLayer.IstioConfig, cache, &temporaryLayer.Mesh, &temporaryLayer.Namespace, &temporaryLayer.Svc, userClients, &temporaryLayer.Workload)
	temporaryLayer.Workload = *NewWorkloadService(cache, conf, grafana, kialiSAClients, temporaryLayer, prom, userClients)
	temporaryLayer.Tracing = NewTracingService(conf, traceClient, &temporaryLayer.Svc, &temporaryLayer.Workload, &temporaryLayer.App, &temporaryLayer.Namespace)
	return temporaryLayer
}

// NewLayer creates the business layer using the passed k8sClients and prom clients.
// Note that the client passed here should *not* be the Kiali ServiceAccount client.
// It should be the user client based on the logged in user's token.
func NewLayer(
	conf *config.Config,
	cache cache.KialiCache,
	cf kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	traceClient tracing.ClientInterface,
	cpm ControlPlaneMonitor,
	grafana *grafana.Service,
	discovery istio.MeshDiscovery,
	authInfos map[string]*api.AuthInfo,
) (*Layer, error) {
	userClients, err := cf.GetClients(authInfos)
	if err != nil {
		return nil, err
	}

	kialiSAClients := cf.GetSAClients()
	return newLayer(userClients, kialiSAClients, prom, traceClient, cache, conf, grafana, discovery, cpm), nil
}

// NewLayer creates the business layer using the passed k8sClients and prom clients.
// Note that the client passed here should *not* be the Kiali ServiceAccount client.
// It should be the user client based on the logged in user's token.
// TODO: Remove this when the services in the business layer are no longer coupled
// to the business layer and can be used separately.
func NewLayerWithSAClients(
	conf *config.Config,
	cache cache.KialiCache,
	prom prometheus.ClientInterface,
	traceClient tracing.ClientInterface,
	cpm ControlPlaneMonitor,
	grafana *grafana.Service,
	discovery *istio.Discovery,
	saClients map[string]kubernetes.UserClientInterface, // note this is typed as UserClientInterface!
) (*Layer, error) {
	return newLayer(saClients, kubernetes.ConvertFromUserClients(saClients), prom, traceClient, cache, conf, grafana, discovery, cpm), nil
}
