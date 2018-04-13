package kubernetes

import (
	"fmt"
	"net"
	"os"
	"strings"

	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	kialiConfig "github.com/kiali/kiali/config"
)

const (
	// These constants are tweaks to the k8s client I think once are set up they won't change so no need to put them on the config
	// Default QPS and Burst are quite low and those are not designed for a backend that should perform several
	// queries to build an inventory of entities from a k8s backend.
	// Other k8s clients have increased these values to a similar values.
	k8sQPS   = 100
	k8sBurst = 200
)

var (
	emptyListOptions = meta_v1.ListOptions{}
	emptyGetOptions  = meta_v1.GetOptions{}
)

// IstioClientInterface for mocks (only mocked function are necessary here)
type IstioClientInterface interface {
	GetServices(namespaceName string) (*ServiceList, error)
	GetServiceDetails(namespace string, serviceName string) (*ServiceDetails, error)
	GetIstioDetails(namespace string, serviceName string) (*IstioDetails, error)
}

// IstioClient is the client struct for Kubernetes and Istio APIs
// It hides the way it queries each API
type IstioClient struct {
	IstioClientInterface
	k8s   *kube.Clientset
	istio *rest.RESTClient
}

// ConfigClient return a client with the correct configuration
// Returns configuration if Kiali is in Cluster when InCluster is true
// Returns configuration if Kiali is not int Cluster when InCluster is false
// It returns an error on any problem
func ConfigClient() (*rest.Config, error) {
	if kialiConfig.Get().InCluster {
		return rest.InClusterConfig()
	}
	host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT")
	if len(host) == 0 || len(port) == 0 {
		return nil, fmt.Errorf("unable to load in-cluster configuration, KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT must be defined")
	}

	return &rest.Config{
		// TODO: switch to using cluster DNS.
		Host: "http://" + net.JoinHostPort(host, port),
	}, nil
}

// NewClient creates a new client to the Kubernetes and Istio APIs.
// It takes the assumption that Istio is deployed into the cluster.
// It hides the access to Kubernetes/Openshift credentials.
// It hides the low level use of the API of Kubernetes and Istio, it should be considered as an implementation detail.
// It returns an error on any problem.
func NewClient() (*IstioClient, error) {
	client := IstioClient{}
	config, err := ConfigClient()

	if err != nil {
		return nil, err
	}

	config.QPS = k8sQPS
	config.Burst = k8sBurst

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
			for _, kind := range istioKnownTypes {
				scheme.AddKnownTypes(istioGroupVersion, kind.object, kind.collection)
			}
			meta_v1.AddToGroupVersion(scheme, istioGroupVersion)
			return nil
		})

	err = schemeBuilder.AddToScheme(types)
	if err != nil {
		return nil, err
	}

	// Istio needs another type as it queries a different K8S API.
	istioConfig := rest.Config{
		Host:    config.Host,
		APIPath: "/apis",
		ContentConfig: rest.ContentConfig{
			GroupVersion:         &istioGroupVersion,
			NegotiatedSerializer: serializer.DirectCodecFactory{CodecFactory: serializer.NewCodecFactory(types)},
			ContentType:          runtime.ContentTypeJSON,
		},
		BearerToken:     config.BearerToken,
		TLSClientConfig: config.TLSClientConfig,
		QPS:             config.QPS,
		Burst:           config.Burst,
	}

	istio, err := rest.RESTClientFor(&istioConfig)

	client.istio = istio
	if err != nil {
		return nil, err
	}
	return &client, nil
}

// FilterDeploymentsForService returns a subpart of deployments list where labels match the ones of the given service
func FilterDeploymentsForService(s *v1.Service, deployments *v1beta1.DeploymentList) *[]v1beta1.Deployment {
	if s == nil || deployments == nil {
		return nil
	}
	depls := make([]v1beta1.Deployment, len(deployments.Items))
	i := 0
	for _, depl := range deployments.Items {
		if labelsMatch(depl.ObjectMeta.Labels, s.Spec.Selector) {
			depls[i] = depl
			i++
		}
	}
	shrinked := depls[:i]
	return &shrinked
}

func labelsMatch(serviceLabels, filterLabels map[string]string) bool {
	labelMatch := true

	for key, value := range filterLabels {
		if serviceLabels[key] != value {
			labelMatch = false
			break
		}
	}

	return labelMatch
}

func selectorToString(selector map[string]string) string {
	querySelector := make([]string, 0, len(selector))
	for label, name := range selector {
		querySelector = append(querySelector, label+"="+name)
	}
	return strings.Join(querySelector, ",")
}
