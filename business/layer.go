package business

import (
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// Layer is a container for fast access to inner services.
// A business layer is created per token/user. Any data that
// needs to be saved across layers is saved in the Kiali Cache.
type Layer struct {
	App            AppService
	Health         HealthService
	IstioConfig    IstioConfigService
	IstioStatus    IstioStatusService
	Tracing        TracingService
	Mesh           MeshService
	Namespace      NamespaceService
	ProxyLogging   ProxyLoggingService
	ProxyStatus    ProxyStatusService
	RegistryStatus RegistryStatusService
	Svc            SvcService
	TLS            TLSService
	Validations    IstioValidationsService
	Workload       WorkloadService
}

// Global clientfactory and prometheus clients.
var (
	clientFactory       kubernetes.ClientFactory
	discovery           istio.MeshDiscovery
	grafanaService      *grafana.Service
	kialiCache          cache.KialiCache
	poller              ControlPlaneMonitor
	prometheusClient    prometheus.ClientInterface
	tracingClientLoader func() tracing.ClientInterface
)

// Start sets the globals necessary for the business layer.
// TODO: Refactor out global vars.
func Start(
	cf kubernetes.ClientFactory,
	controlPlaneMonitor ControlPlaneMonitor,
	cache cache.KialiCache,
	disc istio.MeshDiscovery,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
) {
	clientFactory = cf
	discovery = disc
	grafanaService = grafana
	kialiCache = cache
	poller = controlPlaneMonitor
	prometheusClient = prom
	tracingClientLoader = traceClientLoader
}

// Get the business.Layer
func Get(authInfos map[string]*api.AuthInfo) (*Layer, error) {
	// Creates new k8s clients based on the current users token
	userClients, err := clientFactory.GetClients(authInfos)
	if err != nil {
		return nil, err
	}

	var traceClient tracing.ClientInterface
	// This check is only necessary because many of the unit tests don't properly initialize the tracingClientLoader global variable.
	// In a real environment, Start should always be called before Get so the global should always be initialized.
	if tracingClientLoader != nil {
		traceClient = tracingClientLoader()
	}

	kialiSAClient := clientFactory.GetSAClients()
	return NewWithBackends(userClients, kialiSAClient, prometheusClient, traceClient), nil
}

// SetWithBackends allows for specifying the ClientFactory and Prometheus clients to be used.
// Mock friendly. Used only with tests.
func SetWithBackends(cf kubernetes.ClientFactory, prom prometheus.ClientInterface) {
	clientFactory = cf
	prometheusClient = prom
}

// NewWithBackends creates the business layer using the passed k8sClients and prom clients.
// Note that the client passed here should *not* be the Kiali ServiceAccount client.
// It should be the user client based on the logged in user's token.
func NewWithBackends(userClients map[string]kubernetes.UserClientInterface, kialiSAClients map[string]kubernetes.ClientInterface, prom prometheus.ClientInterface, traceClient tracing.ClientInterface) *Layer {
	return newLayer(userClients, kialiSAClients, prom, traceClient, kialiCache, config.Get(), grafanaService, discovery, poller)
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
	temporaryLayer := &Layer{}

	homeClusterName := conf.KubernetesConfig.ClusterName

	// TODO: Modify the k8s argument to other services to pass the whole k8s map if needed
	temporaryLayer.App = NewAppService(temporaryLayer, conf, prom, grafana, userClients)
	temporaryLayer.Health = HealthService{conf: conf, prom: prom, businessLayer: temporaryLayer, userClients: userClients}
	temporaryLayer.IstioConfig = IstioConfigService{conf: conf, userClients: userClients, kialiCache: cache, businessLayer: temporaryLayer, controlPlaneMonitor: cpm}
	temporaryLayer.IstioStatus = NewIstioStatusService(cache, conf, discovery, kialiSAClients[homeClusterName], &temporaryLayer.Tracing, userClients, &temporaryLayer.Workload)
	temporaryLayer.Namespace = NewNamespaceService(cache, conf, discovery, kialiSAClients, userClients)
	temporaryLayer.Mesh = NewMeshService(conf, discovery, kialiSAClients)
	temporaryLayer.ProxyStatus = ProxyStatusService{conf: conf, kialiSAClients: kialiSAClients, kialiCache: cache, businessLayer: temporaryLayer}
	// Out of order because it relies on ProxyStatus
	temporaryLayer.ProxyLogging = ProxyLoggingService{conf: conf, userClients: userClients, proxyStatus: &temporaryLayer.ProxyStatus}
	temporaryLayer.RegistryStatus = RegistryStatusService{conf: conf, kialiCache: cache}
	temporaryLayer.Svc = SvcService{conf: conf, kialiCache: cache, businessLayer: temporaryLayer, prom: prom, userClients: userClients}
	temporaryLayer.TLS = TLSService{conf: conf, discovery: discovery, userClients: userClients, kialiCache: cache, businessLayer: temporaryLayer}
	temporaryLayer.Validations = NewValidationsService(conf, &temporaryLayer.IstioConfig, cache, &temporaryLayer.Mesh, &temporaryLayer.Namespace, &temporaryLayer.Svc, userClients, &temporaryLayer.Workload)
	temporaryLayer.Workload = *NewWorkloadService(cache, conf, grafana, kialiSAClients, temporaryLayer, prom, userClients)
	temporaryLayer.Tracing = NewTracingService(conf, traceClient, &temporaryLayer.Svc, &temporaryLayer.Workload, &temporaryLayer.App)
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
