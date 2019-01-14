package kubernetes

import (
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

var kialiMonitoringGroupVersion = schema.GroupVersion{
	Group:   "monitoring.kiali.io",
	Version: "v1alpha1",
}

type MonitoringDashboard struct {
	Spec MonitoringDashboardSpec
}

type MonitoringDashboardSpec struct {
	Title  string
	Charts []MonitoringDashboardChart
}

type MonitoringDashboardChart struct {
	Name         string
	Unit         string
	Spans        int
	MetricName   string
	DataType     string // MetricType is either "raw", "rate" or "histogram"
	Aggregations []MonitoringDashboardAggregation
}

type MonitoringDashboardAggregation struct {
	Label       string
	DisplayName string
}
