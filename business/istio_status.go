package business

import (
	"context"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/httputil"
	"github.com/kiali/kiali/util/sliceutil"
)

func NewIstioStatusService(
	cache cache.KialiCache,
	conf *config.Config,
	discovery istio.MeshDiscovery,
	homeClusterSAClient kubernetes.ClientInterface,
	tracing *TracingService,
	userClients map[string]kubernetes.UserClientInterface,
	workloads *WorkloadService,
) IstioStatusService {
	return IstioStatusService{
		cache:               cache,
		conf:                conf,
		discovery:           discovery,
		homeClusterSAClient: homeClusterSAClient,
		tracing:             tracing,
		userClients:         userClients,
		workloads:           workloads,
	}
}

// IstioStatusService deals with fetching istio/kubernetes component status
type IstioStatusService struct {
	// The global kiali cache. This should be passed into the IstioStatusService rather than created inside of it.
	cache               cache.KialiCache
	conf                *config.Config
	discovery           istio.MeshDiscovery
	homeClusterSAClient kubernetes.ClientInterface
	tracing             *TracingService
	userClients         map[string]kubernetes.UserClientInterface
	workloads           *WorkloadService
}

func (iss *IstioStatusService) GetStatus(ctx context.Context) (kubernetes.IstioComponentStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetStatus",
		observability.Attribute("package", "business"),
	)
	defer end()

	if !iss.conf.ExternalServices.Istio.ComponentStatuses.Enabled || !iss.conf.ExternalServices.Istio.IstioAPIEnabled {
		return kubernetes.IstioComponentStatus{}, nil
	}

	if istioStatus, ok := iss.cache.GetIstioStatus(); ok {
		return istioStatus, nil
	}

	result := kubernetes.IstioComponentStatus{}

	for cluster := range iss.userClients {
		ics, err := iss.getIstioComponentStatus(ctx, cluster)
		if err != nil {
			// istiod should be running
			return nil, err
		}
		result.Merge(ics)
	}

	// for local cluster only get addons
	result.Merge(iss.getAddonComponentStatus(iss.conf.KubernetesConfig.ClusterName))

	iss.cache.SetIstioStatus(result)

	return result, nil
}

func (iss *IstioStatusService) getIstioComponentStatus(ctx context.Context, cluster string) (kubernetes.IstioComponentStatus, error) {
	// Fetching workloads from component namespaces
	// If there's some explicit config then use that. Otherwise autodiscover.
	if len(iss.conf.ExternalServices.Istio.ComponentStatuses.Components) > 0 {
		log.Trace("Istio components config set. Using this instead of autodetecting components.")
		workloads, err := iss.getComponentNamespacesWorkloads(ctx, cluster)
		if err != nil {
			return kubernetes.IstioComponentStatus{}, err
		}

		return iss.getStatusOf(workloads, cluster), nil
	}

	log.Trace("Istio components config not set. Autodetecting components.")

	mesh, err := iss.discovery.Mesh(ctx)
	if err != nil {
		return kubernetes.IstioComponentStatus{}, err
	}

	var istiodStatus kubernetes.IstioComponentStatus
	isManaged := false
	for _, cp := range mesh.ControlPlanes {
		if cp.Cluster.Name == cluster {
			istiodStatus = append(istiodStatus, kubernetes.ComponentStatus{
				Cluster:   cp.Cluster.Name,
				Name:      cp.IstiodName,
				Namespace: cp.IstiodNamespace,
				Status:    cp.Status,
				IsCore:    true,
			})
		}
		for _, cl := range cp.ManagedClusters {
			if cl.Name == cluster {
				isManaged = true
				break
			}
		}
	}

	// if no control plane and no any other control plane which manages this cluster
	if len(istiodStatus) == 0 && !isManaged {
		istiodStatus = append(istiodStatus, kubernetes.ComponentStatus{
			Cluster:   cluster,
			Name:      "istiod",
			Namespace: iss.conf.IstioNamespace,
			Status:    kubernetes.ComponentNotFound,
			IsCore:    true,
		})
	}

	// Autodiscover gateways.
	allGateways, err := iss.workloads.GetGateways(ctx)
	if err != nil {
		// Don't error on gateways since they are non-essential.
		log.Debugf("Unable to get gateway workloads when building istio component status. Cluster: %s. Err: %s", cluster, err)
		return istiodStatus, nil
	}
	gateways := sliceutil.Filter(allGateways, func(gw *models.Workload) bool {
		return gw.Cluster == cluster
	})

	for _, gateway := range gateways {
		istiodStatus = append(istiodStatus, kubernetes.ComponentStatus{
			Cluster:   gateway.Cluster,
			Name:      gateway.Name,
			Namespace: gateway.Namespace,
			Status:    GetWorkloadStatus(*gateway),
			IsCore:    false,
		})
	}

	return istiodStatus, nil
}

