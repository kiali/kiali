package business

import (
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
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
	IstioCerts     IstioCertsService
	Tracing        TracingService
	Mesh           MeshService
	Namespace      NamespaceService
	OpenshiftOAuth OpenshiftOAuthService
	ProxyLogging   ProxyLoggingService
	ProxyStatus    ProxyStatusService
	RegistryStatus RegistryStatusService
	Svc            SvcService
	TLS            TLSService
	TokenReview    TokenReviewService
	Validations    IstioValidationsService
	Workload       WorkloadService
}

// Global clientfactory and prometheus clients.
var (
	clientFactory       kubernetes.ClientFactory
	kialiCache          cache.KialiCache
	poller              ControlPlaneMonitor
	prometheusClient    prometheus.ClientInterface
	tracingClientLoader func() tracing.ClientInterface
)

// Start sets the globals necessary for the business layer.
// TODO: Refactor out global vars.
func Start(cf kubernetes.ClientFactory, controlPlaneMonitor ControlPlaneMonitor, cache cache.KialiCache, prom prometheus.ClientInterface, traceClientLoader func() tracing.ClientInterface) {
	clientFactory = cf
	kialiCache = cache
	poller = controlPlaneMonitor
	prometheusClient = prom
	tracingClientLoader = traceClientLoader
}

// Get the business.Layer
func Get(authInfo *api.AuthInfo) (*Layer, error) {
	// Creates new k8s clients based on the current users token
	userClients, err := clientFactory.GetClients(authInfo)
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
func NewWithBackends(userClients map[string]kubernetes.ClientInterface, kialiSAClients map[string]kubernetes.ClientInterface, prom prometheus.ClientInterface, traceClient tracing.ClientInterface) *Layer {
	return newLayer(userClients, kialiSAClients, prom, traceClient, kialiCache, poller, config.Get())
}

func newLayer(
	userClients map[string]kubernetes.ClientInterface,
	kialiSAClients map[string]kubernetes.ClientInterface,
	prom prometheus.ClientInterface,
	traceClient tracing.ClientInterface,
	cache cache.KialiCache,
	cpm ControlPlaneMonitor,
	conf *config.Config,
) *Layer {
	temporaryLayer := &Layer{}

	homeClusterName := conf.KubernetesConfig.ClusterName

	// TODO: Modify the k8s argument to other services to pass the whole k8s map if needed
	temporaryLayer.App = AppService{prom: prom, userClients: userClients, businessLayer: temporaryLayer}
	temporaryLayer.Health = HealthService{prom: prom, businessLayer: temporaryLayer, userClients: userClients}
	temporaryLayer.IstioConfig = IstioConfigService{config: *conf, userClients: userClients, kialiCache: cache, businessLayer: temporaryLayer, controlPlaneMonitor: poller}
	temporaryLayer.IstioStatus = NewIstioStatusService(userClients, temporaryLayer, poller)
	temporaryLayer.IstioCerts = IstioCertsService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.Namespace = NewNamespaceService(userClients, kialiSAClients, cache, *conf)
	temporaryLayer.Mesh = NewMeshService(kialiSAClients, cache, temporaryLayer.Namespace, *conf)
	temporaryLayer.OpenshiftOAuth = OpenshiftOAuthService{k8s: userClients[homeClusterName], kialiSAClient: kialiSAClients[homeClusterName]}
	temporaryLayer.ProxyStatus = ProxyStatusService{kialiSAClients: kialiSAClients, kialiCache: cache, businessLayer: temporaryLayer}
	// Out of order because it relies on ProxyStatus
	temporaryLayer.ProxyLogging = ProxyLoggingService{userClients: userClients, proxyStatus: &temporaryLayer.ProxyStatus}
	temporaryLayer.RegistryStatus = RegistryStatusService{kialiCache: cache}
	temporaryLayer.TLS = TLSService{userClients: userClients, kialiCache: cache, businessLayer: temporaryLayer}
	temporaryLayer.Svc = SvcService{config: *conf, kialiCache: cache, businessLayer: temporaryLayer, prom: prom, userClients: userClients}
	temporaryLayer.TokenReview = NewTokenReview(userClients[homeClusterName])
	temporaryLayer.Workload = *NewWorkloadService(userClients, prom, cache, temporaryLayer, conf)
	temporaryLayer.Validations = NewValidationsService(&temporaryLayer.IstioConfig, cache, &temporaryLayer.Mesh, &temporaryLayer.Namespace, &temporaryLayer.Svc, userClients, &temporaryLayer.Workload)

	temporaryLayer.Tracing = NewTracingService(conf, traceClient, &temporaryLayer.Svc, &temporaryLayer.Workload)
	return temporaryLayer
}

// NewLayer creates the business layer using the passed k8sClients and prom clients.
// Note that the client passed here should *not* be the Kiali ServiceAccount client.
// It should be the user client based on the logged in user's token.
func NewLayer(conf *config.Config, cache cache.KialiCache, cf kubernetes.ClientFactory, prom prometheus.ClientInterface, traceClient tracing.ClientInterface, cpm ControlPlaneMonitor, authInfo *api.AuthInfo) (*Layer, error) {
	userClients, err := cf.GetClients(authInfo)
	if err != nil {
		return nil, err
	}

	kialiSAClients := cf.GetSAClients()
	return newLayer(userClients, kialiSAClients, prom, traceClient, cache, cpm, conf), nil
}

// NewLayer creates the business layer using the passed k8sClients and prom clients.
// Note that the client passed here should *not* be the Kiali ServiceAccount client.
// It should be the user client based on the logged in user's token.
// TODO: Remove this when the services in the business layer are no longer coupled
// to the business layer and can be used separately.
func NewLayerWithSAClients(conf *config.Config, cache cache.KialiCache, prom prometheus.ClientInterface, traceClient tracing.ClientInterface, cpm ControlPlaneMonitor, saClients map[string]kubernetes.ClientInterface) (*Layer, error) {
	return newLayer(saClients, saClients, prom, traceClient, cache, cpm, conf), nil
}
