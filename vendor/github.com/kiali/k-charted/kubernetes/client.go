package kubernetes

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/rest"

	"github.com/kiali/k-charted/kubernetes/v1alpha1"
)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	GetDashboard(namespace string, name string) (*v1alpha1.MonitoringDashboard, error)
	GetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error)
}

// Client is the client struct for Kiali Monitoring API over Kubernetes
// API to get MonitoringDashboards
type Client struct {
	ClientInterface
	client *rest.RESTClient
}

// NewClient creates a new client able to fetch Kiali Monitoring API.
func NewClient() (*Client, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}

	types := runtime.NewScheme()
	schemeBuilder := runtime.NewSchemeBuilder(
		func(scheme *runtime.Scheme) error {
			return nil
		})

	err = schemeBuilder.AddToScheme(types)
	if err != nil {
		return nil, err
	}

	client, err := newClientForAPI(config, v1alpha1.GroupVersion, types)
	if err != nil {
		return nil, err
	}
	return &Client{
		client: client,
	}, err
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

// GetDashboard returns a MonitoringDashboard for the given name
func (in *Client) GetDashboard(namespace, name string) (*v1alpha1.MonitoringDashboard, error) {
	result := v1alpha1.MonitoringDashboard{}
	err := in.client.Get().Namespace(namespace).Resource("monitoringdashboards").SubResource(name).Do().Into(&result)
	if err != nil {
		return nil, err
	}
	return &result, err
}

// GetDashboards returns all MonitoringDashboards from the given namespace
func (in *Client) GetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error) {
	result := v1alpha1.MonitoringDashboardsList{}
	err := in.client.Get().Namespace(namespace).Resource("monitoringdashboards").Do().Into(&result)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}
