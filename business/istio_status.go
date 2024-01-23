package business

import (
	"context"
	"fmt"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/httputil"
)

func NewIstioStatusService(userClients map[string]kubernetes.ClientInterface, businessLayer *Layer, cpm ControlPlaneMonitor) IstioStatusService {
	return IstioStatusService{
		userClients:         userClients,
		businessLayer:       businessLayer,
		controlPlaneMonitor: cpm,
	}
}

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type IstioStatusService struct {
	userClients         map[string]kubernetes.ClientInterface
	businessLayer       *Layer
	controlPlaneMonitor ControlPlaneMonitor
}

func (iss *IstioStatusService) GetStatus(ctx context.Context, cluster string) (kubernetes.IstioComponentStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetStatus",
		observability.Attribute("package", "business"),
	)
	defer end()

	if !config.Get().ExternalServices.Istio.ComponentStatuses.Enabled || !config.Get().ExternalServices.Istio.IstioAPIEnabled {
		return kubernetes.IstioComponentStatus{}, nil
	}

	ics, err := iss.getIstioComponentStatus(ctx, cluster)
	if err != nil {
		return nil, err
	}

	return ics.Merge(iss.getAddonComponentStatus()), nil
}

func (iss *IstioStatusService) getIstioComponentStatus(ctx context.Context, cluster string) (kubernetes.IstioComponentStatus, error) {
	// Fetching workloads from component namespaces
	workloads, err := iss.getComponentNamespacesWorkloads(ctx, cluster)
	if err != nil {
		return kubernetes.IstioComponentStatus{}, err
	}

	deploymentStatus, err := iss.getStatusOf(workloads)
	if err != nil {
		return kubernetes.IstioComponentStatus{}, err
	}

	k8s, ok := iss.userClients[cluster]
	if !ok {
		return kubernetes.IstioComponentStatus{}, fmt.Errorf("Cluster %s doesn't exist ", cluster)
	}

	istiodStatus, err := iss.controlPlaneMonitor.CanConnectToIstiod(k8s)
	if err != nil {
		return kubernetes.IstioComponentStatus{}, err
	}

	return deploymentStatus.Merge(istiodStatus), nil
}

func (iss *IstioStatusService) getComponentNamespacesWorkloads(ctx context.Context, cluster string) ([]*models.Workload, error) {
	var wg sync.WaitGroup

	nss := map[string]bool{}
	wls := make([]*models.Workload, 0)

	comNs := getComponentNamespaces()

	wlChan := make(chan []*models.Workload, len(comNs))
	errChan := make(chan error, len(comNs))

	for _, n := range comNs {
		if !nss[n] {
			wg.Add(1)
			nss[n] = true

			go func(ctx context.Context, n string, wliChan chan []*models.Workload, errChan chan error) {
				defer wg.Done()
				var wls models.Workloads
				var err error
				wls, err = iss.businessLayer.Workload.fetchWorkloadsFromCluster(ctx, cluster, n, "")
				wliChan <- wls
				errChan <- err
			}(ctx, n, wlChan, errChan)
		}
	}

	wg.Wait()

	close(wlChan)
	close(errChan)
	for err := range errChan {
		if err != nil {
			return nil, err
		}
	}

	for wl := range wlChan {
		if wl != nil {
			wls = append(wls, wl...)
		}
	}

	return wls, nil
}

func getComponentNamespaces() []string {
	nss := make([]string, 0)

	// By default, add the istio control plane namespace
	nss = append(nss, config.Get().IstioNamespace)

	// Adding Istio Components namespaces
	externalServices := config.Get().ExternalServices
	for _, cmp := range externalServices.Istio.ComponentStatuses.Components {
		if cmp.Namespace != "" {
			nss = append(nss, cmp.Namespace)
		}
	}

	return nss
}

func istioCoreComponents() map[string]config.ComponentStatus {
	components := map[string]config.ComponentStatus{}
	cs := config.Get().ExternalServices.Istio.ComponentStatuses
	for _, c := range cs.Components {
		components[c.AppLabel] = c
	}
	return components
}

