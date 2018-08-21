package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
)

// Layer is a container for fast access to inner services
type Layer struct {
	Svc         SvcService
	Health      HealthService
	Validations IstioValidationsService
	IstioConfig IstioConfigService
	Workload    WorkloadService
	App         AppService
}

// Global business.Layer; currently only used for tests to inject mocks,
//	whereas production code recreates services in a stateless way
var layer *Layer

// Get the business.Layer, create it if necessary
func Get() (*Layer, error) {
	if layer != nil {
		return layer, nil
	}
	k8s, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}
	prom, err := prometheus.NewClient()
	if err != nil {
		return nil, err
	}
	// We don't update the global layer here to keep it stateless
	temporaryLayer := &Layer{}
	temporaryLayer.Health = HealthService{prom: prom, k8s: k8s}
	temporaryLayer.Svc = SvcService{prom: prom, k8s: k8s, health: &temporaryLayer.Health}
	temporaryLayer.Validations = IstioValidationsService{k8s: k8s}
	temporaryLayer.IstioConfig = IstioConfigService{k8s: k8s}
	temporaryLayer.Workload = WorkloadService{k8s: k8s}
	temporaryLayer.App = AppService{k8s: k8s}
	return temporaryLayer, nil
}

// SetWithBackends creates all services with injected clients to external APIs
func SetWithBackends(k8s kubernetes.IstioClientInterface, prom prometheus.ClientInterface) *Layer {
	layer = &Layer{}
	layer.Health = HealthService{prom: prom, k8s: k8s}
	layer.Svc = SvcService{prom: prom, k8s: k8s, health: &layer.Health}
	layer.Validations = IstioValidationsService{k8s: k8s}
	layer.IstioConfig = IstioConfigService{k8s: k8s}
	layer.Workload = WorkloadService{k8s: k8s}
	layer.App = AppService{k8s: k8s}
	return layer
}
