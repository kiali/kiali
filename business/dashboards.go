package business

import (
	dlg "github.com/kiali/k-charted/business"
	dlgconfig "github.com/kiali/k-charted/config"
	"github.com/kiali/k-charted/config/promconfig"
	kmodel "github.com/kiali/k-charted/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
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
	auth := cfg.ExternalServices.Prometheus.Auth
	if auth.UseKialiToken {
		token, err := kubernetes.GetKialiToken()
		if err != nil {
			log.Errorf("Could not read the Kiali Service Account token: %v", err)
		}
		auth.Token = token
	}
	return dlgconfig.Config{
		GlobalNamespace: cfg.Deployment.Namespace,
		Prometheus: promconfig.PrometheusConfig{
			URL: cfg.ExternalServices.Prometheus.CustomMetricsURL,
			Auth: promconfig.Auth{
				Type:               auth.Type,
				Username:           auth.Username,
				Password:           auth.Password,
				Token:              auth.Token,
				InsecureSkipVerify: auth.InsecureSkipVerify,
				CAFile:             auth.CAFile,
			},
		},
		Errorf: log.Errorf,
		Tracef: log.Tracef,
	}
}

type istioChart struct {
	kmodel.Chart
	refName string
}

var istioCharts = []istioChart{
	{
		Chart: kmodel.Chart{
			Name:  "Request volume",
			Unit:  "ops",
			Spans: 6,
		},
		refName: "request_count",
	},
	{
		Chart: kmodel.Chart{
			Name:  "Request duration",
			Unit:  "seconds",
			Spans: 6,
		},
		refName: "request_duration",
	},
	{
		Chart: kmodel.Chart{
			Name:  "Request size",
			Unit:  "bytes",
			Spans: 6,
		},
		refName: "request_size",
	},
	{
		Chart: kmodel.Chart{
			Name:  "Response size",
			Unit:  "bytes",
			Spans: 6,
		},
		refName: "response_size",
	},
	{
		Chart: kmodel.Chart{
			Name:  "TCP received",
			Unit:  "bitrate",
			Spans: 6,
		},
		refName: "tcp_received",
	},
	{
		Chart: kmodel.Chart{
			Name:  "TCP sent",
			Unit:  "bitrate",
			Spans: 6,
		},
		refName: "tcp_sent",
	},
}

// GetIstioDashboard returns Istio dashboard (currently hard-coded) filled-in with metrics
func (in *DashboardsService) GetIstioDashboard(params prometheus.IstioMetricsQuery) (*kmodel.MonitoringDashboard, error) {
	var dashboard kmodel.MonitoringDashboard
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
		} else {
			newChart.Metric = []*kmodel.SampleStream{}
		}
		if histo, ok := metrics.Histograms[chartTpl.refName]; ok {
			newChart.Histogram = models.ConvertHistogram(histo)
		} else {
			newChart.Histogram = map[string][]*kmodel.SampleStream{}
		}
		dashboard.Charts = append(dashboard.Charts, newChart)
	}

	return &dashboard, nil
}

// GetCustomDashboardRefs finds all dashboard IDs and Titles associated to this app and add them to the model
func (in *DashboardsService) GetCustomDashboardRefs(namespace, app, version string, pods []*models.Pod) []kmodel.Runtime {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "DashboardsService", "GetCustomDashboardRefs")
	defer promtimer.ObserveNow(&err)

	// A better way to do?
	var podsCast []kmodel.Pod
	for _, p := range pods {
		podsCast = append(podsCast, p)
	}
	runtimes := in.delegate.SearchExplicitDashboards(namespace, podsCast)

	if len(runtimes) == 0 {
		cfg := config.Get()
		filters := make(map[string]string)
		if app != "" {
			filters[cfg.IstioLabels.AppLabelName] = app
		}
		if version != "" {
			filters[cfg.IstioLabels.VersionLabelName] = version
		}
		runtimes = in.delegate.DiscoverDashboards(namespace, filters)
	}
	return runtimes
}
