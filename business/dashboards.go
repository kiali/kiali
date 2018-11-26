package business

import (
	"fmt"
	"strings"
	"sync"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

// DashboardsService deals with fetching dashboards from k8s client
type DashboardsService struct {
	prom prometheus.ClientInterface
	mon  *kubernetes.KialiMonitoringClient
}

// NewDashboardsService initializes this business service
func NewDashboardsService(mon *kubernetes.KialiMonitoringClient, prom prometheus.ClientInterface) DashboardsService {
	return DashboardsService{prom: prom, mon: mon}
}

// GetDashboard returns a dashboard filled-in with target data
func (in *DashboardsService) GetDashboard(params prometheus.CustomMetricsQuery, template string) (*models.MonitoringDashboard, error) {
	dashboard, err := in.mon.GetDashboard(params.Namespace, template)
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
			if chart.MetricType == "counter" {
				filledCharts[idx].CounterRate = in.prom.FetchRateRange(chart.MetricName, labels, grouping, &params.BaseMetricsQuery)
			} else {
				filledCharts[idx].Histogram = in.prom.FetchHistogramRange(chart.MetricName, labels, grouping, &params.BaseMetricsQuery)
			}
		}(i, c)
	}

	wg.Wait()
	return &models.MonitoringDashboard{
		Title:  dashboard.Spec.Title,
		Charts: filledCharts,
	}, nil
}
