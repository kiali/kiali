package mock

import (
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/kubernetes/monitoringdashboards/v1alpha1"
)

type ClientMock struct {
	mock.Mock
}

func (o *ClientMock) GetDashboard(namespace string, name string) (*v1alpha1.MonitoringDashboard, error) {
	args := o.Called(namespace, name)
	if args.Error(1) != nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1alpha1.MonitoringDashboard), nil
}

func (o *ClientMock) GetDashboards(namespace string) ([]v1alpha1.MonitoringDashboard, error) {
	args := o.Called(namespace)
	if args.Error(1) != nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]v1alpha1.MonitoringDashboard), nil
}

func FakeChart(id, dataType string) v1alpha1.MonitoringDashboardChart {
	return v1alpha1.MonitoringDashboardChart{
		Name:      "My chart " + id,
		Unit:      "s",
		UnitScale: 10.0,
		Spans:     6,
		Metrics:   []v1alpha1.MonitoringDashboardMetric{{DisplayName: "My chart " + id, MetricName: "my_metric_" + id}},
		DataType:  dataType,
		Aggregations: []v1alpha1.MonitoringDashboardAggregation{
			v1alpha1.MonitoringDashboardAggregation{
				DisplayName: "Agg " + id,
				Label:       "agg_" + id,
			},
		},
	}
}
