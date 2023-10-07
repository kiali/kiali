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
	clientFactory    kubernetes.ClientFactory
	tracingClient    tracing.ClientInterface
	kialiCache       cache.KialiCache
	prometheusClient prometheus.ClientInterface
	poller           ControlPlaneMonitor
)

// Start sets the globals necessary for the business layer.
// TODO: Refactor out global vars.
func Start(cf kubernetes.ClientFactory, controlPlaneMonitor ControlPlaneMonitor, cache cache.KialiCache) {
	clientFactory = cf
	kialiCache = cache
	poller = controlPlaneMonitor
}

// Get the business.Layer
func Get(authInfo *api.AuthInfo) (*Layer, error) {
	// Creates new k8s clients based on the current users token
	userClients, err := clientFactory.GetClients(authInfo)
	if err != nil {
		return nil, err
	}

	// Use an existing Prometheus client if it exists, otherwise create and use in the future
	if prometheusClient == nil {
		prom, err := prometheus.NewClient()
		if err != nil {
			prometheusClient = nil
			return nil, err
		}
		prometheusClient = prom
	}

	// Create Tracing client
	tracingLoader := func() (tracing.ClientInterface, error) {
		var err error
		if tracingClient == nil {
			tracingClient, err = tracing.NewClient(authInfo.Token)
			if err != nil {
				tracingClient = nil
			}
		}
		return tracingClient, err
	}

	kialiSAClient := clientFactory.GetSAClients()
	return NewWithBackends(userClients, kialiSAClient, prometheusClient, tracingLoader), nil
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
func NewWithBackends(userClients map[string]kubernetes.ClientInterface, kialiSAClients map[string]kubernetes.ClientInterface, prom prometheus.ClientInterface, tracingClient TracingLoader) *Layer {
	temporaryLayer := &Layer{}
	conf := config.Get()

	homeClusterName := conf.KubernetesConfig.ClusterName
	// TODO: Modify the k8s argument to other services to pass the whole k8s map if needed
	temporaryLayer.App = AppService{prom: prom, userClients: userClients, businessLayer: temporaryLayer}
	temporaryLayer.Health = HealthService{prom: prom, businessLayer: temporaryLayer, userClients: userClients}
	temporaryLayer.IstioConfig = IstioConfigService{config: *conf, userClients: userClients, kialiCache: kialiCache, businessLayer: temporaryLayer, controlPlaneMonitor: poller}
	temporaryLayer.IstioStatus = NewIstioStatusService(userClients, temporaryLayer, poller)
	temporaryLayer.IstioCerts = IstioCertsService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.Tracing = TracingService{loader: tracingClient, businessLayer: temporaryLayer}
	temporaryLayer.Namespace = NewNamespaceService(userClients, kialiSAClients, kialiCache, *conf)
	temporaryLayer.Mesh = NewMeshService(kialiSAClients, kialiCache, temporaryLayer.Namespace, *conf)
	temporaryLayer.OpenshiftOAuth = OpenshiftOAuthService{k8s: userClients[homeClusterName], kialiSAClient: kialiSAClients[homeClusterName]}
	temporaryLayer.ProxyStatus = ProxyStatusService{kialiSAClients: kialiSAClients, kialiCache: kialiCache, businessLayer: temporaryLayer}
	// Out of order because it relies on ProxyStatus
	temporaryLayer.ProxyLogging = ProxyLoggingService{userClients: userClients, proxyStatus: &temporaryLayer.ProxyStatus}
	temporaryLayer.RegistryStatus = RegistryStatusService{kialiCache: kialiCache}
	temporaryLayer.TLS = TLSService{userClients: userClients, kialiCache: kialiCache, businessLayer: temporaryLayer}
	temporaryLayer.Svc = SvcService{config: *conf, kialiCache: kialiCache, businessLayer: temporaryLayer, prom: prom, userClients: userClients}
	temporaryLayer.TokenReview = NewTokenReview(userClients[homeClusterName])
	temporaryLayer.Validations = IstioValidationsService{userClients: userClients, businessLayer: temporaryLayer}
	temporaryLayer.Workload = *NewWorkloadService(userClients, prom, kialiCache, temporaryLayer, conf)

	return temporaryLayer
}
