package models

import (
	"fmt"
	"sort"

	"github.com/kiali/k-charted/kubernetes/v1alpha1"
	kmodel "github.com/kiali/k-charted/model"
	pmod "github.com/prometheus/common/model"

	"github.com/kiali/kiali/prometheus"
)

// ConvertAggregations converts a k8s aggregations (from MonitoringDashboard k8s resource) into this models aggregations
// Results are sorted by DisplayName
func ConvertAggregations(from v1alpha1.MonitoringDashboardSpec) []kmodel.Aggregation {
	uniqueAggs := make(map[string]kmodel.Aggregation)
	for _, item := range from.Items {
		for _, agg := range item.Chart.Aggregations {
			uniqueAggs[agg.DisplayName] = kmodel.Aggregation{Label: agg.Label, DisplayName: agg.DisplayName}
		}
	}
	aggs := []kmodel.Aggregation{}
	for _, agg := range uniqueAggs {
		aggs = append(aggs, agg)
	}
	sort.Slice(aggs, func(i, j int) bool {
		return aggs[i].DisplayName < aggs[j].DisplayName
	})
	return aggs
}

func buildIstioAggregations(local, remote string) []kmodel.Aggregation {
	aggs := []kmodel.Aggregation{
		{
			Label:       fmt.Sprintf("%s_version", local),
			DisplayName: "Local version",
		},
	}
	if remote == "destination" {
		aggs = append(aggs, kmodel.Aggregation{
			Label:       "destination_service_name",
			DisplayName: "Remote service",
		})
	}
	aggs = append(aggs, []kmodel.Aggregation{
		{
			Label:       fmt.Sprintf("%s_app", remote),
			DisplayName: "Remote app",
		},
		{
			Label:       fmt.Sprintf("%s_version", remote),
			DisplayName: "Remote version",
		},
		{
			Label:       "response_code",
			DisplayName: "Response code",
		},
	}...)
	return aggs
}

// PrepareIstioDashboard prepares the Istio dashboard title and aggregations dynamically for input values
func PrepareIstioDashboard(direction, local, remote string) kmodel.MonitoringDashboard {
	return kmodel.MonitoringDashboard{
		Title:        fmt.Sprintf("%s Metrics", direction),
		Aggregations: buildIstioAggregations(local, remote),
	}
}

// PROMETHEUS MODEL CONVERSION FUNCTIONS

func ConvertHistogram(from prometheus.Histogram) map[string][]*kmodel.SampleStream {
	stats := make(map[string][]*kmodel.SampleStream, len(from))
	for k, v := range from {
		stats[k] = ConvertMatrix(v.Matrix)
	}
	return stats
}

func ConvertMatrix(from pmod.Matrix) []*kmodel.SampleStream {
	series := make([]*kmodel.SampleStream, len(from))
	for i, s := range from {
		series[i] = convertSampleStream(s)
	}
	return series
}

func convertSampleStream(from *pmod.SampleStream) *kmodel.SampleStream {
	labelSet := make(map[string]string, len(from.Metric))
	for k, v := range from.Metric {
		labelSet[string(k)] = string(v)
	}
	values := make([]kmodel.SamplePair, len(from.Values))
	for i, v := range from.Values {
		values[i] = convertSamplePair(&v)
	}
	return &kmodel.SampleStream{
		LabelSet: labelSet,
		Values:   values,
	}
}

func convertSamplePair(from *pmod.SamplePair) kmodel.SamplePair {
	return kmodel.SamplePair{
		Timestamp: int64(from.Timestamp),
		Value:     float64(from.Value),
	}
}
