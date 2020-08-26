package kubernetes

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"

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

const RemoteSecretData = "/kiali-remote-secret/kiali"

var (
	emptyListOptions = meta_v1.ListOptions{}
	emptyGetOptions  = meta_v1.GetOptions{}
)

type PodLogs struct {
	Logs string `json:"logs,omitempty"`
}

type IstioClientInterface interface {
	CreateIstioObject(api, namespace, resourceType, json string) (IstioObject, error)
	DeleteIstioObject(api, namespace, resourceType, name string) error
	GetIstioObject(namespace, resourceType, name string) (IstioObject, error)
	GetIstioObjects(namespace, resourceType, labelSelector string) ([]IstioObject, error)
	UpdateIstioObject(api, namespace, resourceType, name, jsonPatch string) (IstioObject, error)
}

type K8SClientInterface interface {
	GetConfigMap(namespace, configName string) (*core_v1.ConfigMap, error)
	GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, error)
	GetDeployment(namespace string, deploymentName string) (*apps_v1.Deployment, error)
	GetDeployments(namespace string) ([]apps_v1.Deployment, error)
	GetDeploymentsByLabel(namespace string, labelSelector string) ([]apps_v1.Deployment, error)
	GetDeploymentConfig(namespace string, deploymentconfigName string) (*osapps_v1.DeploymentConfig, error)
	GetDeploymentConfigs(namespace string) ([]osapps_v1.DeploymentConfig, error)
	GetEndpoints(namespace string, serviceName string) (*core_v1.Endpoints, error)
	GetJobs(namespace string) ([]batch_v1.Job, error)
	GetNamespace(namespace string) (*core_v1.Namespace, error)
	GetNamespaces(labelSelector string) ([]core_v1.Namespace, error)
	GetPod(namespace, name string) (*core_v1.Pod, error)
	GetPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (*PodLogs, error)
	GetPods(namespace, labelSelector string) ([]core_v1.Pod, error)
	GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error)
	GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error)
	GetSelfSubjectAccessReview(namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error)
	GetService(namespace string, serviceName string) (*core_v1.Service, error)
	GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error)
	GetStatefulSet(namespace string, statefulsetName string) (*apps_v1.StatefulSet, error)
	GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error)
	UpdateNamespace(namespace string, jsonPatch string) (*core_v1.Namespace, error)
	UpdateWorkload(namespace string, workloadName string, workloadType string, jsonPatch string) error
}

type OSClientInterface interface {
	GetProject(project string) (*osproject_v1.Project, error)
	GetProjects(labelSelector string) ([]osproject_v1.Project, error)
	GetRoute(namespace string, name string) (*osroutes_v1.Route, error)
	UpdateProject(project string, jsonPatch string) (*osproject_v1.Project, error)
}

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	GetServerVersion() (*version.Info, error)
	GetToken() string
	IsMaistraApi() bool
	IsOpenShift() bool
	IsMixerDisabled() bool
	K8SClientInterface
	IstioClientInterface
	Iter8ClientInterface
	OSClientInterface
}

