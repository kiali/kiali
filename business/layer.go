package business

import (
	"context"
	"sync"

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
	k8sClients       map[string]kubernetes.ClientInterface // Key is the cluster name
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
	once             sync.Once
	prometheusClient prometheus.ClientInterface
)

// sets the global kiali cache var.
func initKialiCache() {
	if excludedWorkloads == nil {
		excludedWorkloads = make(map[string]bool)
		for _, w := range config.Get().KubernetesConfig.ExcludeWorkloads {
			excludedWorkloads[w] = true
		}
	}

	userClient, err := kubernetes.GetClientFactory()
	if err != nil {
		log.Errorf("Failed to create client factory. Err: %s", err)
		return
	}
	clientFactory = userClient

	// TODO: Remove conditonal once cache is fully mandatory.
	if config.Get().KubernetesConfig.CacheEnabled {
		log.Infof("Initializing Kiali Cache")

		// Initial list of namespaces to seed the cache with.
		// This is only necessary if the cache is namespace-scoped.
		// For a cluster-scoped cache, all namespaces are accessible.
		// TODO: This is leaking cluster-scoped vs. namespace-scoped in a way.
		var namespaceSeedList []string
		if !config.Get().AllNamespacesAccessible() {
			SAClients := clientFactory.GetSAClients()
			// Special case when using the SA as the user, to fetch all the namespaces initially
			initNamespaceService := NewNamespaceService(SAClients, SAClients)
			nss, err := initNamespaceService.GetNamespaces(context.Background())
			if err != nil {
				log.Errorf("Error fetching initial namespaces for populating the Kiali Cache. Details: %s", err)
				return
			}

			for _, ns := range nss {
				namespaceSeedList = append(namespaceSeedList, ns.Name)
			}
		}

		cache, err := cache.NewKialiCache(clientFactory, *config.Get(), namespaceSeedList...)
		if err != nil {
			log.Errorf("Error initializing Kiali Cache. Details: %s", err)
			return
		}

		kialiCache = cache
	}
}

func IsNamespaceCached(namespace string) bool {
	ok := kialiCache != nil && kialiCache.CheckNamespace(namespace)
	return ok
}

func IsResourceCached(namespace string, resource string) bool {
	ok := IsNamespaceCached(namespace)
	if ok && resource != "" {
		ok = kialiCache.CheckIstioResource(resource)
	}
	return ok
}

func Start() {
	// Kiali Cache will be initialized once at start up.
	once.Do(initKialiCache)
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
	homeClusterName := config.Get().KubernetesConfig.ClusterName
	// TODO: Modify the k8s argument to other services to pass the whole k8s map if needed
	temporaryLayer.App = AppService{prom: prom, userClients: userClients, businessLayer: temporaryLayer}
	temporaryLayer.Health = HealthService{prom: prom, businessLayer: temporaryLayer, userClients: userClients}
	temporaryLayer.IstioConfig = IstioConfigService{config: *config.Get(), userClients: userClients, kialiCache: kialiCache, businessLayer: temporaryLayer}
	temporaryLayer.IstioStatus = IstioStatusService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.IstioCerts = IstioCertsService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.Jaeger = JaegerService{loader: jaegerClient, businessLayer: temporaryLayer}
	temporaryLayer.k8sClients = userClients
	temporaryLayer.Mesh = NewMeshService(userClients[homeClusterName], temporaryLayer, nil)
	temporaryLayer.Namespace = NewNamespaceService(userClients, kialiSAClients)
	temporaryLayer.OpenshiftOAuth = OpenshiftOAuthService{k8s: userClients[homeClusterName]}
	temporaryLayer.ProxyStatus = ProxyStatusService{kialiSAClients: kialiSAClients, kialiCache: kialiCache, businessLayer: temporaryLayer}
	// Out of order because it relies on ProxyStatus
	temporaryLayer.ProxyLogging = ProxyLoggingService{userClients: userClients, proxyStatus: &temporaryLayer.ProxyStatus}
	temporaryLayer.RegistryStatus = RegistryStatusService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.TLS = TLSService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.Svc = SvcService{config: *config.Get(), kialiCache: kialiCache, businessLayer: temporaryLayer, prom: prom, userClients: userClients}
	temporaryLayer.TokenReview = NewTokenReview(userClients[homeClusterName])
	temporaryLayer.Validations = IstioValidationsService{k8s: userClients[homeClusterName], businessLayer: temporaryLayer}
	temporaryLayer.Workload = *NewWorkloadService(userClients, prom, kialiCache, temporaryLayer, config.Get())

	registryStatuses := make(map[string]RegistryStatusService)
	for name, client := range userClients {
		registryStatuses[name] = RegistryStatusService{k8s: client, businessLayer: temporaryLayer}
	}
	temporaryLayer.RegistryStatuses = registryStatuses

	return temporaryLayer
}

func Stop() {
	if kialiCache != nil {
		kialiCache.Stop()
	}
}
