package business

import (
	dlg "github.com/kiali/k-charted/business"
	dlgconfig "github.com/kiali/k-charted/config"
	"github.com/kiali/k-charted/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// DashboardsService deals with fetching dashboards from k8s client
type DashboardsService struct {
	delegate dlg.DashboardsService
	prom     prometheus.ClientInterface
}

// NewDashboardsService initializes this business service
func NewDashboardsService(prom prometheus.ClientInterface) DashboardsService {
	delegate := dlg.NewDashboardsService(DashboardsConfig())
	return DashboardsService{delegate: delegate, prom: prom}
}

func DashboardsConfig() dlgconfig.Config {
	cfg := config.Get()
	return dlgconfig.Config{
		GlobalNamespace:  cfg.IstioNamespace,
		PrometheusURL:    cfg.ExternalServices.Prometheus.CustomMetricsURL,
		AppLabelName:     cfg.IstioLabels.AppLabelName,
		VersionLabelName: cfg.IstioLabels.VersionLabelName,
		Errorf:           log.Errorf,
	}
}

type istioChart struct {
	model.Chart
	refName string
}

var istioCharts = []istioChart{
	{
		Chart: model.Chart{
			Name:  "Request volume",
			Unit:  "ops",
			Spans: 6,
		},
		refName: "request_count",
	},
	{
		Chart: model.Chart{
			Name:  "Request duration",
			Unit:  "seconds",
			Spans: 6,
		},
		refName: "request_duration",
	},
	{
		Chart: model.Chart{
			Name:  "Request size",
			Unit:  "bytes",
			Spans: 6,
		},
		refName: "request_size",
	},
	{
		Chart: model.Chart{
			Name:  "Response size",
			Unit:  "bytes",
			Spans: 6,
		},
		refName: "response_size",
	},
	{
		Chart: model.Chart{
			Name:  "TCP received",
			Unit:  "bitrate",
			Spans: 6,
		},
		refName: "tcp_received",
	},
	{
		Chart: model.Chart{
			Name:  "TCP sent",
			Unit:  "bitrate",
			Spans: 6,
		},
		refName: "tcp_sent",
	},
}

// GetIstioDashboard returns Istio dashboard (currently hard-coded) filled-in with metrics
func (in *DashboardsService) GetIstioDashboard(params prometheus.IstioMetricsQuery) (*model.MonitoringDashboard, error) {
	var dashboard model.MonitoringDashboard
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
			newChart.Metric = models.ConvertMatrix(metric.Matrix)
		}
		if histo, ok := metrics.Histograms[chartTpl.refName]; ok {
			newChart.Histogram = models.ConvertHistogram(histo)
		}
		dashboard.Charts = append(dashboard.Charts, newChart)
	}

	return &dashboard, nil
}

// GetCustomDashboardRefs finds all dashboard IDs and Titles associated to this app and add them to the model
func (in *DashboardsService) GetCustomDashboardRefs(namespace, app, version string, pods models.Pods) []model.Runtime {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "DashboardsService", "GetCustomDashboardRefs")
	defer promtimer.ObserveNow(&err)

	uniqueRefsList := getUniqueRuntimes(pods)
	return in.delegate.GetCustomDashboardRefs(namespace, app, version, uniqueRefsList)
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