// K8SClient is the client struct for Kubernetes and Istio APIs
// It hides the way it queries each API
type K8SClient struct {
	ClientInterface
	token                    string
	k8s                      *kube.Clientset
	istioConfigApi           *rest.RESTClient
	istioNetworkingApi       *rest.RESTClient
	istioAuthenticationApi   *rest.RESTClient
	istioRbacApi             *rest.RESTClient
	istioSecurityApi         *rest.RESTClient
	maistraAuthenticationApi *rest.RESTClient
	maistraRbacApi           *rest.RESTClient
	iter8Api                 *rest.RESTClient
	// isOpenShift private variable will check if kiali is deployed under an OpenShift cluster or not
	// It is represented as a pointer to include the initialization phase.
	// See kubernetes_service.go#IsOpenShift() for more details.
	isOpenShift *bool

	// isMaistraApi private variable will check if specific Maistra APIs for authentication and rbac are present.
	// It is represented as a pointer to include the initialization phase.
	// See kubernetes_service.go#IsMaistraApi() for more details.
	isMaistraApi *bool

	// isIter8Api private variable will check if extension Iter8 API is present.
	// It is represented as a pointer to include the initialization phase.
	// See iter8.go#IsIter8Api() for more details
	isIter8Api *bool

	// networkingResources private variable will check which resources kiali has access to from networking.istio.io group
	// It is represented as a pointer to include the initialization phase.
	// See istio_details_service.go#hasNetworkingResource() for more details.
	networkingResources *map[string]bool

	// configResources private variable will check which resources kiali has access to from config.istio.io group
	// It is represented as a pointer to include the initialization phase.
	// See istio_details_service.go#hasConfigResource() for more details.
	configResources *map[string]bool

	// rbacResources private variable will check which resources kiali has access to from rbac.istio.io group
	// It is represented as a pointer to include the initialization phase.
	// See istio_details_service.go#hasRbacResource() for more details.
	rbacResources *map[string]bool

	// securityResources private variable will check which resources kiali has access to from security.istio.io group
	// It is represented as a pointer to include the initialization phase.
	// See istio_details_service.go#hasSecurityResource() for more details.
	securityResources *map[string]bool

	// authenticationResources private variable will check which resources kiali has access to from authentication.istio.io group
	// It is represented as a pointer to include the initialization phase.
	// See istio_details_service.go#hasAuthenticationResource() for more details.
	authenticationResources *map[string]bool

	// isMixedDisabled private variable will check if mixer is enabled in the current istio deployment.
	// It is represented with a pointer to a bool. True if mixer is disabled, false instead
	isMixerDisabled *bool
}

// GetK8sApi returns the clientset referencing all K8s rest clients
func (client *K8SClient) GetK8sApi() *kube.Clientset {
	return client.k8s
}

// GetIstioConfigApi returns the istio config rest client
func (client *K8SClient) GetIstioConfigApi() *rest.RESTClient {
	return client.istioConfigApi
}

// GetIstioNetworkingApi returns the istio config rest client
func (client *K8SClient) GetIstioNetworkingApi() *rest.RESTClient {
	return client.istioNetworkingApi
}

// GetIstioRbacApi returns the istio rbac rest client
func (client *K8SClient) GetIstioRbacApi() *rest.RESTClient {
	return client.istioRbacApi
}

// GetIstioSecurityApi returns the istio security rest client
func (client *K8SClient) GetIstioSecurityApi() *rest.RESTClient {
	return client.istioSecurityApi
}

// GetToken returns the BearerToken used from the config
func (client *K8SClient) GetToken() string {
	return client.token
}

// Point the k8s client to a remote cluster's API server
func UseRemoteCreds(remoteSecret *RemoteSecret) (*rest.Config, error) {
	caData := remoteSecret.Clusters[0].Cluster.CertificateAuthorityData
	rootCaDecoded, err := base64.StdEncoding.DecodeString(caData)
	if err != nil {
		return nil, err
	}
	// Basically implement rest.InClusterConfig() with the remote creds
	tlsClientConfig := rest.TLSClientConfig{
		CAData: []byte(rootCaDecoded),
	}

	serverParse := strings.Split(remoteSecret.Clusters[0].Cluster.Server, ":")
	if len(serverParse) != 3 {
		return nil, errors.New("Invalid remote API server URL")
	}
	host := strings.TrimPrefix(serverParse[1], "//")
	port := serverParse[2]

	// There's no need to add the BearerToken because it's ignored later on
	return &rest.Config{
		Host:            "https://" + net.JoinHostPort(host, port),
		TLSClientConfig: tlsClientConfig,
	}, nil
}

