package business

import (
	"github.com/kiali/kiali/models"
	apps_v1 "k8s.io/api/apps/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type IstioStatusService struct {
	k8s kubernetes.IstioClientInterface
}

type ComponentStatus struct {
	// The app label value of the Istio component
	//
	// example: istiod
	// required: true
	Name string `json:"name"`

	// The status of a Istio component
	//
	// example:  Not Found
	// required: true
	Status string `json:"status"`

	// When true, the component is part of istio core. Otherwise, it is an addon
	//
	// example:  true
	// required: true
	IsCore bool `json:"is_core"`
}

type IstioComponentStatus []ComponentStatus

const (
	Healthy   string = "Healthy"
	Unhealthy string = "Unhealthy"
	NotFound  string = "NotFound"
)

// List of workloads part of a Istio deployment and if whether it is mandatory or not
var components = map[string]bool{
	// Core components, mandatory
	"istio-egressgateway":  true,
	"istio-ingressgateway": true,
	"istiod":               true,
	// Addon components, not mandatory
	// Kiali not included.
	"grafana":    false,
	"jaeger":     false,
	"prometheus": false,
}

func (iss *IstioStatusService) GetStatus() (IstioComponentStatus, error) {
	isc := IstioComponentStatus{}
	cf := map[string]bool{}

	// Fetching workloads from control plane namespace
	ds, error := iss.k8s.GetDeployments(config.Get().IstioNamespace)
	if error != nil {
		return isc, error
	}

	// Map workloads there by app name
	for _, d := range ds {
		appName := d.Labels[config.Get().IstioLabels.AppLabelName]
		if appName == "" {
			continue
		}

		isCore, found := components[appName]
		if !found {
			continue
		}

		// Component found
		cf[appName] = true

		// Check status
		isc = append(isc, ComponentStatus{
			Name:   appName,
			Status: GetDeploymentStatus(d),
			IsCore: isCore,
		},
		)
	}

	// Add missing deployments
	for comp, isCore := range components {
		if _, found := cf[comp]; !found {
			isc = append(isc, ComponentStatus{
				Name:   comp,
				Status: NotFound,
				IsCore: isCore,
			})
		}
	}

	return isc, nil
}

func GetDeploymentStatus(d apps_v1.Deployment) string {
	status := Unhealthy
	wl := &models.Workload{}
	wl.ParseDeployment(&d)
	if wl.DesiredReplicas == wl.AvailableReplicas && wl.DesiredReplicas == wl.CurrentReplicas {
		status = Healthy
	}
	return status
}
