package business

import (
	"sync"

	apps_v1 "k8s.io/api/apps/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type IstioStatusService struct {
	k8s kubernetes.ClientInterface
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

type IstioComponentStatus []ComponentStatus

const (
	Healthy   string = "Healthy"
	Unhealthy string = "Unhealthy"
	NotFound  string = "NotFound"
)

func (iss *IstioStatusService) GetStatus() (IstioComponentStatus, error) {
	if !config.Get().ExternalServices.Istio.ComponentStatuses.Enabled {
		return IstioComponentStatus{}, nil
	}

	// Fetching workloads from component namespaces
	ds, error := iss.getComponentNamespacesWorkloads()
	if error != nil {
		return IstioComponentStatus{}, error
	}

	return iss.getStatusOf(ds)
}

func (iss *IstioStatusService) getComponentNamespacesWorkloads() ([]apps_v1.Deployment, error) {
	var wg sync.WaitGroup

	nss := map[string]bool{}
	deps := make([]apps_v1.Deployment, 0)

	comNs := getComponentNamespaces()

	depsChan := make(chan []apps_v1.Deployment, len(comNs))
	errChan := make(chan error, len(comNs))

	for _, n := range comNs {
		if !nss[n] {
			wg.Add(1)
			nss[n] = true

			go func(n string, depsChan chan []apps_v1.Deployment, errChan chan error) {
				defer wg.Done()
				var ds []apps_v1.Deployment
				var err error
				if IsNamespaceCached(n) {
					ds, err = kialiCache.GetDeployments(n)
				} else {
					// Adding a warning to enable cache for fetching Istio Status.
					// It should use cache, as it's an intensive operation but we won't fail otherwise
					// If user doesn't have access to istio namespace AND it doesn't have enabled cache it won't get the Istio status
					log.Warningf("Kiali has not [%s] namespace cached. It is required to fetch Istio Status correctly", n)
					ds, err = iss.k8s.GetDeployments(n)
				}
				depsChan <- ds
				errChan <- err
			}(n, depsChan, errChan)
		}
	}

	wg.Wait()

	close(depsChan)
	close(errChan)
	for err := range errChan {
		if err != nil {
			return nil, err
		}
	}

	for dep := range depsChan {
		if dep != nil {
			deps = append(deps, dep...)
		}
	}

	return deps, nil
}

func getComponentNamespaces() []string {
	nss := make([]string, 0)

	// By default, add the istio control plane namespace
	nss = append(nss, config.Get().IstioNamespace)

	// Adding addons namespaces
	externalServices := config.Get().ExternalServices
	if externalServices.Prometheus.ComponentStatus.Namespace != "" {
		nss = append(nss, externalServices.Prometheus.ComponentStatus.Namespace)
	}

	if externalServices.Grafana.ComponentStatus.Namespace != "" {
		nss = append(nss, externalServices.Grafana.ComponentStatus.Namespace)
	}

	if externalServices.Tracing.ComponentStatus.Namespace != "" {
		nss = append(nss, externalServices.Tracing.ComponentStatus.Namespace)
	}

	// Adding Istio Components namespaces
	for _, cmp := range externalServices.Istio.ComponentStatuses.Components {
		if cmp.Namespace != "" {
			nss = append(nss, cmp.Namespace)
		}
	}

	return nss
}

func istioCoreComponents() map[string]bool {
	components := map[string]bool{}
	cs := config.Get().ExternalServices.Istio.ComponentStatuses
	for _, c := range cs.Components {
		components[c.AppLabel] = c.IsCore
	}
	return components
}

func addAddOnComponents(components map[string]bool) map[string]bool {
	confExtSvcs := config.Get().ExternalServices

	components[confExtSvcs.Prometheus.ComponentStatus.AppLabel] = confExtSvcs.Prometheus.ComponentStatus.IsCore

	if confExtSvcs.Grafana.Enabled {
		components[confExtSvcs.Grafana.ComponentStatus.AppLabel] = confExtSvcs.Grafana.ComponentStatus.IsCore
	}

	if confExtSvcs.Tracing.Enabled {
		components[confExtSvcs.Tracing.ComponentStatus.AppLabel] = confExtSvcs.Tracing.ComponentStatus.IsCore
	}

	return components
}

func (iss *IstioStatusService) getStatusOf(ds []apps_v1.Deployment) (IstioComponentStatus, error) {
	statusComponents := istioCoreComponents()
	statusComponents = addAddOnComponents(statusComponents)
	isc := IstioComponentStatus{}
	cf := map[string]bool{}

	// Map workloads there by app name
	for _, d := range ds {
		appLabel := labels.Set(d.Spec.Template.Labels).Get(config.Get().IstioLabels.AppLabelName)
		if appLabel == "" {
			continue
		}

		isCore, found := statusComponents[appLabel]
		if !found {
			continue
		}

		// Component found
		cf[appLabel] = true

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
	for comp, isCore := range statusComponents {
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
