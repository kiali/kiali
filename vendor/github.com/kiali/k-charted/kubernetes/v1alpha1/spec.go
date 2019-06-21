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
	Title      string                    `json:"title"`
	Runtime    string                    `json:"runtime"`
	DiscoverOn string                    `json:"discoverOn"`
	Items      []MonitoringDashboardItem `json:"items"`
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
	Name         string                           `json:"name"`
	Unit         string                           `json:"unit"`
	Spans        int                              `json:"spans"`
	MetricName   string                           `json:"metricName"`
	DataType     string                           `json:"dataType"`   // DataType is either "raw", "rate" or "histogram"
	Aggregator   string                           `json:"aggregator"` // Aggregator can be set for raw data. Ex: "sum", "avg". See https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators
	Aggregations []MonitoringDashboardAggregation `json:"aggregations"`
}

type MonitoringDashboardAggregation struct {
	Label       string `json:"label"`
	DisplayName string `json:"displayName"`
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
