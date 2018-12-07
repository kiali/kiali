package models

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
)

func TestConvertAggregations(t *testing.T) {
	assert := assert.New(t)

	dashboardSpec := kubernetes.MonitoringDashboardSpec{
		Charts: []kubernetes.MonitoringDashboardChart{
			kubernetes.MonitoringDashboardChart{
				Aggregations: []kubernetes.MonitoringDashboardAggregation{
					kubernetes.MonitoringDashboardAggregation{
						DisplayName: "Path",
						Label:       "path",
					},
					kubernetes.MonitoringDashboardAggregation{
						DisplayName: "Error code",
						Label:       "error_code",
					},
				},
			},
			kubernetes.MonitoringDashboardChart{
				Aggregations: []kubernetes.MonitoringDashboardAggregation{
					kubernetes.MonitoringDashboardAggregation{
						DisplayName: "Address",
						Label:       "address",
					},
					kubernetes.MonitoringDashboardAggregation{
						DisplayName: "Error code",
						Label:       "error_code",
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
	assert.Len(dashboard.Aggregations, 4)
	assert.Equal(Aggregation{Label: "source_version", DisplayName: "Local version"}, dashboard.Aggregations[0])
	assert.Equal(Aggregation{Label: "destination_app", DisplayName: "Remote app"}, dashboard.Aggregations[1])
	assert.Equal(Aggregation{Label: "destination_version", DisplayName: "Remote version"}, dashboard.Aggregations[2])
	assert.Equal(Aggregation{Label: "response_code", DisplayName: "Response code"}, dashboard.Aggregations[3])
}