func (iss *IstioStatusService) getStatusOf(workloads []*models.Workload) (kubernetes.IstioComponentStatus, error) {
	statusComponents := istioCoreComponents()
	isc := kubernetes.IstioComponentStatus{}
	cf := map[string]bool{}
	mcf := map[string]int{}

	// Map workloads there by app name
	for _, workload := range workloads {
		appLabel := labels.Set(workload.Labels).Get("app")
		if appLabel == "" {
			continue
		}

		stat, found := statusComponents[appLabel]
		if !found {
			continue
		}

		if stat.IsMultiCluster {
			mcf[appLabel]++
		} else {
			// Component found
			cf[appLabel] = true
			// @TODO when components exists on remote clusters only but config not marked multicluster
		}

		if status := GetWorkloadStatus(*workload); status != kubernetes.ComponentHealthy {
			// Check status
			isc = append(isc, kubernetes.ComponentStatus{
				Name:   workload.Name,
				Status: status,
				IsCore: stat.IsCore,
			},
			)
		}
	}

	// Add missing deployments
	componentNotFound := 0
	for comp, stat := range statusComponents {
		if _, found := cf[comp]; !found {
			if number, mfound := mcf[comp]; !mfound || number < len(iss.userClients) { // multicluster components should exist on all clusters
				componentNotFound += 1
				isc = append(isc, kubernetes.ComponentStatus{
					Name:   comp,
					Status: kubernetes.ComponentNotFound,
					IsCore: stat.IsCore,
				})
			}
		}
	}

	// When all the deployments are missing,
	// Warn users that their kiali config might be wrong
	if componentNotFound == len(statusComponents) {
		return isc, fmt.Errorf(
			"Kiali is unable to find any Istio deployment in namespace %s. Are you sure the Istio namespace is configured correctly in Kiali?",
			config.Get().IstioNamespace)
	}

	return isc, nil
}

func GetWorkloadStatus(wl models.Workload) string {
	status := kubernetes.ComponentUnhealthy

	if wl.DesiredReplicas == 0 {
		status = kubernetes.ComponentNotReady
	} else if wl.DesiredReplicas == wl.AvailableReplicas && wl.DesiredReplicas == wl.CurrentReplicas {
		status = kubernetes.ComponentHealthy
	}
	return status
}

func (iss *IstioStatusService) getAddonComponentStatus() kubernetes.IstioComponentStatus {
	var wg sync.WaitGroup
	wg.Add(4)

	staChan := make(chan kubernetes.IstioComponentStatus, 4)
	extServices := config.Get().ExternalServices

	// https://github.com/kiali/kiali/issues/6966 - use the well-known Prom healthy endpoint
	if extServices.Prometheus.HealthCheckUrl == "" {
		extServices.Prometheus.HealthCheckUrl = extServices.Prometheus.URL + "/-/healthy"
	}

	ics := kubernetes.IstioComponentStatus{}

	go getAddonStatus("prometheus", true, extServices.Prometheus.IsCore, &extServices.Prometheus.Auth, extServices.Prometheus.URL, extServices.Prometheus.HealthCheckUrl, staChan, &wg)
	go getAddonStatus("grafana", extServices.Grafana.Enabled, extServices.Grafana.IsCore, &extServices.Grafana.Auth, extServices.Grafana.InClusterURL, extServices.Grafana.HealthCheckUrl, staChan, &wg)
	go iss.getTracingStatus("tracing", extServices.Tracing.Enabled, extServices.Tracing.IsCore, staChan, &wg)

	// Custom dashboards may use the main Prometheus config
	customProm := extServices.CustomDashboards.Prometheus
	if customProm.URL == "" {
		customProm = extServices.Prometheus
	}
	go getAddonStatus("custom dashboards", extServices.CustomDashboards.Enabled, extServices.CustomDashboards.IsCore, &customProm.Auth, customProm.URL, customProm.HealthCheckUrl, staChan, &wg)

	wg.Wait()

	close(staChan)
	for stat := range staChan {
		ics.Merge(stat)
	}

	return ics
}

func getAddonStatus(name string, enabled bool, isCore bool, auth *config.Auth, url string, healthCheckUrl string, staChan chan<- kubernetes.IstioComponentStatus, wg *sync.WaitGroup) {
	defer wg.Done()

	// When the addOn is disabled, don't perform any check
	if !enabled {
		return
	}

	// Take the alternative health check url if present
	if healthCheckUrl != "" {
		url = healthCheckUrl
	}

	if auth.UseKialiToken {
		token, _, err := kubernetes.GetKialiTokenForHomeCluster()
		if err != nil {
			log.Errorf("Could not read the Kiali Service Account token: %v", err)
		}
		auth.Token = token
	}

	// Call the addOn service endpoint to find out whether is reachable or not
	_, statusCode, _, err := httputil.HttpGet(url, auth, 10*time.Second, nil, nil)
	if err != nil || statusCode > 399 {
		log.Tracef("addon health check failed: name=[%v], url=[%v], code=[%v]", name, url, statusCode)
		staChan <- kubernetes.IstioComponentStatus{
			kubernetes.ComponentStatus{
				Name:   name,
				Status: kubernetes.ComponentUnreachable,
				IsCore: isCore,
			},
		}
	}
}

func (iss *IstioStatusService) getTracingStatus(name string, enabled bool, isCore bool, staChan chan<- kubernetes.IstioComponentStatus, wg *sync.WaitGroup) {
	defer wg.Done()

	if !enabled {
		return
	}

	if accessible, err := iss.businessLayer.Tracing.GetStatus(); !accessible {
		log.Errorf("Error fetching availability of the tracing service: %v", err)
		staChan <- kubernetes.IstioComponentStatus{
			kubernetes.ComponentStatus{
				Name:   name,
				Status: kubernetes.ComponentUnreachable,
				IsCore: isCore,
			},
		}
	}
}
