package models

import (
	"fmt"
	"sort"
	"strconv"

	pmod "github.com/prometheus/common/model"

	"github.com/kiali/kiali/kubernetes/monitoringdashboards/v1alpha1"
	"github.com/kiali/kiali/prometheus"
)

const (
	statLabel = "__stat__"
	nameLabel = "__name__"
)

// DashboardQuery holds query parameters for a dashboard query
type DashboardQuery struct {
	prometheus.RangeQuery
	Namespace         string
	LabelsFilters     map[string]string
	AdditionalLabels  []Aggregation
	RawDataAggregator string
}

// FillDefaults fills the struct with default parameters
func (q *DashboardQuery) FillDefaults() {
	q.RangeQuery.FillDefaults()
	q.RawDataAggregator = "sum"
}

// MonitoringDashboard is the model representing custom monitoring dashboard, transformed from MonitoringDashboard k8s resource
type MonitoringDashboard struct {
	Title         string         `json:"title"`
	Charts        []Chart        `json:"charts"`
	Aggregations  []Aggregation  `json:"aggregations"`
	ExternalLinks []ExternalLink `json:"externalLinks"`
}

// Chart is the model representing a custom chart, transformed from charts in MonitoringDashboard k8s resource
type Chart struct {
	Name           string          `json:"name"`
	Unit           string          `json:"unit"`
	Spans          int             `json:"spans"`
	StartCollapsed bool            `json:"startCollapsed"`
	ChartType      *string         `json:"chartType,omitempty"`
	Min            *int            `json:"min,omitempty"`
	Max            *int            `json:"max,omitempty"`
	Metrics        []*SampleStream `json:"metrics"`
	XAxis          *string         `json:"xAxis"`
	Error          string          `json:"error"`
}

type ConversionParams struct {
	Scale            float64
	SortLabel        string
	SortLabelParseAs string
	RemoveSortLabel  bool
}

// BuildLabelsMap initiates a labels map out of a given metric name and optionally histogram stat
// Exported for external usage (Kiali)
func BuildLabelsMap(name, stat string) map[string]string {
	labels := map[string]string{
		nameLabel: name,
	}
	if stat != "" {
		labels[statLabel] = stat
	}
	return labels
}

func (chart *Chart) FillHistogram(name, displayName string, from prometheus.Histogram, conversionParams ConversionParams) {
	// Extract and sort keys for consistent ordering
	stats := []string{}
	for k := range from {
		stats = append(stats, k)
	}
	sort.Strings(stats)
	for _, stat := range stats {
		promMetric := from[stat]
		if promMetric.Err != nil {
			chart.Error = fmt.Sprintf("error in metric %s/%s: %v", name, stat, promMetric.Err)
			return
		}
		metric := ConvertMatrix(promMetric.Matrix, BuildLabelsMap(displayName, stat), conversionParams)
		chart.Metrics = append(chart.Metrics, metric...)
	}
}

func (chart *Chart) FillMetric(name, displayName string, from prometheus.Metric, conversionParams ConversionParams) {
	if from.Err != nil {
		chart.Error = fmt.Sprintf("error in metric %s: %v", name, from.Err)
		return
	}
	metric := ConvertMatrix(from.Matrix, BuildLabelsMap(displayName, ""), conversionParams)
	chart.Metrics = append(chart.Metrics, metric...)
}

func ConvertMatrix(from pmod.Matrix, initialLabels map[string]string, conversionParams ConversionParams) []*SampleStream {
	series := make([]*SampleStream, len(from))
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
		series[i] = convertSampleStream(s, initialLabels, conversionParams)
	}
	return series
}

type SampleStream struct {
	LabelSet map[string]string `json:"labelSet"`
	Values   []SamplePair      `json:"values"`
}

func convertSampleStream(from *pmod.SampleStream, initialLabels map[string]string, conversionParams ConversionParams) *SampleStream {
	labelSet := make(map[string]string, len(from.Metric)+len(initialLabels))
	for k, v := range initialLabels {
		labelSet[k] = v
	}
	for k, v := range from.Metric {
		if conversionParams.SortLabel == string(k) && conversionParams.RemoveSortLabel {
			// Do not keep sort label
			continue
		}
		labelSet[string(k)] = string(v)
	}
	values := make([]SamplePair, len(from.Values))
	for i, v := range from.Values {
		values[i] = convertSamplePair(&v, conversionParams.Scale)
	}
	return &SampleStream{
		LabelSet: labelSet,
		Values:   values,
	}
}

