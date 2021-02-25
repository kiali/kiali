package business

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/monitoringdashboards"
	"github.com/kiali/kiali/kubernetes/monitoringdashboards/v1alpha1"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

const defaultNamespaceLabel = "namespace"

// DashboardsService deals with fetching dashboards from k8s client
type DashboardsService struct {
	promClient      prometheus.ClientInterface
	k8sClient       monitoringdashboards.ClientInterface
	promConfig      config.PrometheusConfig
	globalNamespace string
	namespaceLabel  string
	CustomEnabled   bool
}

// NewDashboardsService initializes this business service
func NewDashboardsService() *DashboardsService {
	cfg := config.Get()
	customEnabled := cfg.ExternalServices.CustomDashboards.Enabled
	prom := cfg.ExternalServices.Prometheus
	if customEnabled && cfg.ExternalServices.CustomDashboards.Prometheus.URL != "" {
		prom = cfg.ExternalServices.CustomDashboards.Prometheus
	}
	nsLabel := cfg.ExternalServices.CustomDashboards.NamespaceLabel
	if nsLabel == "" {
		nsLabel = "kubernetes_namespace"
	}
	return &DashboardsService{
		CustomEnabled:   customEnabled,
		promConfig:      prom,
		globalNamespace: cfg.Deployment.Namespace,
		namespaceLabel:  nsLabel,
	}
}

func (in *DashboardsService) prom() (prometheus.ClientInterface, error) {
	// Lazy init
	if in.promClient == nil {
		client, err := prometheus.NewClientForConfig(in.promConfig)
		if err != nil {
			return nil, fmt.Errorf("cannot initialize Prometheus Client: %v", err)
		}
		in.promClient = client
	}
	return in.promClient, nil
}