func (iss *IstioStatusService) getComponentNamespacesWorkloads(ctx context.Context, cluster string) ([]*models.Workload, error) {
	var wg sync.WaitGroup

	nss := map[string]bool{}
	wls := make([]*models.Workload, 0)

	comNs := getComponentNamespaces(iss.conf)

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
				wls, err = iss.workloads.fetchWorkloadsFromCluster(ctx, cluster, n, "")
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

func getComponentNamespaces(conf *config.Config) []string {
	nss := make([]string, 0)

	// By default, add the istio control plane namespace
	nss = append(nss, conf.IstioNamespace)

	// Adding Istio Components namespaces
	externalServices := conf.ExternalServices
	for _, cmp := range externalServices.Istio.ComponentStatuses.Components {
		if cmp.Namespace != "" {
			nss = append(nss, cmp.Namespace)
		}
	}

	return nss
}

func istioCoreComponents(conf *config.Config) map[string]config.ComponentStatus {
	components := map[string]config.ComponentStatus{}
	cs := conf.ExternalServices.Istio.ComponentStatuses
	for _, c := range cs.Components {
		components[c.AppLabel] = c
	}
	return components
}

func (iss *IstioStatusService) getStatusOf(workloads []*models.Workload, cluster string) kubernetes.IstioComponentStatus {
	statusComponents := istioCoreComponents(iss.conf)
	isc := kubernetes.IstioComponentStatus{}
	cf := map[string]bool{}
	mcf := map[string]int{}

	// Map workloads there by app name
	for _, workload := range workloads {
		appLabel := labels.Set(workload.Labels).Get(config.IstioAppLabel)
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

		status := GetWorkloadStatus(*workload)
		// Add status
		isc = append(isc, kubernetes.ComponentStatus{
			Cluster: cluster,
			Namespace: func() string {
				if stat.Namespace != "" {
					return stat.Namespace
				}
				return workload.Namespace
			}(),
			Name:   workload.Name,
			Status: status,
			IsCore: stat.IsCore,
		})

	}

	// Add missing deployments
	componentNotFound := 0
	for comp, stat := range statusComponents {
		if _, found := cf[comp]; !found {
			// @TODO for remote cluster
			// multicluster components should exist on all clusters
			// !mfound || number < len(iss.userClients)
			if _, mfound := mcf[comp]; !mfound {
				componentNotFound += 1
				isc = append(isc, kubernetes.ComponentStatus{
					Cluster: cluster,
					Namespace: func() string {
						if stat.Namespace != "" {
							return stat.Namespace
						}
						return iss.conf.IstioNamespace
					}(),
					Name:   comp,
					Status: kubernetes.ComponentNotFound,
					IsCore: stat.IsCore,
				})
			}
		}
	}

	return isc
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

func (iss *IstioStatusService) getAddonComponentStatus(cluster string) kubernetes.IstioComponentStatus {
	var wg sync.WaitGroup
	wg.Add(4)

	staChan := make(chan kubernetes.IstioComponentStatus, 4)
	extServices := iss.conf.ExternalServices

	// https://github.com/kiali/kiali/issues/6966 - use the well-known Prom healthy endpoint
	if extServices.Prometheus.HealthCheckUrl == "" {
		extServices.Prometheus.HealthCheckUrl = extServices.Prometheus.URL + "/-/healthy"
	}

	ics := kubernetes.IstioComponentStatus{}

	go iss.getAddonStatus(cluster, "prometheus", true, extServices.Prometheus.IsCore, &extServices.Prometheus.Auth, extServices.Prometheus.URL, extServices.Prometheus.HealthCheckUrl, staChan, &wg)
	go iss.getAddonStatus(cluster, "grafana", extServices.Grafana.Enabled, extServices.Grafana.IsCore, &extServices.Grafana.Auth, extServices.Grafana.InternalURL, extServices.Grafana.HealthCheckUrl, staChan, &wg)
	go iss.getTracingStatus(cluster, "tracing", extServices.Tracing.Enabled, extServices.Tracing.IsCore, staChan, &wg)

	// Custom dashboards may use the main Prometheus config
	customProm := extServices.CustomDashboards.Prometheus
	if customProm.URL == "" {
		customProm = extServices.Prometheus
	}
	go iss.getAddonStatus(cluster, "custom dashboards", extServices.CustomDashboards.Enabled, extServices.CustomDashboards.IsCore, &customProm.Auth, customProm.URL, customProm.HealthCheckUrl, staChan, &wg)

	wg.Wait()

	close(staChan)
	for stat := range staChan {
		ics.Merge(stat)
	}

	return ics
}

func (iss *IstioStatusService) getAddonStatus(cluster string, name string, enabled bool, isCore bool, auth *config.Auth, url string, healthCheckUrl string, staChan chan<- kubernetes.IstioComponentStatus, wg *sync.WaitGroup) {
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
		auth.Token = iss.userClients[cluster].GetToken()
	}

	status := kubernetes.ComponentHealthy
	// Call the addOn service endpoint to find out whether is reachable or not
	_, statusCode, _, err := httputil.HttpGet(url, auth, 10*time.Second, nil, nil, iss.conf)
	if err != nil || statusCode > 399 {
		log.Tracef("addon health check failed: name=[%v], url=[%v], code=[%v]", name, url, statusCode)
		status = kubernetes.ComponentUnreachable
	}

	staChan <- kubernetes.IstioComponentStatus{
		kubernetes.ComponentStatus{
			Cluster: cluster,
			Name:    name,
			Status:  status,
			IsCore:  isCore,
		},
	}
}

func (iss *IstioStatusService) getTracingStatus(cluster string, name string, enabled bool, isCore bool, staChan chan<- kubernetes.IstioComponentStatus, wg *sync.WaitGroup) {
	defer wg.Done()

	if !enabled {
		return
	}

	status := kubernetes.ComponentHealthy

	accessible, err := iss.tracing.GetStatus(context.TODO())
	if !accessible {
		log.Errorf("Error fetching availability of the tracing service: %v", err)
		status = kubernetes.ComponentUnreachable
	}

	staChan <- kubernetes.IstioComponentStatus{
		kubernetes.ComponentStatus{
			Cluster: cluster,
			Name:    name,
			Status:  status,
			IsCore:  isCore,
		},
	}
}