type SamplePair struct {
	Timestamp int64
	Value     float64
}

// MarshalJSON implements json.Marshaler.
func (s SamplePair) MarshalJSON() ([]byte, error) {
	return pmod.SamplePair{
		Timestamp: pmod.Time(s.Timestamp),
		Value:     pmod.SampleValue(s.Value),
	}.MarshalJSON()
}

func convertSamplePair(from *pmod.SamplePair, scale float64) SamplePair {
	return SamplePair{
		Timestamp: int64(from.Timestamp),
		Value:     scale * float64(from.Value),
	}
}

// ConvertChart converts a k8s chart (from MonitoringDashboard k8s resource) into this models chart
func ConvertChart(from v1alpha1.MonitoringDashboardChart) Chart {
	return Chart{
		Name:           from.Name,
		Unit:           from.Unit,
		Spans:          from.Spans,
		StartCollapsed: from.StartCollapsed,
		ChartType:      from.ChartType,
		Min:            from.Min,
		Max:            from.Max,
		Metrics:        []*SampleStream{},
		XAxis:          from.XAxis,
	}
}

// Aggregation is the model representing label's allowed aggregation, transformed from aggregation in MonitoringDashboard k8s resource
type Aggregation struct {
	Label           string `json:"label"`
	DisplayName     string `json:"displayName"`
	SingleSelection bool   `json:"singleSelection"`
}

// ConvertAggregations converts a k8s aggregations (from MonitoringDashboard k8s resource) into this models aggregations
// Results are sorted by DisplayName
func ConvertAggregations(from v1alpha1.MonitoringDashboardSpec) []Aggregation {
	uniqueAggs := make(map[string]Aggregation)
	for _, item := range from.Items {
		for _, agg := range item.Chart.Aggregations {
			uniqueAggs[agg.DisplayName] = Aggregation{Label: agg.Label, DisplayName: agg.DisplayName, SingleSelection: agg.SingleSelection}
		}
	}
	aggs := []Aggregation{}
	for _, agg := range uniqueAggs {
		aggs = append(aggs, agg)
	}
	sort.Slice(aggs, func(i, j int) bool {
		return aggs[i].DisplayName < aggs[j].DisplayName
	})
	return aggs
}

// ExternalLink provides links to external dashboards (e.g. to Grafana)
type ExternalLink struct {
	URL       string                                            `json:"url"`
	Name      string                                            `json:"name"`
	Variables v1alpha1.MonitoringDashboardExternalLinkVariables `json:"variables"`
}

// Runtime holds the runtime title and associated dashboard template(s)
type Runtime struct {
	Name          string         `json:"name"`
	DashboardRefs []DashboardRef `json:"dashboardRefs"`
}

// DashboardRef holds template name and title for a custom dashboard
type DashboardRef struct {
	Template string `json:"template"`
	Title    string `json:"title"`
}

func buildIstioAggregations(local, remote string) []Aggregation {
	aggs := []Aggregation{
		{
			Label:       fmt.Sprintf("%s_canonical_revision", local),
			DisplayName: "Local version",
		},
	}
	if remote == "destination" {
		aggs = append(aggs, Aggregation{
			Label:       "destination_service_name",
			DisplayName: "Remote service",
		})
	}
	aggs = append(aggs, []Aggregation{
		{
			Label:       fmt.Sprintf("%s_canonical_service", remote),
			DisplayName: "Remote app",
		},
		{
			Label:       fmt.Sprintf("%s_canonical_revision", remote),
			DisplayName: "Remote version",
		},
		{
			Label:       "response_code",
			DisplayName: "Response code",
		},
		{
			Label:       "grpc_response_status",
			DisplayName: "GRPC status",
		},
		{
			Label:       "response_flags",
			DisplayName: "Response flags",
		},
	}...)
	return aggs
}

// PrepareIstioDashboard prepares the Istio dashboard title and aggregations dynamically for input values
func PrepareIstioDashboard(direction, local, remote string) MonitoringDashboard {
	return MonitoringDashboard{
		Title:        fmt.Sprintf("%s Metrics", direction),
		Aggregations: buildIstioAggregations(local, remote),
		Charts:       []Chart{},
	}
}
