package model

import (
	"sort"

	pmod "github.com/prometheus/common/model"

	"github.com/kiali/k-charted/kubernetes/v1alpha1"
)

// MonitoringDashboard is the model representing custom monitoring dashboard, transformed from MonitoringDashboard k8s resource
type MonitoringDashboard struct {
	Title        string        `json:"title"`
	Charts       []Chart       `json:"charts"`
	Aggregations []Aggregation `json:"aggregations"`
}

// Chart is the model representing a custom chart, transformed from charts in MonitoringDashboard k8s resource
type Chart struct {
	Name      string                     `json:"name"`
	Unit      string                     `json:"unit"`
	Spans     int                        `json:"spans"`
	Metric    []*SampleStream            `json:"metric"`
	Histogram map[string][]*SampleStream `json:"histogram"`
	Error     string                     `json:"error"`
}

func ConvertMatrix(from pmod.Matrix) []*SampleStream {
	series := make([]*SampleStream, len(from))
	for i, s := range from {
		series[i] = convertSampleStream(s)
	}
	return series
}

type SampleStream struct {
	LabelSet map[string]string `json:"labelSet"`
	Values   []SamplePair      `json:"values"`
}

func convertSampleStream(from *pmod.SampleStream) *SampleStream {
	labelSet := make(map[string]string, len(from.Metric))
	for k, v := range from.Metric {
		labelSet[string(k)] = string(v)
	}
	values := make([]SamplePair, len(from.Values))
	for i, v := range from.Values {
		values[i] = convertSamplePair(&v)
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

func convertSamplePair(from *pmod.SamplePair) SamplePair {
	return SamplePair{
		Timestamp: int64(from.Timestamp),
		Value:     float64(from.Value),
	}
}

// ConvertChart converts a k8s chart (from MonitoringDashboard k8s resource) into this models chart
func ConvertChart(from v1alpha1.MonitoringDashboardChart) Chart {
	return Chart{
		Name:  from.Name,
		Unit:  from.Unit,
		Spans: from.Spans,
	}
}

// Aggregation is the model representing label's allowed aggregation, transformed from aggregation in MonitoringDashboard k8s resource
type Aggregation struct {
	Label       string `json:"label"`
	DisplayName string `json:"displayName"`
}

// ConvertAggregations converts a k8s aggregations (from MonitoringDashboard k8s resource) into this models aggregations
// Results are sorted by DisplayName
func ConvertAggregations(from v1alpha1.MonitoringDashboardSpec) []Aggregation {
	uniqueAggs := make(map[string]Aggregation)
	for _, item := range from.Items {
		for _, agg := range item.Chart.Aggregations {
			uniqueAggs[agg.DisplayName] = Aggregation{Label: agg.Label, DisplayName: agg.DisplayName}
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
