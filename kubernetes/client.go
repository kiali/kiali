package kubernetes

import (
	"errors"
	"fmt"
	"net"
	"os"
	"time"

	osapps_v1 "github.com/openshift/api/apps/v1"
	osproject_v1 "github.com/openshift/api/project/v1"
	osroutes_v1 "github.com/openshift/api/route/v1"
	apps_v1 "k8s.io/api/apps/v1"
	auth_v1 "k8s.io/api/authorization/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/version"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var (
	emptyListOptions = meta_v1.ListOptions{}
	emptyGetOptions  = meta_v1.GetOptions{}
)

type PodLogs struct {
	Logs string `json:"logs,omitempty"`
}

// IstioClientInterface for mocks (only mocked function are necessary here)
type IstioClientInterface interface {
	CreateIstioObject(api, namespace, resourceType, json string) (IstioObject, error)
	DeleteIstioObject(api, namespace, resourceType, name string) error
	GetAdapter(namespace, adapterType, adapterName string) (IstioObject, error)
	GetAdapters(namespace, labelSelector string) ([]IstioObject, error)
	GetAuthorizationDetails(namespace string) (*RBACDetails, error)
	GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, error)
	GetDeployment(namespace string, deploymentName string) (*apps_v1.Deployment, error)
	GetDeployments(namespace string) ([]apps_v1.Deployment, error)
	GetDeploymentsByLabel(namespace string, labelSelector string) ([]apps_v1.Deployment, error)
	GetDeploymentConfig(namespace string, deploymentconfigName string) (*osapps_v1.DeploymentConfig, error)
	GetDeploymentConfigs(namespace string) ([]osapps_v1.DeploymentConfig, error)
	GetDestinationRule(namespace string, destinationrule string) (IstioObject, error)
	GetDestinationRules(namespace string, serviceName string) ([]IstioObject, error)
	GetEndpoints(namespace string, serviceName string) (*core_v1.Endpoints, error)
	GetGateway(namespace string, gateway string) (IstioObject, error)
	GetGateways(namespace string) ([]IstioObject, error)
	GetIstioDetails(namespace string, serviceName string) (*IstioDetails, error)
	GetIstioRule(namespace string, istiorule string) (IstioObject, error)
	GetIstioRules(namespace string, labelSelector string) ([]IstioObject, error)
	GetJobs(namespace string) ([]batch_v1.Job, error)
	GetNamespace(namespace string) (*core_v1.Namespace, error)
	GetNamespaces(labelSelector string) ([]core_v1.Namespace, error)
	GetPod(namespace, name string) (*core_v1.Pod, error)
	GetPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (*PodLogs, error)
	GetPods(namespace, labelSelector string) ([]core_v1.Pod, error)
	GetProject(project string) (*osproject_v1.Project, error)
	GetProjects(labelSelector string) ([]osproject_v1.Project, error)
	GetQuotaSpec(namespace string, quotaSpecName string) (IstioObject, error)
	GetQuotaSpecs(namespace string) ([]IstioObject, error)
	GetQuotaSpecBinding(namespace string, quotaSpecBindingName string) (IstioObject, error)
	GetQuotaSpecBindings(namespace string) ([]IstioObject, error)
	GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error)
	GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error)
	GetRoute(namespace string, name string) (*osroutes_v1.Route, error)
	GetSidecar(namespace string, sidecar string) (IstioObject, error)
	GetSidecars(namespace string) ([]IstioObject, error)
	GetSelfSubjectAccessReview(namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error)
	GetService(namespace string, serviceName string) (*core_v1.Service, error)
	GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error)
	GetServiceEntries(namespace string) ([]IstioObject, error)
	GetServiceEntry(namespace string, serviceEntryName string) (IstioObject, error)
	GetStatefulSet(namespace string, statefulsetName string) (*apps_v1.StatefulSet, error)
	GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error)
	GetTemplate(namespace, templateType, templateName string) (IstioObject, error)
	GetTemplates(namespace, labelSelector string) ([]IstioObject, error)
	GetPolicy(namespace string, policyName string) (IstioObject, error)
	GetPolicies(namespace string) ([]IstioObject, error)
	GetMeshPolicy(namespace string, policyName string) (IstioObject, error)
	GetMeshPolicies(namespace string) ([]IstioObject, error)
	GetClusterRbacConfig(namespace string, name string) (IstioObject, error)
	GetClusterRbacConfigs(namespace string) ([]IstioObject, error)
	GetRbacConfig(namespace string, name string) (IstioObject, error)
	GetRbacConfigs(namespace string) ([]IstioObject, error)
	GetServiceRole(namespace string, name string) (IstioObject, error)
	GetServiceRoles(namespace string) ([]IstioObject, error)
	GetServiceRoleBinding(namespace string, name string) (IstioObject, error)
	GetServiceRoleBindings(namespace string) ([]IstioObject, error)
	GetServerVersion() (*version.Info, error)
	GetVirtualService(namespace string, virtualservice string) (IstioObject, error)
	GetVirtualServices(namespace string, serviceName string) ([]IstioObject, error)
	IsOpenShift() bool
	Stop()
	UpdateIstioObject(api, namespace, resourceType, name, jsonPatch string) (IstioObject, error)
}

