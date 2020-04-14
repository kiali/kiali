package business

import (
	v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type IstioStatusService struct {
	k8s kubernetes.IstioClientInterface
}

type Status string
type ComponentName string
type IsCoreComponent bool
type ComponentStatus struct {
	// The status of a Istio component
	//
	// example:  Not Found
	// required: true
	Status Status `json:"status"`

	// When true, the component is part of istio core. Otherwise, it is an addon
	//
	// example:  true
	// required: true
	IsCore IsCoreComponent `json:"is_core"`
}

type IstioComponentStatus map[ComponentName]ComponentStatus

const (
	NotFound   Status = "Not Found"
	NotRunning Status = "Not Running"
	Running    Status = "Running"
)

var PhaseStatusMap = map[v1.PodPhase]Status{
	v1.PodFailed:    NotRunning,
	v1.PodPending:   NotRunning,
	v1.PodSucceeded: NotRunning,
	v1.PodUnknown:   NotRunning,
	v1.PodRunning:   Running,
}

// List of workloads part of a Istio deployment and if whether it is mandatory or not
var components = map[ComponentName]IsCoreComponent{
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

	// Fetching workloads from control plane namespace
	pods, error := iss.k8s.GetPods(config.Get().IstioNamespace, "")
	if error != nil {
		return isc, error
	}

	// Map workloads there by app name
	for _, pod := range pods {
		appName := ComponentName(pod.Labels[config.Get().IstioLabels.AppLabelName])
		if appName == "" {
			continue
		}

		isCore, found := components[appName]
		if !found {
			continue
		}

		if s, ok := GetPodStatus(pod); ok {
			if cs, found := isc[appName]; found {
				s = healthiest(s, cs.Status)
			}
			isc[appName] = ComponentStatus{Status: s, IsCore: isCore}
		}
	}

	// Add missing pods
	for comp, isCore := range components {
		if _, found := isc[comp]; !found {
			isc[comp] = ComponentStatus{
				Status: NotFound,
				IsCore: isCore,
			}
		}
	}

	return isc, nil
}

func GetPodStatus(pod v1.Pod) (Status, bool) {
	status, ok := Running, true

	if areContainersReady(pod) {
		status, ok = PhaseStatusMap[pod.Status.Phase]
	} else {
		status, ok = NotRunning, true
	}

	return status, ok
}

func areContainersReady(pod v1.Pod) bool {
	cr := true
	for _, cs := range pod.Status.ContainerStatuses {
		cr = cr && cs.Ready
	}
	return cr
}

func healthiest(a, b Status) Status {
	if a == Running && b != Running {
		return a
	} else if a == NotRunning && b != Running {
		return a
	} else {
		return b
	}
}