// ConfigClient return a client with the correct configuration
// Returns configuration if Kiali is in Cluster when InCluster is true
// Returns configuration if Kiali is not int Cluster when InCluster is false
// It returns an error on any problem
func ConfigClient() (*rest.Config, error) {
	if kialiConfig.Get().InCluster {
		var incluster *rest.Config
		var err error
		if remoteSecret, readErr := GetRemoteSecret(RemoteSecretData); readErr == nil {
			incluster, err = UseRemoteCreds(remoteSecret)
		} else {
			incluster, err = rest.InClusterConfig()
		}
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
func NewClientFromConfig(config *rest.Config) (*K8SClient, error) {
	client := K8SClient{
		token: config.BearerToken,
	}
	log.Debugf("Rest perf config QPS: %f Burst: %d", config.QPS, config.Burst)

	k8s, err := kube.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	client.k8s = k8s

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
			for _, at := range maistraAuthenticationTypes {
				scheme.AddKnownTypeWithName(MaistraAuthenticationGroupVersion.WithKind(at.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(MaistraAuthenticationGroupVersion.WithKind(at.collectionKind), &GenericIstioObjectList{})
			}
			// Register rbac types
			for _, rt := range rbacTypes {
				scheme.AddKnownTypeWithName(RbacGroupVersion.WithKind(rt.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(RbacGroupVersion.WithKind(rt.collectionKind), &GenericIstioObjectList{})

			}
			for _, rt := range maistraRbacTypes {
				scheme.AddKnownTypeWithName(MaistraRbacGroupVersion.WithKind(rt.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(MaistraRbacGroupVersion.WithKind(rt.collectionKind), &GenericIstioObjectList{})
			}
			for _, rt := range securityTypes {
				scheme.AddKnownTypeWithName(SecurityGroupVersion.WithKind(rt.objectKind), &GenericIstioObject{})
				scheme.AddKnownTypeWithName(SecurityGroupVersion.WithKind(rt.collectionKind), &GenericIstioObjectList{})
			}
			// Register Extension (iter8) types
			for _, rt := range iter8Types {
				// We will use a Iter8ExperimentObject which only contains metadata and spec with interfaces
				// model objects will be responsible to parse it
				scheme.AddKnownTypeWithName(Iter8GroupVersion.WithKind(rt.objectKind), &Iter8ExperimentObject{})
				scheme.AddKnownTypeWithName(Iter8GroupVersion.WithKind(rt.collectionKind), &Iter8ExperimentObjectList{})
			}

			meta_v1.AddToGroupVersion(scheme, ConfigGroupVersion)
			meta_v1.AddToGroupVersion(scheme, NetworkingGroupVersion)
			meta_v1.AddToGroupVersion(scheme, AuthenticationGroupVersion)
			meta_v1.AddToGroupVersion(scheme, RbacGroupVersion)
			meta_v1.AddToGroupVersion(scheme, MaistraAuthenticationGroupVersion)
			meta_v1.AddToGroupVersion(scheme, MaistraRbacGroupVersion)
			meta_v1.AddToGroupVersion(scheme, SecurityGroupVersion)
			meta_v1.AddToGroupVersion(scheme, Iter8GroupVersion)
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

	istioSecurityApi, err := newClientForAPI(config, SecurityGroupVersion, types)
	if err != nil {
		return nil, err
	}

	maistraAuthenticationAPI, err := newClientForAPI(config, MaistraAuthenticationGroupVersion, types)
	if err != nil {
		return nil, err
	}

	maistraRbacApi, err := newClientForAPI(config, MaistraRbacGroupVersion, types)
	if err != nil {
		return nil, err
	}

	iter8Api, err := newClientForAPI(config, Iter8GroupVersion, types)
	if err != nil {
		return nil, err
	}

	client.istioConfigApi = istioConfigAPI
	client.istioNetworkingApi = istioNetworkingAPI
	client.istioAuthenticationApi = istioAuthenticationAPI
	client.istioRbacApi = istioRbacApi
	client.istioSecurityApi = istioSecurityApi
	client.maistraAuthenticationApi = maistraAuthenticationAPI
	client.maistraRbacApi = maistraRbacApi
	client.iter8Api = iter8Api
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
