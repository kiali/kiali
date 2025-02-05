package business

import (
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/jaeger"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// Layer is a container for fast access to inner services.
// A business layer is created per token/user. Any data that
// needs to be saved across layers is saved in the Kiali Cache.
type Layer struct {
	App              AppService
	Health           HealthService
	IstioConfig      IstioConfigService
	IstioStatus      IstioStatusService
	IstioCerts       IstioCertsService
	Jaeger           JaegerService
	Mesh             MeshService
	Namespace        NamespaceService
	OpenshiftOAuth   OpenshiftOAuthService
	ProxyLogging     ProxyLoggingService
	ProxyStatus      ProxyStatusService
	RegistryStatus   RegistryStatusService
	RegistryStatuses map[string]RegistryStatusService // Key is the cluster name
	Svc              SvcService
	TLS              TLSService
	TokenReview      TokenReviewService
	Validations      IstioValidationsService
	Workload         WorkloadService
}

// Global clientfactory and prometheus clients.
var (
	clientFactory    kubernetes.ClientFactory
	jaegerClient     jaeger.ClientInterface
	kialiCache       cache.KialiCache
	prometheusClient prometheus.ClientInterface
)

// sets the global kiali cache var.
func initKialiCache() error {
	conf := config.Get()

	if excludedWorkloads == nil {
		excludedWorkloads = make(map[string]bool)
		for _, w := range conf.KubernetesConfig.ExcludeWorkloads {
			excludedWorkloads[w] = true
		}
	}

	userClient, err := kubernetes.GetClientFactory()
	if err != nil {
		log.Errorf("Failed to create client factory. Err: %s", err)
		return err
	}
	clientFactory = userClient

	log.Infof("Initializing Kiali Cache")

	cache, err := cache.NewKialiCache(clientFactory, *conf)
	if err != nil {
		log.Errorf("Error initializing Kiali Cache. Details: %s", err)
		return err
	}

	// Seed namespaces when not in cluster wide mode.
	if !conf.AllNamespacesAccessible() {
		for _, namespace := range conf.Deployment.AccessibleNamespaces {
			cache.CheckNamespace(namespace)
		}
	}

	kialiCache = cache

	return nil
}

func IsNamespaceCached(namespace string) bool {
	return kialiCache.CheckNamespace(namespace)
}

// Start initializes the Kiali Cache and sets the
// globals necessary for the business layer.
func Start() error {
	return initKialiCache()
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

	// Create Jaeger client
	jaegerLoader := func() (jaeger.ClientInterface, error) {
		var err error
		if jaegerClient == nil {
			jaegerClient, err = jaeger.NewClient(authInfo.Token)
			if err != nil {
				jaegerClient = nil
			}
		}
		return jaegerClient, err
	}

	kialiSAClient := clientFactory.GetSAClients()
	return NewWithBackends(userClients, kialiSAClient, prometheusClient, jaegerLoader), nil
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
func NewWithBackends(userClients map[string]kubernetes.ClientInterface, kialiSAClients map[string]kubernetes.ClientInterface, prom prometheus.ClientInterface, jaegerClient JaegerLoader) *Layer {
	temporaryLayer := &Layer{}
	conf := config.Get()

	homeClusterName := conf.KubernetesConfig.ClusterName
	// TODO: Modify the k8s argument to other services to pass the whole k8s map if needed
	temporaryLayer.App = AppService{prom: prom, userClients: userClients, businessLayer: temporaryLayer}
	temporaryLayer.Health = HealthService{prom: prom, businessLayer: temporaryLayer, userClients: userClients}
	temporaryLayer.IstioConfig = IstioConfigService{config: *conf, userClients: userClients, kialiCache: kialiCache, businessLayer: temporaryLayer}
	temporaryLayer.IstioStatus = IstioStatusService{userClients: userClients, businessLayer: temporaryLayer}
	temporaryLayer.IstioCerts = IstioCertsService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.Jaeger = JaegerService{loader: jaegerClient, businessLayer: temporaryLayer}
	temporaryLayer.Namespace = NewNamespaceService(userClients, kialiSAClients, kialiCache, *conf)
	temporaryLayer.Mesh = NewMeshService(kialiSAClients, kialiCache, temporaryLayer.Namespace, *conf)
	temporaryLayer.OpenshiftOAuth = OpenshiftOAuthService{k8s: userClients[homeClusterName], kialiSAClient: kialiSAClients[homeClusterName]}
	temporaryLayer.ProxyStatus = ProxyStatusService{kialiSAClients: kialiSAClients, kialiCache: kialiCache, businessLayer: temporaryLayer}
	// Out of order because it relies on ProxyStatus
	temporaryLayer.ProxyLogging = ProxyLoggingService{userClients: userClients, proxyStatus: &temporaryLayer.ProxyStatus}
	temporaryLayer.RegistryStatus = RegistryStatusService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.TLS = TLSService{userClients: userClients, kialiCache: kialiCache, businessLayer: temporaryLayer}
	temporaryLayer.Svc = SvcService{config: *conf, kialiCache: kialiCache, businessLayer: temporaryLayer, prom: prom, userClients: userClients}
	temporaryLayer.TokenReview = NewTokenReview(userClients[homeClusterName])
	temporaryLayer.Validations = IstioValidationsService{userClients: userClients, businessLayer: temporaryLayer}
	temporaryLayer.Workload = *NewWorkloadService(userClients, kialiSAClients, prom, kialiCache, temporaryLayer, conf)

	registryStatuses := make(map[string]RegistryStatusService)
	for name, client := range userClients {
		registryStatuses[name] = RegistryStatusService{k8s: client, businessLayer: temporaryLayer}
	}
	temporaryLayer.RegistryStatuses = registryStatuses

	return temporaryLayer
}

func Stop() {
	kialiCache.Stop()
}
