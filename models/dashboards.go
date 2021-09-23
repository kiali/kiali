package models

import (
	"fmt"
	"sort"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/config/dashboards"
	"github.com/kiali/kiali/prometheus"
)

// DashboardQuery holds query parameters for a dashboard query
type DashboardQuery struct {
	prometheus.RangeQuery
	Namespace         string
	LabelsFilters     map[string]string
	AdditionalLabels  []Aggregation
	RawDataAggregator string
	Workload          string
	WorkloadType      string
}

// FillDefaults fills the struct with default parameters
func (q *DashboardQuery) FillDefaults() {
	q.RangeQuery.FillDefaults()
	q.RawDataAggregator = "sum"
}

// MonitoringDashboard is the model representing custom monitoring dashboard, transformed from MonitoringDashboard config resource
type MonitoringDashboard struct {
	Name          string         `json:"name"`
	Title         string         `json:"title"`
	Charts        []Chart        `json:"charts"`
	Aggregations  []Aggregation  `json:"aggregations"`
	ExternalLinks []ExternalLink `json:"externalLinks"`
	Rows          int            `json:"rows"`
}

// Chart is the model representing a custom chart, transformed from charts in MonitoringDashboard config resource
type Chart struct {
	Name           string   `json:"name"`
	Unit           string   `json:"unit"`
	Spans          int      `json:"spans"`
	StartCollapsed bool     `json:"startCollapsed"`
	ChartType      *string  `json:"chartType,omitempty"`
	Min            *int     `json:"min,omitempty"`
	Max            *int     `json:"max,omitempty"`
	Metrics        []Metric `json:"metrics"`
	XAxis          *string  `json:"xAxis"`
	Error          string   `json:"error"`
}

// ConvertChart converts a config chart (from MonitoringDashboard config resource) into this models chart
func ConvertChart(from dashboards.MonitoringDashboardChart) Chart {
	return Chart{
		Name:           from.Name,
		Unit:           from.Unit,
		Spans:          from.Spans,
		StartCollapsed: from.StartCollapsed,
		ChartType:      from.ChartType,
		Min:            from.Min,
		Max:            from.Max,
		Metrics:        []Metric{},
		XAxis:          from.XAxis,
	}
}

// Aggregation is the model representing label's allowed aggregation, transformed from aggregation in MonitoringDashboard config resource
type Aggregation = config.Aggregation

// ConvertAggregations converts a config aggregations (from MonitoringDashboard config resource) into this models aggregations
// Results are sorted by DisplayName
func ConvertAggregations(from dashboards.MonitoringDashboard) []Aggregation {
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
	URL       string                                              `json:"url"`
	Name      string                                              `json:"name"`
	Variables dashboards.MonitoringDashboardExternalLinkVariables `json:"variables"`
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

func buildIstioAggregations(direction string) []Aggregation {
	cfg := config.Get()

	if direction == "Inbound" {
		return cfg.KialiFeatureFlags.UIDefaults.MetricsInbound.Aggregations
	} else {
		return cfg.KialiFeatureFlags.UIDefaults.MetricsOutbound.Aggregations
	}
}

// PrepareIstioDashboard prepares the Istio dashboard title and aggregations dynamically for input values
func PrepareIstioDashboard(direction string) MonitoringDashboard {
	// Istio dashboards are predefined
	// It uses two rows by default, columns are defined using the spans of the charts
	return MonitoringDashboard{
		Title:        fmt.Sprintf("%s Metrics", direction),
		Aggregations: buildIstioAggregations(direction),
		Charts:       []Chart{},
		Rows:         3, // Rows layout used for Inbound Metrics and Outbound Metrics
	}
}

func GetDashboardAnnotation(annotations map[string]string) map[string]string {
	filtered := make(map[string]string)
	// Parse only annotations used by Kiali
	if da, ok := annotations[dashboards.DashboardTemplateAnnotation]; ok {
		filtered[dashboards.DashboardTemplateAnnotation] = da
	}
	return filtered
}
