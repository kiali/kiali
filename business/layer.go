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
	App            AppService
	Health         HealthService
	IstioConfig    IstioConfigService
	IstioStatus    IstioStatusService
	IstioCerts     IstioCertsService
	Jaeger         JaegerService
	k8s            kubernetes.ClientInterface
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
var clientFactory kubernetes.ClientFactory

var (
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

	// TODO: Remove conditonal once cache is fully mandatory.
	if config.Get().KubernetesConfig.CacheEnabled {
		log.Infof("Initializing Kiali Cache")

		// Initial list of namespaces to seed the cache with.
		// This is only necessary if the cache is namespace-scoped.
		// For a cluster-scoped cache, all namespaces are accessible.
		// TODO: This is leaking cluster-scoped vs. namespace-scoped in a way.
		var namespaceSeedList []string
		if !config.Get().AllNamespacesAccessible() {
			cfg, err := kubernetes.ConfigClient()
			if err != nil {
				log.Errorf("Failed to initialize Kiali Cache. Unable to create Kube rest config. Err: %s", err)
				return
			}

			kubeClient, err := kubernetes.NewClientFromConfig(cfg)
			if err != nil {
				log.Errorf("Failed to initialize Kiali Cache. Unable to create Kube client. Err: %s", err)
				return
			}

			initNamespaceService := NewNamespaceService(kubeClient)
			nss, err := initNamespaceService.GetNamespaces(context.Background())
			if err != nil {
				log.Errorf("Error fetching initial namespaces for populating the Kiali Cache. Details: %s", err)
				return
			}

			for _, ns := range nss {
				namespaceSeedList = append(namespaceSeedList, ns.Name)
			}
		}

		cache, err := cache.NewKialiCache(namespaceSeedList...)
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
	// Use an existing client factory if it exists, otherwise create and use in the future
	if clientFactory == nil {
		userClient, err := kubernetes.GetClientFactory()
		if err != nil {
			return nil, err
		}
		clientFactory = userClient
	}

	// Creates a new k8s client based on the current users token
	k8s, err := clientFactory.GetClient(authInfo)
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

	return NewWithBackends(k8s, prometheusClient, jaegerLoader), nil
}

// SetWithBackends allows for specifying the ClientFactory and Prometheus clients to be used.
// Mock friendly. Used only with tests.
func SetWithBackends(cf kubernetes.ClientFactory, prom prometheus.ClientInterface) {
	clientFactory = cf
	prometheusClient = prom
}

// NewWithBackends creates the business layer using the passed k8s and prom clients
func NewWithBackends(k8s kubernetes.ClientInterface, prom prometheus.ClientInterface, jaegerClient JaegerLoader) *Layer {
	temporaryLayer := &Layer{}
	temporaryLayer.App = AppService{prom: prom, k8s: k8s, businessLayer: temporaryLayer}
	temporaryLayer.Health = HealthService{prom: prom, k8s: k8s, businessLayer: temporaryLayer}
	temporaryLayer.IstioConfig = IstioConfigService{k8s: k8s, businessLayer: temporaryLayer}
	temporaryLayer.IstioStatus = IstioStatusService{k8s: k8s, businessLayer: temporaryLayer}
	temporaryLayer.IstioCerts = IstioCertsService{k8s: k8s, businessLayer: temporaryLayer}
	temporaryLayer.Jaeger = JaegerService{loader: jaegerClient, businessLayer: temporaryLayer}
	temporaryLayer.k8s = k8s
	temporaryLayer.Mesh = NewMeshService(k8s, temporaryLayer, nil)
	temporaryLayer.Namespace = NewNamespaceService(k8s)
	temporaryLayer.OpenshiftOAuth = OpenshiftOAuthService{k8s: k8s}
	temporaryLayer.ProxyStatus = ProxyStatusService{k8s: k8s, businessLayer: temporaryLayer}
	// Out of order because it relies on ProxyStatus
	temporaryLayer.ProxyLogging = ProxyLoggingService{k8s: k8s, proxyStatus: &temporaryLayer.ProxyStatus}
	temporaryLayer.RegistryStatus = RegistryStatusService{k8s: k8s, businessLayer: temporaryLayer}
	temporaryLayer.Svc = SvcService{prom: prom, k8s: k8s, businessLayer: temporaryLayer}
	temporaryLayer.TLS = TLSService{k8s: k8s, businessLayer: temporaryLayer}
	temporaryLayer.TokenReview = NewTokenReview(k8s)
	temporaryLayer.Validations = IstioValidationsService{k8s: k8s, businessLayer: temporaryLayer}
	// TODO: Remove conditional once cache is fully mandatory.
	if config.Get().KubernetesConfig.CacheEnabled {
		// The caching client effectively uses two different SA account tokens.
		// The kiali SA token is used for all cache methods. The cache methods are
		// read-only. Methods that are not cached and methods that modify objects
		// use the user's token through the normal client.
		// TODO: Always pass caching client once caching is mandatory.
		cachingClient := cache.NewCachingClient(kialiCache, k8s)
		temporaryLayer.Workload = *NewWorkloadService(cachingClient, prom, kialiCache, temporaryLayer, config.Get())
	} else {
		temporaryLayer.Workload = *NewWorkloadService(k8s, prom, kialiCache, temporaryLayer, config.Get())
	}

	return temporaryLayer
}

func Stop() {
	if kialiCache != nil {
		kialiCache.Stop()
	}
}
