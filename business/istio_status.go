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
	// example: istio-ingressgateway
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

type IstioComponentStatus struct {
	// Message regarding the Istio architecture: monolith, mixer-based, multiple or none
	//
	// example: Istio status disabled: multiple pilots found
	Message string `json:"message,omitempty"`

	// List of each istio deployment status
	//
	// required: true
	List []ComponentStatus `json:"list"`
}

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
	if unex, isc := unexpectedArch(arch); unex {
		return isc, nil
	}

	return iss.getStatusOf(arch, ds)
}

func unexpectedArch(arch string) (bool, IstioComponentStatus) {
	unex, isc := false, IstioComponentStatus{}

	if arch == "multiple" {
		unex, isc = true, IstioComponentStatus{
			Message: "Istio Status disabled: Multiple Pilot found",
		}
	} else if arch == "notfound" {
		unex, isc = true, IstioComponentStatus{
			Message: "Istio Status disabled: Pilot not found",
		}
	}

	return unex, isc
}

func (iss *IstioStatusService) detectArchitecture(ds []apps_v1.Deployment) string {
	monArch := false
	mixArch := false

	for _, d := range ds {
		if d.Name == "" {
			continue
		}

		monArch = monArch || d.Name == "istiod"
		mixArch = mixArch || d.Name == "istio-pilot"
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
	isc := make([]ComponentStatus, 0, len(ds))
	cf := map[string]bool{}

	// Map workloads there by app name
	for _, d := range ds {
		if d.Name == "" {
			continue
		}

		isCore, found := components[arch][d.Name]
		if !found {
			continue
		}

		// Component found
		cf[d.Name] = true

		if status := GetDeploymentStatus(d); status != Healthy {
			// Check status
			isc = append(isc, ComponentStatus{
				Name:   d.Name,
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

	return IstioComponentStatus{
		Message: "",
		List:    isc,
	}, nil
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
