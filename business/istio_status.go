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

	// When true, the component is necessary for Istio to function. Otherwise, it is an addon
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

// List of workloads part of a Istio deployment and if whether it is mandatory or not.
// It follows the default profile
var components = map[string]map[string]bool{
	"monolith": {
		"istio-egressgateway":  false,
		"istio-ingressgateway": true,
		"istiod":               true,
		"grafana":              false,
		"istio-tracing":        false,
		"prometheus":           true,
	},
	"mixer": {
		"istio-citadel":          true,
		"istio-egressgateway":    false,
		"istio-galley":           true,
		"istio-ingressgateway":   true,
		"istio-pilot":            true,
		"istio-policy":           true,
		"istio-sidecar-injector": true,
		"istio-telemetry":        true,
		"grafana":                false,
		"istio-tracing":          false,
		"prometheus":             true,
	},
}

func (iss *IstioStatusService) GetStatus() (IstioComponentStatus, error) {
	if !config.Get().ExternalServices.Istio.IstioStatusEnabled {
		return IstioComponentStatus{}, nil
	}

	// Fetching workloads from control plane namespace
	ds, error := iss.k8s.GetDeployments(config.Get().IstioNamespace)
	if error != nil {
		return IstioComponentStatus{}, error
	}

	arch := iss.detectArchitecture(ds)
	if arch != "monolith" && arch != "mixer" {
		return IstioComponentStatus{}, nil
	}

	return iss.getStatusOf(arch, ds)
}

func (iss *IstioStatusService) detectArchitecture(ds []apps_v1.Deployment) string {
	monArch := false
	mixArch := false

	for _, d := range ds {
		appName := d.Name
		if appName == "" {
			continue
		}

		monArch = monArch || appName == "istiod"
		mixArch = mixArch || appName == "istio-pilot"
	}

	arch := "notfound"
	if monArch && !mixArch {
		arch = "monolith"
	} else if !monArch && mixArch {
		arch = "mixer"
	} else if monArch && mixArch {
		arch = "multiple"
	}

	return arch
}

func (iss *IstioStatusService) getStatusOf(arch string, ds []apps_v1.Deployment) (IstioComponentStatus, error) {
	isc := IstioComponentStatus{}
	cf := map[string]bool{}

	// Map workloads there by app name
	for _, d := range ds {
		appName := d.Name
		if appName == "" {
			continue
		}

		isCore, found := components[arch][appName]
		if !found {
			continue
		}

		// Component found
		cf[appName] = true

		if status := GetDeploymentStatus(d); status != Healthy {
			// Check status
			isc = append(isc, ComponentStatus{
				Name:   appName,
				Status: status,
				IsCore: isCore,
			},
			)
		}
	}

	// Add missing deployments
	for comp, isCore := range components[arch] {
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
