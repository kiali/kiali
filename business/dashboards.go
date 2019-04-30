package business

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kiali_monitoring/v1alpha1"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// DashboardsService deals with fetching dashboards from k8s client
type DashboardsService struct {
	prom      prometheus.ClientInterface
	k8sClient kubernetes.KialiMonitoringInterface
}

// NewDashboardsService initializes this business service
func NewDashboardsService(k8sClient kubernetes.KialiMonitoringInterface, prom prometheus.ClientInterface) DashboardsService {
	return DashboardsService{prom: prom, k8sClient: k8sClient}
}

func (in *DashboardsService) k8s() (kubernetes.KialiMonitoringInterface, error) {
	// Lazy init
	if in.k8sClient == nil {
		client, err := kubernetes.NewKialiMonitoringClient()
		if err != nil {
			return nil, fmt.Errorf("cannot initialize Kiali Monitoring Client: %v", err)
		}
		in.k8sClient = client
	}
	return in.k8sClient, nil
}

// k8sGetDashboard wraps KialiMonitoringInterface.GetDashboard with client creation & error handling
func (in *DashboardsService) k8sGetDashboard(namespace, template string) (*v1alpha1.MonitoringDashboard, error) {
	client, err := in.k8s()
	if err != nil {
		return nil, err
	}
	return client.GetDashboard(namespace, template)
}

// k8sGetDashboards wraps KialiMonitoringInterface.GetDashboards with client creation & error handling
func (in *DashboardsService) k8sGetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error) {
	client, err := in.k8s()
	if err != nil {
		return nil, err
	}
	return client.GetDashboards(namespace)
}

func (in *DashboardsService) loadRawDashboardResource(namespace, template string) (*v1alpha1.MonitoringDashboard, error) {
	// There is an override mechanism with dashboards: default dashboards can be provided in Kiali namespace,
	// and can be overriden in app namespace.
	// So we look for the one in app namespace first, and only if not found fallback to the one in istio-system.
	dashboard, err := in.k8sGetDashboard(namespace, template)
	if err != nil {
		cfg := config.Get()
		dashboard, err = in.k8sGetDashboard(cfg.IstioNamespace, template)
		if err != nil {
			return nil, err
		}
	}
	return dashboard, err
}

func (in *DashboardsService) loadRawDashboardResources(namespace string) (map[string]v1alpha1.MonitoringDashboard, error) {
	all := make(map[string]v1alpha1.MonitoringDashboard)

	// From Kiali namespace
	cfg := config.Get()
	dashboards, err := in.k8sGetDashboards(cfg.IstioNamespace)
	if err != nil {
		return nil, err
	}
	for _, d := range dashboards {
		all[d.Name] = d
	}

	// From specific namespace
	if namespace != cfg.IstioNamespace {
		dashboards, err = in.k8sGetDashboards(namespace)
		if err != nil {
			return nil, err
		}
		for _, d := range dashboards {
			all[d.Name] = d
		}
	}

	return all, nil
}

func (in *DashboardsService) loadAndResolveDashboardResource(namespace, template string, loaded map[string]bool) (*v1alpha1.MonitoringDashboard, error) {
	// Circular dependency check
	if _, ok := loaded[template]; ok {
		return nil, fmt.Errorf("cannot load dashboard %s due to circular dependency detected. Already loaded dependencies: %v", template, loaded)
	}
	loaded[template] = true
	dashboard, err := in.loadRawDashboardResource(namespace, template)
	if err != nil {
		return nil, err
	}
	err = in.resolveReferences(namespace, dashboard, loaded)
	return dashboard, err
}

// resolveReferences resolves the composition mechanism that allows to reference a dashboard from another one
func (in *DashboardsService) resolveReferences(namespace string, dashboard *v1alpha1.MonitoringDashboard, loaded map[string]bool) error {
	resolved := []v1alpha1.MonitoringDashboardItem{}
	for _, item := range dashboard.Spec.Items {
		reference := strings.TrimSpace(item.Include)
		if reference != "" {
			// reference can point to a whole dashboard (ex: microprofile-1.0) or a chart within a dashboard (ex: microprofile-1.0$Thread count)
			parts := strings.Split(reference, "$")
			dashboardRefName := parts[0]
			composedDashboard, err := in.loadAndResolveDashboardResource(namespace, dashboardRefName, loaded)
			if err != nil {
				return err
			}
			for _, item2 := range composedDashboard.Spec.Items {
				if len(parts) > 1 {
					// Reference a specific chart
					if item2.Chart.Name == parts[1] {
						resolved = append(resolved, item2)
						break
					}
				} else {
					// Reference the whole dashboard
					resolved = append(resolved, item2)
				}
			}
		} else {
			resolved = append(resolved, item)
		}
	}
	dashboard.Spec.Items = resolved
	return nil
}

