package models

import (
	"fmt"
	"sort"
	"strconv"
	"time"

	pmod "github.com/prometheus/common/model"

	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util"
)

//////////////////////////////////////////////////////////////////////////////
// INPUT / QUERY TYPES

// IstioMetricsQuery holds query parameters for a typical metrics query
type IstioMetricsQuery struct {
	prometheus.RangeQuery
	Aggregate       string
	AggregateValue  string
	App             string
	Cluster         string
	Direction       string // outbound | inbound
	IncludeAmbient  bool
	Filters         []string
	Namespace       string
	RequestProtocol string // e.g. http | grpc
	Reporter        string // source | destination | both, defaults to source if not provided
	Service         string
	Workload        string
}

// FillDefaults fills the struct with default parameters
func (q *IstioMetricsQuery) FillDefaults() {
	q.Direction = "outbound"
	q.IncludeAmbient = false
	q.RangeQuery.FillDefaults()
	q.Reporter = "source"
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
	Cluster   string
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

// ControlPlaneMetricsQuery holds query parameters for a control plane metrics query
type ControlPlaneMetricsQuery struct {
	prometheus.RangeQuery
}

// FillDefaults fills the struct with default parameters
func (q *ControlPlaneMetricsQuery) FillDefaults() {
	q.RangeQuery.FillDefaults()
	q.Quantiles = []string{"0.99"}
}

//////////////////////////////////////////////////////////////////////////////
// OUTPUT / QUERY RESULTS

type Metric struct {
	Labels     map[string]string `json:"labels"`
	Datapoints []Datapoint       `json:"datapoints"`
	Stat       string            `json:"stat,omitempty"`
	Name       string            `json:"name"`
}

type Datapoint struct {
	Timestamp int64
	Value     float64
}

// MetricsPerNamespace map for MetricsMap per namespace
type MetricsPerNamespace = map[string]MetricsMap

// MetricsMap contains all simple metrics and histograms data for standard timeseries queries
type MetricsMap = map[string][]Metric

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

//////////////////////////////////////////////////////////////////////////////
// MODEL CONVERSION

type ConversionParams struct {
	LabelPrefix      string
	Scale            float64
	SortLabel        string
	SortLabelParseAs string
	RemoveSortLabel  bool
}

func ConvertHistogram(name string, from prometheus.Histogram, conversionParams ConversionParams) ([]Metric, error) {
	var out []Metric
	// Extract and sort keys for consistent ordering
	stats := []string{}
	for k := range from {
		stats = append(stats, k)
	}
	sort.Strings(stats)
	for _, stat := range stats {
		promMetric := from[stat]
		if promMetric.Err != nil {
			return nil, fmt.Errorf("error in metric %s/%s: %v", name, stat, promMetric.Err)
		}
		metric := convertMatrix(promMetric.Matrix, name, stat, conversionParams)
		out = append(out, metric...)
	}
	return out, nil
}

func ConvertMetric(name string, from prometheus.Metric, conversionParams ConversionParams) ([]Metric, error) {
	if from.Err != nil {
		return nil, fmt.Errorf("error in metric %s: %v", name, from.Err)
	}
	return convertMatrix(from.Matrix, name, "", conversionParams), nil
}

func convertMatrix(from pmod.Matrix, name, stat string, conversionParams ConversionParams) []Metric {
	series := make([]Metric, len(from))
	if len(conversionParams.SortLabel) > 0 {
		sort.Slice(from, func(i, j int) bool {
			first := from[i].Metric[pmod.LabelName(conversionParams.SortLabel)]
			second := from[j].Metric[pmod.LabelName(conversionParams.SortLabel)]
			if conversionParams.SortLabelParseAs == "int" {
				// Note: in case of parsing error, 0 will be returned and used for sorting; error silently ignored.
				iFirst, _ := strconv.Atoi(string(first))
				iSecond, _ := strconv.Atoi(string(second))
				return iFirst < iSecond
			}
			return first < second
		})
	}
	for i, s := range from {
		series[i] = convertSampleStream(s, name, stat, conversionParams)
	}
	return series
}

func convertSampleStream(from *pmod.SampleStream, name, stat string, conversionParams ConversionParams) Metric {
	labelSet := make(map[string]string, len(from.Metric))
	for k, v := range from.Metric {
		if conversionParams.SortLabel == string(k) && conversionParams.RemoveSortLabel {
			// Do not keep sort label
			continue
		}
		labelSet[string(k)] = string(v)
		if conversionParams.LabelPrefix != "" {
			for i, _ := range labelSet {
				labelSet[i] = fmt.Sprintf("%s (%s)", conversionParams.LabelPrefix, v)
			}
		}
	}
	values := make([]Datapoint, len(from.Values))
	for i, v := range from.Values {
		values[i] = convertSamplePair(&v, conversionParams.Scale)
	}
	return Metric{
		Labels:     labelSet,
		Datapoints: values,
		Name:       name,
		Stat:       stat,
	}
}

// MarshalJSON implements json.Marshaler.
func (s Datapoint) MarshalJSON() ([]byte, error) {
	return pmod.SamplePair{
		Timestamp: pmod.Time(s.Timestamp),
		Value:     pmod.SampleValue(s.Value),
	}.MarshalJSON()
}

func convertSamplePair(from *pmod.SamplePair, scale float64) Datapoint {
	return Datapoint{
		Timestamp: int64(from.Timestamp),
		Value:     scale * float64(from.Value),
	}
}
