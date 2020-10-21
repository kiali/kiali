package business

import "github.com/kiali/kiali/prometheus"

// IstioMetricsQuery holds query parameters for a typical metrics query
type IstioMetricsQuery struct {
	prometheus.RangeQuery
	Filters         []string
	Namespace       string
	App             string
	Workload        string
	Service         string
	Direction       string // outbound | inbound
	RequestProtocol string // e.g. http | grpc
	Reporter        string // source | destination, defaults to source if not provided
	Aggregate       string
	AggregateValue  string
}

// FillDefaults fills the struct with default parameters
func (q *IstioMetricsQuery) FillDefaults() {
	q.RangeQuery.FillDefaults()
	q.Reporter = "source"
	q.Direction = "outbound"
}

// CustomMetricsQuery holds query parameters for a custom metrics query
type CustomMetricsQuery struct {
	prometheus.RangeQuery
	Namespace         string
	App               string
	Version           string
	RawDataAggregator string
}

// FillDefaults fills the struct with default parameters
func (q *CustomMetricsQuery) FillDefaults() {
	q.RangeQuery.FillDefaults()
	q.RawDataAggregator = "sum"
}