// IstioClient is the client struct for Kubernetes and Istio APIs
// It hides the way it queries each API
type IstioClient struct {
	IstioClientInterface
	k8s                    *kube.Clientset
	istioConfigApi         *rest.RESTClient
	istioNetworkingApi     *rest.RESTClient
	istioAuthenticationApi *rest.RESTClient
	istioRbacApi           *rest.RESTClient
	// isOpenShift private variable will check if kiali is deployed under an OpenShift cluster or not
	// It is represented as a pointer to include the initialization phase.
	// See kubernetes_service.go#IsOpenShift() for more details.
	isOpenShift *bool
	// rbacResources private variable will check which resources kiali has access to from rbac.istio.io group
	// It is represented as a pointer to include the initialization phase.
	// See istio_details_service.go#HasRbacResource() for more details.
	rbacResources *map[string]bool
	// Cache controller is a global cache for all k8s objects fetched by kiali in multiple namespaces.
	// It doesn't support reduced permissions scenarios yet, don't forget to disabled on those use cases.
	k8sCache  cacheController
	stopCache chan struct{}
}

// GetK8sApi returns the clientset referencing all K8s rest clients
func (client *IstioClient) GetK8sApi() *kube.Clientset {
	return client.k8s
}

// GetIstioConfigApi returns the istio config rest client
func (client *IstioClient) GetIstioConfigApi() *rest.RESTClient {
	return client.istioConfigApi
}

// GetIstioNetworkingApi returns the istio config rest client
func (client *IstioClient) GetIstioNetworkingApi() *rest.RESTClient {
	return client.istioNetworkingApi
}

// GetIstioRbacApi returns the istio rbac rest client
func (client *IstioClient) GetIstioRbacApi() *rest.RESTClient {
	return client.istioRbacApi
}

// ConfigClient return a client with the correct configuration
// Returns configuration if Kiali is in Cluster when InCluster is true
// Returns configuration if Kiali is not int Cluster when InCluster is false
// It returns an error on any problem
func ConfigClient() (*rest.Config, error) {
	if kialiConfig.Get().InCluster {
		incluster, err := rest.InClusterConfig()
		if err != nil {
			return nil, err
		}
		incluster.QPS = kialiConfig.Get().KubernetesConfig.QPS
		incluster.Burst = kialiConfig.Get().KubernetesConfig.Burst
		return incluster, nil
	}
	host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT")
	if len(host) == 0 || len(port) == 0 {
		return nil, fmt.Errorf("unable to load in-cluster configuration, KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT must be defined")
	}
	return &rest.Config{
		// TODO: switch to using cluster DNS.
		Host:  "http://" + net.JoinHostPort(host, port),
		QPS:   kialiConfig.Get().KubernetesConfig.QPS,
		Burst: kialiConfig.Get().KubernetesConfig.Burst,
	}, nil
}

