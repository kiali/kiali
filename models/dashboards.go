package models

import (
	"fmt"
	"sort"

	"github.com/kiali/k-charted/kubernetes/v1alpha1"
	kmodel "github.com/kiali/k-charted/model"

	"github.com/kiali/kiali/status"
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
	appLabel := "app"
	verLabel := "version"
	if status.IstioSupportsCanonical() {
		appLabel = "canonical_service"
		verLabel = "canonical_revision"
	}

	aggs := []kmodel.Aggregation{
		{
			Label:       fmt.Sprintf("%s_%s", local, verLabel),
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
			Label:       fmt.Sprintf("%s_%s", remote, appLabel),
			DisplayName: "Remote app",
		},
		{
			Label:       fmt.Sprintf("%s_%s", remote, verLabel),
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
func PrepareIstioDashboard(direction, local, remote string) kmodel.MonitoringDashboard {
	return kmodel.MonitoringDashboard{
		Title:        fmt.Sprintf("%s Metrics", direction),
		Aggregations: buildIstioAggregations(local, remote),
	}
}
