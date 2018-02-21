package kubernetes

import (
	"fmt"

	"k8s.io/api/core/v1"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
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

// IstioClient is the client struct for Kubernetes and Istio APIs
// It hides the way it queries each API
type IstioClient struct {
	k8s   *kubernetes.Clientset
	istio *rest.RESTClient
}

// NewClient creates a new client to the Kubernetes and Istio APIs.
// It takes the assumption that Istio is deployed into the cluster.
// It hides the access to Kubernetes/Openshift credentials.
// It hides the low level use of the API of Kubernetes and Istio, it should be considered as an implementation detail.
// It returns an error on any problem.
func NewClient() (*IstioClient, error) {
	client := IstioClient{}
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}

	config.QPS = k8sQPS
	config.Burst = k8sBurst

	k8s, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	client.k8s = k8s

	// Istio is a CRD extension of Kubernetes API, so any custom type should be registered here.
	// KnownTypes registers the Istio objects we use, as soon as we get more info we will increase the number of types.
	types := runtime.NewScheme()
	schemeBuilder := runtime.NewSchemeBuilder(
		func(scheme *runtime.Scheme) error {
			for _, kind := range KnownTypes {
				scheme.AddKnownTypes(IstioGroupVersion, kind.object, kind.collection)
			}
			meta_v1.AddToGroupVersion(scheme, IstioGroupVersion)
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
			GroupVersion:         &IstioGroupVersion,
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

// GetNamespaces returns a list of all namespaces/projects of the cluster.
// It returns an error on any problem.
func (in *IstioClient) GetNamespaces() ([]string, error) {
	namespaces, err := in.k8s.CoreV1().Namespaces().List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(namespaces.Items))
	for i, namespace := range namespaces.Items {
		names[i] = namespace.Name
	}
	return names, nil
}

// GetServices returns a list of services for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetServices(namespace string) ([]string, error) {
	services, err := in.k8s.CoreV1().Services(namespace).List(emptyListOptions)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(services.Items))
	for i, service := range services.Items {
		names[i] = service.Name
	}
	return names, nil
}

// GetServiceDetails returns full details for a given service, consisting on service description, endpoints and pods.
// A service is defined by the namespace and the service name.
// It returns an error on any problem.
func (in *IstioClient) GetServiceDetails(namespace string, serviceName string) (*ServiceDetails, error) {
	service, err := in.k8s.CoreV1().Services(namespace).Get(serviceName, emptyGetOptions)
	if err != nil {
		return nil, err
	}
	endpoints, err := in.k8s.CoreV1().Endpoints(namespace).Get(serviceName, emptyGetOptions)
	if err != nil {
		return nil, err
	}
	pods := make([]*v1.Pod, 0)
	for _, subset := range endpoints.Subsets {
		for _, address := range subset.Addresses {
			targetRef := address.TargetRef
			if targetRef != nil && targetRef.Kind == "Pod" {
				pod, err := in.k8s.CoreV1().Pods(namespace).Get(targetRef.Name, emptyGetOptions)
				if err != nil {
					return nil, err
				}
				pods = append(pods, pod)
			}
		}
	}
	return &ServiceDetails{service, endpoints, pods}, nil
}

// GetIstioDetails returns Istio details for a given service, on this version it describes the RouterRules defined for a service.
// A service is defined by the namespace and the service name.
// It returns an error on any problem.
func (in *IstioClient) GetIstioDetails(namespace string, serviceName string) (*IstioDetails, error) {
	result, err := in.istio.Get().Namespace(namespace).Resource(RouteRules).Do().Get()
	if err != nil {
		return nil, err
	}
	rulesList, ok := result.(*RouteRuleList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a RouteRule list", namespace, serviceName)
	}
	// RouterRules have its own names non related to the service which are defined.
	// So, to fetch the rules per a specific service we need to filter by destination.
	// Probably in future iterations we might change this if it's not enough.
	routerRules := make([]*RouteRule, 0)
	for _, rule := range rulesList.Items {
		if destination, ok := rule.Spec["destination"]; ok {
			dest := destination.(map[string]interface{})
			if dest["name"] == serviceName {
				routerRules = append(routerRules, &rule)
			}
		}
	}
	return &IstioDetails{routerRules}, nil
}