// NewClientFromConfig creates a new client to the Kubernetes and Istio APIs.
// It takes the assumption that Istio is deployed into the cluster.
// It hides the access to Kubernetes/Openshift credentials.
// It hides the low level use of the API of Kubernetes and Istio, it should be considered as an implementation detail.
// It returns an error on any problem.
func NewClientFromConfig(config *rest.Config) (*IstioClient, error) {
	client := IstioClient{}
	log.Debugf("Rest perf config QPS: %f Burst: %d", config.QPS, config.Burst)

	k8s, err := kube.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	client.k8s = k8s

	// Init client cache
	// Note that cache will work only in full permissions scenarios (similar permissions as mixer/istio-telemetry component)
	kialiK8sCfg := kialiConfig.Get().KubernetesConfig
	if client.k8sCache == nil && kialiK8sCfg.CacheEnabled {
		log.Infof("Kiali K8S Cache enabled")
		client.stopCache = make(chan struct{})
		client.k8sCache = newCacheController(client.k8s, time.Duration(kialiConfig.Get().KubernetesConfig.CacheDuration))
		client.k8sCache.Start()
		if !client.k8sCache.WaitForSync() {
			return nil, errors.New("Cache cannot connect with the k8s API on host: " + config.Host)
		}
	}

	// Istio is a CRD extension of Kubernetes API, so any custom type should be registered here.
	// KnownTypes registers the Istio objects we use, as soon as we get more info we will increase the number of types.
	types := runtime.NewScheme()
	schemeBuilder := runtime.NewSchemeBuilder(
		func(scheme *runtime.Scheme) error {
			// Register networking types
			for _, nt := range networkingTypes {
				scheme.AddKnownTypeWithName(NetworkingGroupVersion.WithKind(nt.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(NetworkingGroupVersion.WithKind(nt.collectionKind), &GenericIstioObjectList{})
			}
			// Register config types
			for _, cf := range configTypes {
				scheme.AddKnownTypeWithName(ConfigGroupVersion.WithKind(cf.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(ConfigGroupVersion.WithKind(cf.collectionKind), &GenericIstioObjectList{})
			}
			// Register adapter types
			for _, ad := range adapterTypes {
				scheme.AddKnownTypeWithName(ConfigGroupVersion.WithKind(ad.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(ConfigGroupVersion.WithKind(ad.collectionKind), &GenericIstioObjectList{})
			}
			// Register template types
			for _, tp := range templateTypes {
				scheme.AddKnownTypeWithName(ConfigGroupVersion.WithKind(tp.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(ConfigGroupVersion.WithKind(tp.collectionKind), &GenericIstioObjectList{})
			}
			// Register authentication types
			for _, at := range authenticationTypes {
				scheme.AddKnownTypeWithName(AuthenticationGroupVersion.WithKind(at.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(AuthenticationGroupVersion.WithKind(at.collectionKind), &GenericIstioObjectList{})
			}
			// Register rbac types
			for _, rt := range rbacTypes {
				scheme.AddKnownTypeWithName(RbacGroupVersion.WithKind(rt.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(RbacGroupVersion.WithKind(rt.collectionKind), &GenericIstioObjectList{})

			}
			meta_v1.AddToGroupVersion(scheme, ConfigGroupVersion)
			meta_v1.AddToGroupVersion(scheme, NetworkingGroupVersion)
			meta_v1.AddToGroupVersion(scheme, AuthenticationGroupVersion)
			meta_v1.AddToGroupVersion(scheme, RbacGroupVersion)
			return nil
		})

	err = schemeBuilder.AddToScheme(types)
	if err != nil {
		return nil, err
	}

	// Istio needs another type as it queries a different K8S API.
	istioConfigAPI, err := newClientForAPI(config, ConfigGroupVersion, types)
	if err != nil {
		return nil, err
	}

	istioNetworkingAPI, err := newClientForAPI(config, NetworkingGroupVersion, types)
	if err != nil {
		return nil, err
	}

	istioAuthenticationAPI, err := newClientForAPI(config, AuthenticationGroupVersion, types)
	if err != nil {
		return nil, err
	}

	istioRbacApi, err := newClientForAPI(config, RbacGroupVersion, types)
	if err != nil {
		return nil, err
	}

	client.istioConfigApi = istioConfigAPI
	client.istioNetworkingApi = istioNetworkingAPI
	client.istioAuthenticationApi = istioAuthenticationAPI
	client.istioRbacApi = istioRbacApi
	return &client, nil
}

func newClientForAPI(fromCfg *rest.Config, groupVersion schema.GroupVersion, scheme *runtime.Scheme) (*rest.RESTClient, error) {
	cfg := rest.Config{
		Host:    fromCfg.Host,
		APIPath: "/apis",
		ContentConfig: rest.ContentConfig{
			GroupVersion:         &groupVersion,
			NegotiatedSerializer: serializer.DirectCodecFactory{CodecFactory: serializer.NewCodecFactory(scheme)},
			ContentType:          runtime.ContentTypeJSON,
		},
		BearerToken:     fromCfg.BearerToken,
		TLSClientConfig: fromCfg.TLSClientConfig,
		QPS:             fromCfg.QPS,
		Burst:           fromCfg.Burst,
	}
	return rest.RESTClientFor(&cfg)
}

func (in *IstioClient) Stop() {
	if in.k8sCache != nil {
		in.k8sCache.Stop()
	}
}
