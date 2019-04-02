package models

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes/kiali_monitoring/v1alpha1"
)

func TestConvertAggregations(t *testing.T) {
	assert := assert.New(t)

	dashboardSpec := v1alpha1.MonitoringDashboardSpec{
		Items: []v1alpha1.MonitoringDashboardItem{
			v1alpha1.MonitoringDashboardItem{
				Chart: v1alpha1.MonitoringDashboardChart{
					Aggregations: []v1alpha1.MonitoringDashboardAggregation{
						v1alpha1.MonitoringDashboardAggregation{
							DisplayName: "Path",
							Label:       "path",
						},
						v1alpha1.MonitoringDashboardAggregation{
							DisplayName: "Error code",
							Label:       "error_code",
						},
					},
				},
			},
			v1alpha1.MonitoringDashboardItem{
				Chart: v1alpha1.MonitoringDashboardChart{
					Aggregations: []v1alpha1.MonitoringDashboardAggregation{
						v1alpha1.MonitoringDashboardAggregation{
							DisplayName: "Address",
							Label:       "address",
						},
						v1alpha1.MonitoringDashboardAggregation{
							DisplayName: "Error code",
							Label:       "error_code",
						},
					},
				},
			},
		},
	}

	converted := ConvertAggregations(dashboardSpec)

	// Results must be aggregated, unique and sorted
	assert.Len(converted, 3)
	assert.Equal(converted[0], Aggregation{DisplayName: "Address", Label: "address"})
	assert.Equal(converted[1], Aggregation{DisplayName: "Error code", Label: "error_code"})
	assert.Equal(converted[2], Aggregation{DisplayName: "Path", Label: "path"})
}

func TestPrepareIstioDashboard(t *testing.T) {
	assert := assert.New(t)

	dashboard := PrepareIstioDashboard("Outbound", "source", "destination")

	assert.Equal(dashboard.Title, "Outbound Metrics")
	assert.Len(dashboard.Aggregations, 5)
	assert.Equal(Aggregation{Label: "source_version", DisplayName: "Local version"}, dashboard.Aggregations[0])
	assert.Equal(Aggregation{Label: "destination_service_name", DisplayName: "Remote service"}, dashboard.Aggregations[1])
	assert.Equal(Aggregation{Label: "destination_app", DisplayName: "Remote app"}, dashboard.Aggregations[2])
	assert.Equal(Aggregation{Label: "destination_version", DisplayName: "Remote version"}, dashboard.Aggregations[3])
	assert.Equal(Aggregation{Label: "response_code", DisplayName: "Response code"}, dashboard.Aggregations[4])
}