func (in *DashboardsService) k8s() (monitoringdashboards.ClientInterface, error) {
	// Lazy init
	if in.k8sClient == nil {
		client, err := monitoringdashboards.NewClient()
		if err != nil {
			return nil, fmt.Errorf("cannot initialize Kubernetes Client: %v", err)
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
	log.Tracef("load k8s dashboard '%s' in namespace '%s'", template, namespace)
	return client.GetDashboard(namespace, template)
}

// k8sGetDashboards wraps KialiMonitoringInterface.GetDashboards with client creation & error handling
func (in *DashboardsService) k8sGetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error) {
	client, err := in.k8s()
	if err != nil {
		return nil, err
	}
	log.Tracef("load all k8s dashboards in namespace '%s'", namespace)
	return client.GetDashboards(namespace)
}

func (in *DashboardsService) loadRawDashboardResource(namespace, template string) (*v1alpha1.MonitoringDashboard, error) {
	// There is an override mechanism with dashboards: default dashboards can be provided in Kiali namespace,
	// and can be overriden in app namespace.
	// So we look for the one in app namespace first, and only if not found fallback to the one in istio-system.
	dashboard, err := in.k8sGetDashboard(namespace, template)
	if err != nil && in.globalNamespace != "" {
		dashboard, err = in.k8sGetDashboard(in.globalNamespace, template)
		if err != nil {
			return nil, err
		}
	}
	return dashboard, err
}

func (in *DashboardsService) loadRawDashboardResources(namespace string) (map[string]v1alpha1.MonitoringDashboard, error) {
	all := make(map[string]v1alpha1.MonitoringDashboard)

	// From global namespace
	if in.globalNamespace != "" {
		dashboards, err := in.k8sGetDashboards(in.globalNamespace)
		if err != nil {
			return nil, err
		}
		for _, d := range dashboards {
			all[d.Name] = d
		}
	}

	// From specific namespace
	if namespace != in.globalNamespace {
		dashboards, err := in.k8sGetDashboards(namespace)
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
func (in *DashboardsService) GetDashboard(authInfo *api.AuthInfo, params models.DashboardQuery, template string) (*models.MonitoringDashboard, error) {
	promClient, err := in.prom()
	if err != nil {
		return nil, err
	}
	dashboard, err := in.loadAndResolveDashboardResource(params.Namespace, template, map[string]bool{})
	if err != nil {
		return nil, err
	}

	filters := in.buildLabels(params.Namespace, params.LabelsFilters)
	aggLabels := append(params.AdditionalLabels, models.ConvertAggregations(dashboard.Spec)...)
	if len(aggLabels) == 0 {
		// Prevent null in json
		aggLabels = []models.Aggregation{}
	}

	wg := sync.WaitGroup{}
	wg.Add(len(dashboard.Spec.Items) + 1)
	filledCharts := make([]models.Chart, len(dashboard.Spec.Items))

	for i, item := range dashboard.Spec.Items {
		go func(idx int, chart v1alpha1.MonitoringDashboardChart) {
			defer wg.Done()
			conversionParams := models.ConversionParams{Scale: 1.0, SortLabel: chart.SortLabel, SortLabelParseAs: chart.SortLabelParseAs}
			if chart.UnitScale != 0.0 {
				conversionParams.Scale = chart.UnitScale
			}
			// Group by labels is concat of what is defined in CR + what is passed as parameters
			byLabels := append(chart.GroupLabels, params.ByLabels...)
			if len(chart.SortLabel) > 0 {
				// We also need to group by the label used for sorting, if not explicitly present
				present := false
				for _, lbl := range byLabels {
					if lbl == chart.SortLabel {
						present = true
						break
					}
				}
				if !present {
					byLabels = append(byLabels, chart.SortLabel)
					// Mark the sort label to not be kept during conversion
					conversionParams.RemoveSortLabel = true
				}
			}
			grouping := strings.Join(byLabels, ",")

			filledCharts[idx] = models.ConvertChart(chart)
			metrics := chart.GetMetrics()
			for _, ref := range metrics {
				var converted []models.Metric
				var err error
				if chart.DataType == v1alpha1.Raw {
					aggregator := params.RawDataAggregator
					if chart.Aggregator != "" {
						aggregator = chart.Aggregator
					}
					metric := promClient.FetchRange(ref.MetricName, filters, grouping, aggregator, &params.RangeQuery)
					converted, err = models.ConvertMetric(ref.DisplayName, metric, conversionParams)
				} else if chart.DataType == v1alpha1.Rate {
					metric := promClient.FetchRateRange(ref.MetricName, []string{filters}, grouping, &params.RangeQuery)
					converted, err = models.ConvertMetric(ref.DisplayName, metric, conversionParams)
				} else {
					histo := promClient.FetchHistogramRange(ref.MetricName, filters, grouping, &params.RangeQuery)
					converted, err = models.ConvertHistogram(ref.DisplayName, histo, conversionParams)
				}

				// Fill in chart
				if err != nil {
					filledCharts[idx].Error = err.Error()
				} else {
					filledCharts[idx].Metrics = append(filledCharts[idx].Metrics, converted...)
				}
			}
		}(i, item.Chart)
	}

	var externalLinks []models.ExternalLink
	go func() {
		defer wg.Done()
		links, _, err := GetGrafanaLinks(authInfo, dashboard.Spec.ExternalLinks)
		if err != nil {
			log.Errorf("Error while getting Grafana links: %v", err)
		}
		if links != nil {
			externalLinks = links
		} else {
			externalLinks = []models.ExternalLink{}
		}
	}()

	wg.Wait()
	return &models.MonitoringDashboard{
		Title:         dashboard.Spec.Title,
		Charts:        filledCharts,
		Aggregations:  aggLabels,
		ExternalLinks: externalLinks,
	}, nil
}

// SearchExplicitDashboards will check annotations of all supplied pods to extract a unique list of dashboards
//	Accepted annotations are "kiali.io/runtimes" and "kiali.io/dashboards"
func (in *DashboardsService) SearchExplicitDashboards(namespace string, pods []models.Pod) []models.Runtime {
	uniqueRefsList := extractUniqueDashboards(pods)
	if len(uniqueRefsList) > 0 {
		log.Tracef("getting dashboards from refs list: %v", uniqueRefsList)
		return in.buildRuntimesList(namespace, uniqueRefsList)
	}
	return []models.Runtime{}
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
				log.Errorf("cannot get dashboard %s in namespace %s. Error was: %v", tpl, namespace, err)
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

func (in *DashboardsService) fetchMetricNames(namespace string, labelsFilters map[string]string) []string {
	promClient, err := in.prom()
	if err != nil {
		return []string{}
	}

	labels := in.buildLabels(namespace, labelsFilters)
	metrics, err := promClient.GetMetricsForLabels([]string{labels})
	if err != nil {
		log.Errorf("runtimes discovery failed, cannot load metrics for labels: %s. Error was: %v", labels, err)
	}
	return metrics
}

// discoverDashboards tries to discover dashboards based on existing metrics
func (in *DashboardsService) discoverDashboards(namespace string, labelsFilters map[string]string) []models.Runtime {
	log.Tracef("starting runtimes discovery on namespace %s with filters [%v]", namespace, labelsFilters)

	var metrics []string
	wg := sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		metrics = in.fetchMetricNames(namespace, labelsFilters)
	}()

	allDashboards, err := in.loadRawDashboardResources(namespace)
	if err != nil {
		log.Errorf("runtimes discovery failed, cannot load dashboards in namespace %s. Error was: %v", namespace, err)
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

func (in *DashboardsService) buildLabels(namespace string, labelsFilters map[string]string) string {
	namespaceLabel := in.namespaceLabel
	if namespaceLabel == "" {
		namespaceLabel = defaultNamespaceLabel
	}
	labels := fmt.Sprintf(`{%s="%s"`, namespaceLabel, namespace)
	for k, v := range labelsFilters {
		labels += fmt.Sprintf(`,%s="%s"`, prometheus.SanitizeLabelName(k), v)
	}
	labels += "}"
	return labels
}

type istioChart struct {
	models.Chart
	refName string
	scale   float64
}

func getIstioCharts() []istioChart {
	istioCharts := []istioChart{
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
			refName: "request_duration_millis",
			scale:   0.001,
		},
		{
			Chart: models.Chart{
				Name:  "Request throughput",
				Unit:  "bitrate",
				Spans: 6,
			},
			refName: "request_throughput",
			scale:   8, // Bps to bps
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
				Name:  "Response throughput",
				Unit:  "bitrate",
				Spans: 6,
			},
			refName: "response_throughput",
			scale:   8, // Bps to bps
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
	return istioCharts
}

func GetIstioScaler() func(name string) float64 {
	charts := getIstioCharts()
	return func(name string) float64 {
		for _, c := range charts {
			if c.refName == name {
				return c.scale
			}
		}
		return 1.0
	}
}

// GetIstioDashboard returns Istio dashboard (currently hard-coded) filled-in with metrics
func (in *DashboardsService) BuildIstioDashboard(metrics models.MetricsMap, direction string) *models.MonitoringDashboard {
	var dashboard models.MonitoringDashboard
	// Copy dashboard
	if direction == "inbound" {
		dashboard = models.PrepareIstioDashboard("Inbound", "destination", "source")
	} else {
		dashboard = models.PrepareIstioDashboard("Outbound", "source", "destination")
	}

	istioCharts := getIstioCharts()

	for _, chartTpl := range istioCharts {
		newChart := chartTpl.Chart
		conversionParams := models.ConversionParams{Scale: 1.0}
		if chartTpl.scale != 0.0 {
			conversionParams.Scale = chartTpl.scale
		}
		if metrics := metrics[chartTpl.refName]; metrics != nil {
			newChart.Metrics = metrics
		} else {
			newChart.Metrics = []models.Metric{}
		}
		dashboard.Charts = append(dashboard.Charts, newChart)
	}
	return &dashboard
}

// GetCustomDashboardRefs finds all dashboard IDs and Titles associated to this app and add them to the model
func (in *DashboardsService) GetCustomDashboardRefs(namespace, app, version string, pods []*models.Pod) []models.Runtime {
	if !in.CustomEnabled || app == "" {
		// Custom dashboards are disabled or the app label is not configured
		return []models.Runtime{}
	}

	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "DashboardsService", "GetCustomDashboardRefs")
	defer promtimer.ObserveNow(&err)

	// A better way to do?
	var podsCast []models.Pod
	for _, p := range pods {
		podsCast = append(podsCast, *p)
	}
	runtimes := in.SearchExplicitDashboards(namespace, podsCast)

	if len(runtimes) == 0 {
		cfg := config.Get()
		discoveryEnabled := cfg.ExternalServices.CustomDashboards.DiscoveryEnabled
		if discoveryEnabled == config.DashboardsDiscoveryEnabled ||
			(discoveryEnabled == config.DashboardsDiscoveryAuto &&
				len(pods) <= cfg.ExternalServices.CustomDashboards.DiscoveryAutoThreshold) {
			filters := make(map[string]string)
			filters[cfg.IstioLabels.AppLabelName] = app
			if version != "" {
				filters[cfg.IstioLabels.VersionLabelName] = version
			}
			runtimes = in.discoverDashboards(namespace, filters)
		}
	}
	return runtimes
}

func extractUniqueDashboards(pods []models.Pod) []string {
	// Get uniqueness from plain list rather than map to preserve ordering; anyway, very low amount of objects is expected
	uniqueRefs := []string{}
	for _, pod := range pods {
		// Check for custom dashboards annotation
		dashboards := extractDashboardsFromAnnotation(pod, "kiali.io/runtimes")
		dashboards = append(dashboards, extractDashboardsFromAnnotation(pod, "kiali.io/dashboards")...)
		for _, ref := range dashboards {
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

func extractDashboardsFromAnnotation(pod models.Pod, annotation string) []string {
	dashboards := []string{}
	if rawDashboards, ok := pod.Annotations[annotation]; ok {
		rawDashboardsSlice := strings.Split(rawDashboards, ",")
		for _, dashboard := range rawDashboardsSlice {
			dashboards = append(dashboards, strings.TrimSpace(dashboard))
		}
	}
	return dashboards
}
