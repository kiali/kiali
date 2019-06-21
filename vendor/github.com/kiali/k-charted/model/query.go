package model

import (
	"github.com/kiali/k-charted/prometheus"
)

// DashboardQuery holds query parameters for a dashboard query
type DashboardQuery struct {
	prometheus.MetricsQuery
	Namespace         string
	LabelsFilters     map[string]string
	AdditionalLabels  []Aggregation
	RawDataAggregator string
}

// FillDefaults fills the struct with default parameters
func (q *DashboardQuery) FillDefaults() {
	q.MetricsQuery.FillDefaults()
	q.RawDataAggregator = "sum"
}
