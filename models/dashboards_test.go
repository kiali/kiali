package models

import (
	"testing"

	"github.com/kiali/k-charted/model"
	"github.com/stretchr/testify/assert"
)

func TestPrepareIstioDashboard(t *testing.T) {
	assert := assert.New(t)

	dashboard := PrepareIstioDashboard("Outbound", "source", "destination")

	assert.Equal(dashboard.Title, "Outbound Metrics")
	assert.Len(dashboard.Aggregations, 7)
	assert.Equal(model.Aggregation{Label: "source_canonical_revision", DisplayName: "Local version"}, dashboard.Aggregations[0])
	assert.Equal(model.Aggregation{Label: "destination_service_name", DisplayName: "Remote service"}, dashboard.Aggregations[1])
	assert.Equal(model.Aggregation{Label: "destination_canonical_service", DisplayName: "Remote app"}, dashboard.Aggregations[2])
	assert.Equal(model.Aggregation{Label: "destination_canonical_revision", DisplayName: "Remote version"}, dashboard.Aggregations[3])
	assert.Equal(model.Aggregation{Label: "response_code", DisplayName: "Response code"}, dashboard.Aggregations[4])
	assert.Equal(model.Aggregation{Label: "grpc_response_status", DisplayName: "GRPC status"}, dashboard.Aggregations[5])
	assert.Equal(model.Aggregation{Label: "response_flags", DisplayName: "Response flags"}, dashboard.Aggregations[6])
}
