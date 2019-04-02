package mock

import (
	"github.com/kiali/kiali/kubernetes/kiali_monitoring/v1alpha1"
)

func FakeChart(id, dataType string) v1alpha1.MonitoringDashboardChart {
	return v1alpha1.MonitoringDashboardChart{
		Name:       "My chart " + id,
		Unit:       "s",
		Spans:      6,
		MetricName: "my_metric_" + id,
		DataType:   dataType,
		Aggregations: []v1alpha1.MonitoringDashboardAggregation{
			v1alpha1.MonitoringDashboardAggregation{
				DisplayName: "Agg " + id,
				Label:       "agg_" + id,
			},
		},
	}
}
