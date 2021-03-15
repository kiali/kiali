package business

import (
	"sync"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/jaeger"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// Layer is a container for fast access to inner services
type Layer struct {
	App            AppService
	Health         HealthService
	IstioConfig    IstioConfigService
	IstioStatus    IstioStatusService
	Iter8          Iter8Service
	Jaeger         JaegerService
	k8s            kubernetes.KubeClientInterface
	Mesh           MeshService
	Namespace      NamespaceService
	OpenshiftOAuth OpenshiftOAuthService
	ProxyStatus    ProxyStatus
	Svc            SvcService
	TLS            TLSService
	TokenReview    TokenReviewService
	Validations    IstioValidationsService
	Workload       WorkloadService
}

// Global clientfactory and prometheus clients.
var kubeClientFactory kubernetes.KubeClientFactory
var meshClientFactory kubernetes.MeshClientFactory
var prometheusClient prometheus.ClientInterface
var once sync.Once
var kialiKubeCache cache.KialiKubeCache
var kialiMeshCache cache.KialiMeshCache

func initKialiCache() {
	if config.Get().KubernetesConfig.CacheEnabled {
		if cache, err := cache.NewKialiKubeCache(); err != nil {
			log.Errorf("Error initializing Kiali Cache. Details: %s", err)
		} else {
			kialiKubeCache = cache
		}
		if cache, err := cache.NewKialiMeshCache(); err != nil {
			log.Errorf("Error initializing Kiali Cache. Details: %s", err)
		} else {
			kialiMeshCache = cache
		}
	}
	if excludedWorkloads == nil {
		excludedWorkloads = make(map[string]bool)
		for _, w := range config.Get().KubernetesConfig.ExcludeWorkloads {
			excludedWorkloads[w] = true
		}
	}
}

func IsNamespaceCached(namespace string) bool {
	ok := kialiKubeCache != nil && kialiKubeCache.CheckNamespace(namespace)
	return ok
}

func IsResourceCached(namespace string, resource string) bool {
	ok := IsNamespaceCached(namespace)
	if ok && resource != "" {
		ok = kialiMeshCache.CheckIstioResource(resource)
	}
	return ok
}

// Get the business.Layer
func Get(authInfo *api.AuthInfo) (*Layer, error) {
	// Kiali Cache will be initialized once at first use of Business layer
	once.Do(initKialiCache)

	// Use an existing client factory if it exists, otherwise create and use in the future
	if kubeClientFactory == nil {
		userClient, err := kubernetes.GetKubeClientFactory()
		if err != nil {
			return nil, err
		}
		kubeClientFactory = userClient
	}
	if meshClientFactory == nil {
		userClient, err := kubernetes.GetMeshClientFactory()
		if err != nil {
			return nil, err
		}
		meshClientFactory = userClient
	}
	// Creates a new k8s client based on the current users token
	k8s, err := kubeClientFactory.GetKubeClient(authInfo)
	if err != nil {
		return nil, err
	}

	// Use an existing Prometheus client if it exists, otherwise create and use in the future
	if prometheusClient == nil {
		prom, err := prometheus.NewClient()
		if err != nil {
			return nil, err
		}
		prometheusClient = prom
	}

	// Create Jaeger client
	jaegerLoader := func() (jaeger.ClientInterface, error) {
		return jaeger.NewClient(authInfo.Token)
	}

	meshK8s, err := meshClientFactory.GetMeshClient(authInfo)
	if err != nil {
		return nil, err
	}

	return NewWithBackends(k8s, meshK8s, prometheusClient, jaegerLoader), nil
}

// SetWithBackends allows for specifying the ClientFactory and Prometheus clients to be used.
// Mock friendly. Used only with tests.
func SetWithBackends(cf kubernetes.KubeClientFactory, cf2 kubernetes.MeshClientFactory, prom prometheus.ClientInterface) {
	kubeClientFactory = cf
	meshClientFactory = cf2
	prometheusClient = prom
}

// NewWithBackends creates the business layer using the passed k8s and prom clients
func NewWithBackends(kubeK8s kubernetes.KubeClientInterface, meshK8s kubernetes.MeshClientInterface,
	prom prometheus.ClientInterface, jaegerClient JaegerLoader) *Layer {
	temporaryLayer := &Layer{}
	temporaryLayer.App = AppService{prom: prom, k8s: kubeK8s, businessLayer: temporaryLayer}
	temporaryLayer.Health = HealthService{prom: prom, k8s: kubeK8s, businessLayer: temporaryLayer}
	temporaryLayer.IstioConfig = IstioConfigService{kubeK8s: kubeK8s, meshK8s: meshK8s, businessLayer: temporaryLayer}
	temporaryLayer.IstioStatus = IstioStatusService{k8s: kubeK8s}
	temporaryLayer.Iter8 = Iter8Service{k8s: kubeK8s, businessLayer: temporaryLayer}
	temporaryLayer.Jaeger = JaegerService{loader: jaegerClient, businessLayer: temporaryLayer}
	temporaryLayer.k8s = kubeK8s
	temporaryLayer.Mesh = NewMeshService(kubeK8s, nil)
	temporaryLayer.Namespace = NewNamespaceService(kubeK8s)
	temporaryLayer.OpenshiftOAuth = OpenshiftOAuthService{k8s: kubeK8s}
	temporaryLayer.ProxyStatus = ProxyStatus{k8s: kubeK8s, businessLayer: temporaryLayer}
	temporaryLayer.Svc = SvcService{prom: prom, kubeK8s: kubeK8s, meshK8s: meshK8s, businessLayer: temporaryLayer}
	temporaryLayer.TLS = TLSService{kubeK8s: kubeK8s, meshK8s: meshK8s, businessLayer: temporaryLayer}
	temporaryLayer.TokenReview = NewTokenReview(kubeK8s)
	temporaryLayer.Validations = IstioValidationsService{kubeK8s: kubeK8s, meshK8s: meshK8s, businessLayer: temporaryLayer}
	temporaryLayer.Workload = WorkloadService{k8s: kubeK8s, prom: prom, businessLayer: temporaryLayer}

	return temporaryLayer
}

func Stop() {
	if kialiKubeCache != nil {
		kialiKubeCache.Stop()
	}
	if kialiMeshCache != nil {
		kialiMeshCache.Stop()
	}
}
