package kubernetes

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	// Counter constant for MetricType
	Counter = "counter"
	// Histogram constant for MetricType
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
	MetricType   string // MetricType is either "counter" or "histogram"
	Aggregations []MonitoringDashboardAggregation
}

type MonitoringDashboardAggregation struct {
	Label       string
	DisplayName string
}
