package v1alpha1

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	// Raw constant for DataType
	Raw = "raw"
	// Rate constant for DataType
	Rate = "rate"
	// Histogram constant for DataType
	Histogram = "histogram"
)

var GroupVersion = schema.GroupVersion{
	Group:   "monitoring.kiali.io",
	Version: "v1alpha1",
}

type MonitoringDashboard struct {
	meta_v1.TypeMeta   `json:",inline"`
	meta_v1.ObjectMeta `json:"metadata"`
	Spec               MonitoringDashboardSpec `json:"spec"`
}

type MonitoringDashboardsList struct {
	meta_v1.TypeMeta `json:",inline"`
	meta_v1.ListMeta `json:"metadata"`
	Items            []MonitoringDashboard `json:"items"`
}

type MonitoringDashboardSpec struct {
	Title         string                            `json:"title"`
	Runtime       string                            `json:"runtime"`
	DiscoverOn    string                            `json:"discoverOn"`
	Items         []MonitoringDashboardItem         `json:"items"`
	ExternalLinks []MonitoringDashboardExternalLink `json:"externalLinks"`
}

type MonitoringDashboardItem struct {
	// Items are exclusive: either Include or Chart must be set (if both are set, Chart will be ignored)
	// Include is a reference to another dashboard and/or chart
	// Ex: "microprofile-1.0" will include the whole dashboard named "microprofile-1.0" at this position
	//		 "microprofile-1.0$Thread count" will include only the chart named "Thread count" from that dashboard at this position
	Include string                   `json:"include"`
	Chart   MonitoringDashboardChart `json:"chart"`
}

type MonitoringDashboardChart struct {
	Name             string                           `json:"name"`
	Unit             string                           `json:"unit"`      // Stands for the base unit (regardless its scale in datasource)
	UnitScale        float64                          `json:"unitScale"` // Stands for the scale of the values in datasource, related to the base unit provided. E.g. unit: "seconds" and unitScale: 0.001 means that values in datasource are actually in milliseconds.
	Spans            int                              `json:"spans"`
	StartCollapsed   bool                             `json:"startCollapsed"`
	ChartType        *string                          `json:"chartType"`
	Min              *int                             `json:"min"`
	Max              *int                             `json:"max"`
	MetricName       string                           `json:"metricName"` // Deprecated; use Metrics instead
	Metrics          []MonitoringDashboardMetric      `json:"metrics"`
	DataType         string                           `json:"dataType"`   // DataType is either "raw", "rate" or "histogram"
	Aggregator       string                           `json:"aggregator"` // Aggregator can be set for raw data. Ex: "sum", "avg". See https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators
	Aggregations     []MonitoringDashboardAggregation `json:"aggregations"`
	XAxis            *string                          `json:"xAxis"`            // "time" (default) or "series"
	GroupLabels      []string                         `json:"groupLabels"`      // Prometheus label to be used for grouping; Similar to Aggregations, except this grouping will be always turned on
	SortLabel        string                           `json:"sortLabel"`        // Prometheus label to be used for sorting
	SortLabelParseAs string                           `json:"sortLabelParseAs"` // Set "int" if the SortLabel needs to be parsed and compared as an integer
}

type MonitoringDashboardMetric struct {
	MetricName  string `json:"metricName"`
	DisplayName string `json:"displayName"`
}

type MonitoringDashboardAggregation struct {
	Label           string `json:"label"`
	DisplayName     string `json:"displayName"`
	SingleSelection bool   `json:"singleSelection"`
}

type MonitoringDashboardExternalLink struct {
	Type      string                                   `json:"type"`
	Name      string                                   `json:"name"`
	Variables MonitoringDashboardExternalLinkVariables `json:"variables"`
}

type MonitoringDashboardExternalLinkVariables struct {
	Namespace string `json:"namespace,omitempty"`
	App       string `json:"app,omitempty"`
	Service   string `json:"service,omitempty"`
	Version   string `json:"version,omitempty"`
	Workload  string `json:"workload,omitempty"`
}

// GetMetrics provides consistent MonitoringDashboardMetric slice in a backward-compatible way, if deprecated field MetricName is used instead of Metrics in Spec.
func (in *MonitoringDashboardChart) GetMetrics() []MonitoringDashboardMetric {
	if len(in.Metrics) == 0 {
		return []MonitoringDashboardMetric{
			{
				MetricName:  in.MetricName,
				DisplayName: in.Name,
			},
		}
	}
	return in.Metrics
}

// TODO: auto-generate the following deepcopy methods!

func (in *MonitoringDashboard) DeepCopyInto(out *MonitoringDashboard) {
	*out = *in
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	out.Spec = in.Spec
}

func (in *MonitoringDashboard) DeepCopy() *MonitoringDashboard {
	if in == nil {
		return nil
	}
	out := new(MonitoringDashboard)
	in.DeepCopyInto(out)
	return out
}

func (in *MonitoringDashboard) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

func (in *MonitoringDashboardsList) DeepCopyInto(out *MonitoringDashboardsList) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	out.ListMeta = in.ListMeta
	if in.Items != nil {
		in, out := &in.Items, &out.Items
		*out = make([]MonitoringDashboard, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
}

func (in *MonitoringDashboardsList) DeepCopy() *MonitoringDashboardsList {
	if in == nil {
		return nil
	}
	out := new(MonitoringDashboardsList)
	in.DeepCopyInto(out)
	return out
}

func (in *MonitoringDashboardsList) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}
