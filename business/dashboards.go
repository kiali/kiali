package business

import (
	"fmt"
	"strings"
	"sync"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

// DashboardsService deals with fetching dashboards from k8s client
type DashboardsService struct {
	prom prometheus.ClientInterface
	mon  kubernetes.KialiMonitoringInterface
}

// Memoize titles
var dashboardTitles = make(map[string]string)

func dashboardKey(namespace, name string) string {
	// @ is forbidden charatecter in k8s resource name, so safe to use here
	return name + "@" + namespace
}

// NewDashboardsService initializes this business service
func NewDashboardsService(mon kubernetes.KialiMonitoringInterface, prom prometheus.ClientInterface) DashboardsService {
	return DashboardsService{prom: prom, mon: mon}
}

func (in *DashboardsService) loadDashboardResource(namespace, template string) (*kubernetes.MonitoringDashboard, error) {
	// There is an override mechanism with dashboards: default dashboards can be provided in Kiali namespace,
	// and can be overriden in app namespace.
	// So we look for the one in app namespace first, and only if not found fallback to the one in istio-system.
	dashboard, err := in.mon.GetDashboard(namespace, template)
	if err != nil {
		cfg := config.Get()
		dashboard, err = in.mon.GetDashboard(cfg.IstioNamespace, template)
		if err != nil {
			return nil, err
		}
	}

	// Update cached titles as soon as we reload a dashboard, to keep it decently up-to-date
	dashboardTitles[dashboardKey(namespace, template)] = dashboard.Spec.Title

	return dashboard, nil
}

// GetDashboard returns a dashboard filled-in with target data
func (in *DashboardsService) GetDashboard(params prometheus.CustomMetricsQuery, template string) (*models.MonitoringDashboard, error) {
	dashboard, err := in.loadDashboardResource(params.Namespace, template)
	if err != nil {
		return nil, err
	}

	labels := fmt.Sprintf(`{namespace="%s",app="%s"`, params.Namespace, params.App)
	if params.Version != "" {
		labels += fmt.Sprintf(`,version="%s"`, params.Version)
	}
	labels += "}"
	grouping := strings.Join(params.ByLabels, ",")

	wg := sync.WaitGroup{}
	wg.Add(len(dashboard.Spec.Charts))
	filledCharts := make([]models.Chart, len(dashboard.Spec.Charts))

	for i, c := range dashboard.Spec.Charts {
		go func(idx int, chart kubernetes.MonitoringDashboardChart) {
			defer wg.Done()
			filledCharts[idx] = models.ConvertChart(chart)
			if chart.MetricType == kubernetes.Counter {
				filledCharts[idx].CounterRate = in.prom.FetchRateRange(chart.MetricName, labels, grouping, &params.BaseMetricsQuery)
			} else {
				filledCharts[idx].Histogram = in.prom.FetchHistogramRange(chart.MetricName, labels, grouping, &params.BaseMetricsQuery)
			}
		}(i, c)
	}

	wg.Wait()
	return &models.MonitoringDashboard{
		Title:        dashboard.Spec.Title,
		Charts:       filledCharts,
		Aggregations: models.ConvertAggregations(dashboard.Spec),
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
			Spans: 12,
		},
		refName: "request_count",
	},
	{
		Chart: models.Chart{
			Name:  "Request duration",
			Unit:  "s",
			Spans: 12,
		},
		refName: "request_duration",
	},
	{
		Chart: models.Chart{
			Name:  "Request size",
			Unit:  "B",
			Spans: 12,
		},
		refName: "request_size",
	},
	{
		Chart: models.Chart{
			Name:  "Response size",
			Unit:  "B",
			Spans: 12,
		},
		refName: "response_size",
	},
	{
		Chart: models.Chart{
			Name:  "TCP received",
			Unit:  "bps",
			Spans: 12,
		},
		refName: "tcp_received",
	},
	{
		Chart: models.Chart{
			Name:  "TCP sent",
			Unit:  "bps",
			Spans: 12,
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
			newChart.CounterRate = metric
		}
		if histo, ok := metrics.Histograms[chartTpl.refName]; ok {
			newChart.Histogram = histo
		}
		dashboard.Charts = append(dashboard.Charts, newChart)
	}

	return &dashboard, nil
}

func (in *DashboardsService) getDashboardTitle(namespace, template string) string {
	key := dashboardKey(namespace, template)
	if title, ok := dashboardTitles[key]; ok {
		return title
	}
	dashboard, err := in.loadDashboardResource(namespace, template)
	if err != nil {
		log.Errorf("Cannot get dashboard %s in namespace %s", template, namespace)
		return ""
	}
	return dashboard.Spec.Title
}

func (in *DashboardsService) getTitlesFromTemplates(namespace string, templatesNames map[string]string) []models.DashboardRef {
	dashboards := []models.DashboardRef{}
	for _, tpl := range templatesNames {
		title := in.getDashboardTitle(namespace, tpl)
		if title != "" {
			dashboards = append(dashboards, models.DashboardRef{
				Template: tpl,
				Title:    title,
			})
		}
	}
	return dashboards
}
