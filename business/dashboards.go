package business

import (
	"math"

	kbus "github.com/kiali/k-charted/business"
	kconf "github.com/kiali/k-charted/config"
	kxconf "github.com/kiali/k-charted/config/extconfig"
	klog "github.com/kiali/k-charted/log"
	kmodel "github.com/kiali/k-charted/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/status"
)

// DashboardsService deals with fetching dashboards from k8s client
type DashboardsService struct {
	delegate kbus.DashboardsService
	prom     prometheus.ClientInterface
}

// NewDashboardsService initializes this business service
func NewDashboardsService(prom prometheus.ClientInterface) DashboardsService {
	delegate := kbus.NewDashboardsService(DashboardsConfig())
	return DashboardsService{delegate: delegate, prom: prom}
}

func DashboardsConfig() (kconf.Config, klog.LogAdapter) {
	cfg := config.Get()
	pauth := cfg.ExternalServices.Prometheus.Auth
	gauth := cfg.ExternalServices.Grafana.Auth
	if pauth.UseKialiToken || (cfg.ExternalServices.Grafana.Enabled && gauth.UseKialiToken) {
		kialiToken, err := kubernetes.GetKialiToken()
		if err != nil {
			log.Errorf("Could not read the Kiali Service Account token: %v", err)
		}
		if pauth.UseKialiToken {
			pauth.Token = kialiToken
		}
		if gauth.UseKialiToken {
			gauth.Token = kialiToken
		}
	}
	var grafanaConfig kxconf.GrafanaConfig
	if cfg.ExternalServices.Grafana.Enabled {
		grafanaConfig = kxconf.GrafanaConfig{
			URL:          status.DiscoverGrafana(),
			InClusterURL: cfg.ExternalServices.Grafana.InClusterURL,
			Auth: kxconf.Auth{
				Type:               gauth.Type,
				Username:           gauth.Username,
				Password:           gauth.Password,
				Token:              gauth.Token,
				InsecureSkipVerify: gauth.InsecureSkipVerify,
				CAFile:             gauth.CAFile,
			},
		}
	}
	return kconf.Config{
			GlobalNamespace: cfg.Deployment.Namespace,
			Prometheus: kxconf.PrometheusConfig{
				URL: cfg.ExternalServices.Prometheus.CustomMetricsURL,
				Auth: kxconf.Auth{
					Type:               pauth.Type,
					Username:           pauth.Username,
					Password:           pauth.Password,
					Token:              pauth.Token,
					InsecureSkipVerify: pauth.InsecureSkipVerify,
					CAFile:             pauth.CAFile,
				},
			},
			Grafana: grafanaConfig,
		}, klog.LogAdapter{
			Errorf:   log.Errorf,
			Warningf: log.Warningf,
			Infof:    log.Warningf,
			Tracef:   log.Warningf,
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
	// TODO: Istio is transitioning from duration in seconds to duration in ms (a new metric). When
	//       complete we should reduce the next two entries to just one entry.
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
			Name:  "Request duration",
			Unit:  "ms",
			Spans: 6,
		},
		refName: "request_duration_millis",
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

	// TODO: remove this hacky code when Istio finishes migrating to the millis duration metric,
	//       until then use the one that has data, preferring millis in the corner case that
	//       both have data for the time range.
	_, secondsOK := metrics.Histograms["request_duration"]
	durationMillis, millisOK := metrics.Histograms["request_duration_millis"]
	if secondsOK && millisOK {
		durationMillisEmpty := true
	MillisEmpty:
		for _, samples := range models.ConvertHistogram(durationMillis) {
			for _, sample := range samples {
				for _, pair := range sample.Values {
					if !math.IsNaN(pair.Value) {
						durationMillisEmpty = false
						break MillisEmpty
					}
				}
			}
		}
		if !durationMillisEmpty {
			delete(metrics.Histograms, "request_duration")
		} else {
			delete(metrics.Histograms, "request_duration_millis")
		}
	}

	for _, chartTpl := range istioCharts {
		newChart := chartTpl.Chart
		if metric, ok := metrics.Metrics[chartTpl.refName]; ok {
			newChart.Metric = models.ConvertMatrix(metric.Matrix)
		}
		if histo, ok := metrics.Histograms[chartTpl.refName]; ok {
			newChart.Histogram = models.ConvertHistogram(histo)
		}
		if newChart.Metric != nil || newChart.Histogram != nil {
			dashboard.Charts = append(dashboard.Charts, newChart)
		}
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
