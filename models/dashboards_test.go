package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPrepareIstioDashboard(t *testing.T) {
	assert := assert.New(t)

	dashboard := PrepareIstioDashboard("Outbound", "source", "destination")

	assert.Equal(dashboard.Title, "Outbound Metrics")
	assert.Len(dashboard.Aggregations, 8)
	assert.Equal(Aggregation{Label: "source_canonical_revision", DisplayName: "Local version"}, dashboard.Aggregations[0])
	assert.Equal(Aggregation{Label: "destination_workload_namespace", DisplayName: "Remote namespace"}, dashboard.Aggregations[1])
	assert.Equal(Aggregation{Label: "destination_service_name", DisplayName: "Remote service"}, dashboard.Aggregations[2])
	assert.Equal(Aggregation{Label: "destination_canonical_service", DisplayName: "Remote app"}, dashboard.Aggregations[3])
	assert.Equal(Aggregation{Label: "destination_canonical_revision", DisplayName: "Remote version"}, dashboard.Aggregations[4])
	assert.Equal(Aggregation{Label: "response_code", DisplayName: "Response code"}, dashboard.Aggregations[5])
	assert.Equal(Aggregation{Label: "grpc_response_status", DisplayName: "GRPC status"}, dashboard.Aggregations[6])
	assert.Equal(Aggregation{Label: "response_flags", DisplayName: "Response flags"}, dashboard.Aggregations[7])
}