// GetDashboard returns a dashboard filled-in with target data
func (in *DashboardsService) GetDashboard(params prometheus.CustomMetricsQuery, template string) (*models.MonitoringDashboard, error) {
	dashboard, err := in.loadAndResolveDashboardResource(params.Namespace, template, map[string]bool{})
	if err != nil {
		return nil, err
	}

	aggLabels := models.ConvertAggregations(dashboard.Spec)
	cfg := config.Get()
	labels := fmt.Sprintf(`{namespace="%s",%s="%s"`, params.Namespace, cfg.IstioLabels.AppLabelName, params.App)
	if params.Version != "" {
		labels += fmt.Sprintf(`,%s="%s"`, cfg.IstioLabels.VersionLabelName, params.Version)
	} else {
		// For app-based dashboards, we automatically add a possible aggregation/grouping over versions
		versionsAgg := models.Aggregation{
			Label:       "version",
			DisplayName: "Version",
		}
		aggLabels = append([]models.Aggregation{versionsAgg}, aggLabels...)
	}
	labels += "}"
	grouping := strings.Join(params.ByLabels, ",")

	wg := sync.WaitGroup{}
	wg.Add(len(dashboard.Spec.Items))
	filledCharts := make([]models.Chart, len(dashboard.Spec.Items))

	for i, item := range dashboard.Spec.Items {
		go func(idx int, chart v1alpha1.MonitoringDashboardChart) {
			defer wg.Done()
			filledCharts[idx] = models.ConvertChart(chart)
			if chart.DataType == v1alpha1.Raw {
				aggregator := params.RawDataAggregator
				if chart.Aggregator != "" {
					aggregator = chart.Aggregator
				}
				filledCharts[idx].Metric = in.prom.FetchRange(chart.MetricName, labels, grouping, aggregator, &params.BaseMetricsQuery)
			} else if chart.DataType == v1alpha1.Rate {
				filledCharts[idx].Metric = in.prom.FetchRateRange(chart.MetricName, labels, grouping, &params.BaseMetricsQuery)
			} else {
				filledCharts[idx].Histogram = in.prom.FetchHistogramRange(chart.MetricName, labels, grouping, &params.BaseMetricsQuery)
			}
		}(i, item.Chart)
	}

	wg.Wait()
	return &models.MonitoringDashboard{
		Title:        dashboard.Spec.Title,
		Charts:       filledCharts,
		Aggregations: aggLabels,
	}, nil
}

type istioChart struct {
	models.Chart
	refName string
}

var istioCharts = []istioChart{
	{
		Chart: models.Chart{
			Name:  "Request volume",
			Unit:  "ops",
			Spans: 6,
		},
		refName: "request_count",
	},
	{
		Chart: models.Chart{
			Name:  "Request duration",
			Unit:  "seconds",
			Spans: 6,
		},
		refName: "request_duration",
	},
	{
		Chart: models.Chart{
			Name:  "Request size",
			Unit:  "bytes",
			Spans: 6,
		},
		refName: "request_size",
	},
	{
		Chart: models.Chart{
			Name:  "Response size",
			Unit:  "bytes",
			Spans: 6,
		},
		refName: "response_size",
	},
	{
		Chart: models.Chart{
			Name:  "TCP received",
			Unit:  "bitrate",
			Spans: 6,
		},
		refName: "tcp_received",
	},
	{
		Chart: models.Chart{
			Name:  "TCP sent",
			Unit:  "bitrate",
			Spans: 6,
		},
		refName: "tcp_sent",
	},
}

// GetIstioDashboard returns Istio dashboard (currently hard-coded) filled-in with metrics
func (in *DashboardsService) GetIstioDashboard(params prometheus.IstioMetricsQuery) (*models.MonitoringDashboard, error) {
	var dashboard models.MonitoringDashboard
	// Copy dashboard
	if params.Direction == "inbound" {
		dashboard = models.PrepareIstioDashboard("Inbound", "destination", "source")
	} else {
		dashboard = models.PrepareIstioDashboard("Outbound", "source", "destination")
	}

	metrics := in.prom.GetMetrics(&params)

	for _, chartTpl := range istioCharts {
		newChart := chartTpl.Chart
		if metric, ok := metrics.Metrics[chartTpl.refName]; ok {
			newChart.Metric = metric
		}
		if histo, ok := metrics.Histograms[chartTpl.refName]; ok {
			newChart.Histogram = histo
		}
		dashboard.Charts = append(dashboard.Charts, newChart)
	}

	return &dashboard, nil
}

// GetCustomDashboardRefs finds all dashboard IDs and Titles associated to this app and add them to the model
func (in *DashboardsService) GetCustomDashboardRefs(namespace, app, version string, pods models.Pods) []models.Runtime {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "DashboardsService", "GetCustomDashboardRefs")
	defer promtimer.ObserveNow(&err)

	uniqueRefsList := getUniqueRuntimes(pods)
	if len(uniqueRefsList) > 0 {
		return in.buildRuntimesList(namespace, uniqueRefsList)
	}
	if app != "" {
		// Discovery only works with proper "app" labelling
		return in.discoverRuntimesList(namespace, app, version)
	}
	return []models.Runtime{}
}

