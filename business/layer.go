package business

import (
	"context"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// Layer is a container for fast access to inner services.
// A business layer is created per token/user. Any data that
// needs to be saved across layers is saved in the Kiali Cache.
type Layer struct {
	App          AppService
	Health       HealthService
	IstioConfig  IstioConfigService
	IstioStatus  IstioStatusService
	Mesh         MeshService
	Namespace    NamespaceService
	ProxyLogging ProxyLoggingService
	ProxyStatus  ProxyStatusService
	Svc          SvcService
	TLS          TLSService
	Tracing      TracingService
	Validations  IstioValidationsService
	Workload     WorkloadService

	kialiCache cache.KialiCache
}

// SkipUnavailableCluster decides what a per-cluster request should do when the cluster's
// service-account cache cannot serve reads: the home cluster is not skippable (the error
// is returned so the request fails cleanly), a remote cluster is skipped (the caller
// should serve its empty result - an empty list, a zero status - rather than fail the
// whole page), and a cluster with no cache configured at all fails too, because the
// caller explicitly named it and an error tells them the name is wrong instead of
// silently returning an empty result. It delegates to
// cache.KialiCache.SkipUnavailableCluster, which owns the decision and its full contract,
// and logs the skip through the request's context.
//
// The skip applies to list and status surfaces, where an empty result is meaningful.
// Entity-detail surfaces (a single workload, app, service or config object) fail cleanly
// on any unavailable cache: no meaningful empty entity exists to serve.
func (in *Layer) SkipUnavailableCluster(ctx context.Context, cluster string) (bool, error) {
	_, skip, err := in.kialiCache.SkipUnavailableCluster(cluster, "", cache.SkipModeRequest)
	if skip {
		// err is the cause of the skip; the request still succeeds with the empty result.
		log.FromContext(ctx).Warn().Msgf("Skipping cluster [%s]: %s", cluster, err)
		return true, nil
	}
	return false, err
}

// SkipUnavailableClusterForAggregate is the aggregating-surface variant of
// SkipUnavailableCluster (the mesh resolution, the graph, the validations reconciler): an
// uncached cluster is skipped with an error-level log instead of failing, so one
// misconfigured cluster name cannot break cross-cluster views. See
// cache.KialiCache.SkipUnavailableCluster for the full contract. The skip's cause is
// swallowed: the cache already logged it, and the caller only needs to skip.
func (in *Layer) SkipUnavailableClusterForAggregate(cluster, surface string) (bool, error) {
	_, skip, err := in.kialiCache.SkipUnavailableCluster(cluster, surface, cache.SkipModeAggregate)
	if skip {
		return true, nil
	}
	return false, err
}

// SkipUnavailableClusterSilent is the aggregating-surface variant that skips without
// logging, for the graph appenders' per-namespace filters: the drop is already logged
// once per build by dropUnavailableClusterNodes, and this filter runs per appender, per
// namespace. Like SkipUnavailableClusterForAggregate, the skip's cause is swallowed.
func (in *Layer) SkipUnavailableClusterSilent(cluster string) (bool, error) {
	_, skip, err := in.kialiCache.SkipUnavailableCluster(cluster, "", cache.SkipModeSilent)
	if skip {
		return true, nil
	}
	return false, err
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
