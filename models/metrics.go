package models

import (
	"fmt"
	"time"

	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util"
)

//////////////////////////////////////////////////////////////////////////////
// INPUT / QUERY TYPES

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

type MetricsStatsQueries struct {
	Queries []MetricsStatsQuery
}

type Target struct {
	Namespace string
	Name      string
	Kind      string // app | workload | service
}

type MetricsStatsQuery struct {
	Target       Target
	PeerTarget   *Target
	RawQueryTime int64     `json:"queryTime"`
	QueryTime    time.Time `json:"-"`
	RawInterval  string    `json:"interval"`
	Interval     string    `json:"-"`
	Direction    string    // outbound | inbound
	Avg          bool
	Quantiles    []string
}

func (q *MetricsStatsQuery) Validate() *util.Errors {
	var errs util.Errors
	if q.Target.Name == "" {
		errs.AddString("bad request: 'target.name' must be defined")
	}
	if q.Target.Kind != "app" && q.Target.Kind != "workload" && q.Target.Kind != "service" {
		errs.AddString("bad request: 'target.kind' must be either 'app', 'workload' or 'service'")
	}
	if q.Target.Kind == "service" && q.Direction != "inbound" {
		errs.AddString("bad request: only 'inbound' direction is allowed for kind 'service'")
	}
	if q.Direction != "inbound" && q.Direction != "outbound" {
		errs.AddString("bad request: 'direction' must be either 'inbound' or 'outbound'")
	}
	if q.RawQueryTime == 0 {
		errs.AddString("bad request: 'queryTime' must be defined")
	}
	if q.RawInterval == "" {
		errs.AddString("bad request: 'interval' must be defined")
	}
	q.QueryTime = time.Unix(q.RawQueryTime, 0)
	return errs.OrNil()
}

// GenKey !! HAS to mirror frontend's genStatsKey in SpanTable.tsx
func (q *MetricsStatsQuery) GenKey() string {
	peer := ""
	if q.PeerTarget != nil {
		peer = q.PeerTarget.GenKey()
	}
	return fmt.Sprintf("%s:%s:%s:%s", q.Target.GenKey(), peer, q.Direction, q.RawInterval)
}
func (t *Target) GenKey() string {
	return fmt.Sprintf("%s:%s:%s", t.Namespace, t.Kind, t.Name)
}

//////////////////////////////////////////////////////////////////////////////
// OUTPUT / QUERY RESULTS

// Metrics contains all simple metrics and histograms data for standard timeseries queries
type Metrics struct {
	Metrics    map[string]prometheus.Metric    `json:"metrics"`
	Histograms map[string]prometheus.Histogram `json:"histograms"`
}

// Stat holds arbitrary stat name & value
type Stat struct {
	Name  string  `json:"name"` // E.g. avg, p99, etc.
	Value float64 `json:"value"`
}

// MetricsStats contains opinionated statistics on metrics on a single target. Currently limited to response times (avg/percentiles over interval)
type MetricsStats struct {
	ResponseTimes []Stat `json:"responseTimes"`
}

// MetricsStatsResult holds the MetricsStats per target, plus errors
type MetricsStatsResult struct {
	Stats    map[string]MetricsStats `json:"stats"` // Key is built from query params, see "GenKey" above. The same key needs to be generated client-side for matching.
	Warnings []string                `json:"warnings"`
}