func getUniqueRuntimes(pods models.Pods) []string {
	// Get uniqueness from plain list rather than map to preserve ordering; anyway, very low amount of objects is expected
	uniqueRefs := []string{}
	for _, pod := range pods {
		for _, ref := range pod.RuntimesAnnotation {
			if ref != "" {
				exists := false
				for _, existingRef := range uniqueRefs {
					if ref == existingRef {
						exists = true
						break
					}
				}
				if !exists {
					uniqueRefs = append(uniqueRefs, ref)
				}
			}
		}
	}
	return uniqueRefs
}

func (in *DashboardsService) buildRuntimesList(namespace string, templatesNames []string) []models.Runtime {
	dashboards := make([]*v1alpha1.MonitoringDashboard, len(templatesNames))
	wg := sync.WaitGroup{}
	wg.Add(len(templatesNames))
	for idx, template := range templatesNames {
		go func(i int, tpl string) {
			defer wg.Done()
			dashboard, err := in.loadRawDashboardResource(namespace, tpl)
			if err != nil {
				log.Errorf("Cannot get dashboard %s in namespace %s. Error was: %v", tpl, namespace, err)
			} else {
				dashboards[i] = dashboard
			}
		}(idx, template)
	}

	wg.Wait()

	runtimes := []models.Runtime{}
	for _, dashboard := range dashboards {
		if dashboard == nil {
			continue
		}
		runtimes = addDashboardToRuntimes(dashboard, runtimes)
	}
	return runtimes
}

func (in *DashboardsService) fetchMetricNames(namespace, app, version string) []string {
	cfg := config.Get()
	labels := fmt.Sprintf(`{namespace="%s",%s="%s"`, namespace, cfg.IstioLabels.AppLabelName, app)
	if version != "" {
		labels += fmt.Sprintf(`,%s="%s"`, cfg.IstioLabels.VersionLabelName, version)
	}
	labels += "}"
	metrics, err := in.prom.GetMetricsForLabels([]string{labels})
	if err != nil {
		log.Errorf("Runtimes discovery failed, cannot load metrics for labels: %s. Error was: %v", labels, err)
	}
	return metrics
}

func (in *DashboardsService) discoverRuntimesList(namespace, app, version string) []models.Runtime {
	var metrics []string
	wg := sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		metrics = in.fetchMetricNames(namespace, app, version)
	}()

	allDashboards, err := in.loadRawDashboardResources(namespace)
	if err != nil {
		log.Errorf("Runtimes discovery failed, cannot load dashboards in namespace %s. Error was: %v", namespace, err)
		return []models.Runtime{}
	}

	wg.Wait()
	return runDiscoveryMatcher(metrics, allDashboards)
}

func runDiscoveryMatcher(metrics []string, allDashboards map[string]v1alpha1.MonitoringDashboard) []models.Runtime {
	// In all dashboards, finds the ones that match the metrics set
	// We must exclude from the results included dashboards when both the including and the included dashboards are matching
	runtimesMap := make(map[string]*v1alpha1.MonitoringDashboard)
	for _, d := range allDashboards {
		dashboard := d // sticky reference
		matchReference := strings.TrimSpace(dashboard.Spec.DiscoverOn)
		if matchReference != "" {
			for _, metric := range metrics {
				if matchReference == strings.TrimSpace(metric) {
					if _, exists := runtimesMap[dashboard.Name]; !exists {
						runtimesMap[dashboard.Name] = &dashboard
					}
					// Mark included dashboards as already found
					// and set them "nil" to not show them as standalone dashboards even if they match
					for _, item := range dashboard.Spec.Items {
						if item.Include != "" {
							runtimesMap[item.Include] = nil
						}
					}
					break
				}
			}
		}
	}
	runtimes := []models.Runtime{}
	for _, dashboard := range runtimesMap {
		if dashboard != nil {
			runtimes = addDashboardToRuntimes(dashboard, runtimes)
		}
	}
	sort.Slice(runtimes, func(i, j int) bool { return runtimes[i].Name < runtimes[j].Name })
	return runtimes
}

func addDashboardToRuntimes(dashboard *v1alpha1.MonitoringDashboard, runtimes []models.Runtime) []models.Runtime {
	runtime := dashboard.Spec.Runtime
	ref := models.DashboardRef{
		Template: dashboard.Name,
		Title:    dashboard.Spec.Title,
	}
	found := false
	for i := range runtimes {
		rtObj := &runtimes[i]
		if rtObj.Name == runtime {
			rtObj.DashboardRefs = append(rtObj.DashboardRefs, ref)
			found = true
			break
		}
	}
	if !found {
		runtimes = append(runtimes, models.Runtime{
			Name:          runtime,
			DashboardRefs: []models.DashboardRef{ref},
		})
	}
	return runtimes
}
