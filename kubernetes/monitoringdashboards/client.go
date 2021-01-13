package monitoringdashboards

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/kubernetes/monitoringdashboards/v1alpha1"
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
	// Used in REST queries after bump to client-go v0.20.x
	ctx context.Context
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
		ctx:    context.Background(),
	}, err
}

func newClientForAPI(fromCfg *rest.Config, groupVersion schema.GroupVersion, scheme *runtime.Scheme) (*rest.RESTClient, error) {
	cfg := rest.Config{
		Host:    fromCfg.Host,
		APIPath: "/apis",
		ContentConfig: rest.ContentConfig{
			GroupVersion:         &groupVersion,
			NegotiatedSerializer: serializer.WithoutConversionCodecFactory{CodecFactory: serializer.NewCodecFactory(scheme)},
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
	err := in.client.Get().Namespace(namespace).Resource("monitoringdashboards").SubResource(name).Do(in.ctx).Into(&result)
	if err != nil {
		return nil, err
	}
	return &result, err
}

// GetDashboards returns all MonitoringDashboards from the given namespace
func (in *Client) GetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error) {
	result := v1alpha1.MonitoringDashboardsList{}
	err := in.client.Get().Namespace(namespace).Resource("monitoringdashboards").Do(in.ctx).Into(&result)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}
