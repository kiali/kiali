package kubernetes

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/kubernetes/kiali_monitoring/v1alpha1"
)

// KialiMonitoringInterface for mocks (only mocked function are necessary here)
type KialiMonitoringInterface interface {
	GetDashboard(namespace string, name string) (*v1alpha1.MonitoringDashboard, error)
	GetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error)
}

// KialiMonitoringClient is the client struct for Kiali Monitoring API over Kubernetes
// API to get MonitoringDashboards
type KialiMonitoringClient struct {
	KialiMonitoringInterface
	client *rest.RESTClient
}

// NewKialiMonitoringClient creates a new client able to fetch Kiali Monitoring API.
func NewKialiMonitoringClient() (*KialiMonitoringClient, error) {
	config, err := ConfigClient()
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

	client, err := newClientForAPI(config, v1alpha1.KialiMonitoringGroupVersion, types)
	if err != nil {
		return nil, err
	}
	return &KialiMonitoringClient{
		client: client,
	}, err
}

// GetDashboard returns a MonitoringDashboard for the given name
func (in *KialiMonitoringClient) GetDashboard(namespace, name string) (*v1alpha1.MonitoringDashboard, error) {
	result := v1alpha1.MonitoringDashboard{}
	err := in.client.Get().Namespace(namespace).Resource("monitoringdashboards").SubResource(name).Do().Into(&result)
	if err != nil {
		return nil, err
	}
	return &result, err
}

// GetDashboards returns all MonitoringDashboards from the given namespace
func (in *KialiMonitoringClient) GetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error) {
	result := v1alpha1.MonitoringDashboardsList{}
	err := in.client.Get().Namespace(namespace).Resource("monitoringdashboards").Do().Into(&result)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}
