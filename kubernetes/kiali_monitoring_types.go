package kubernetes

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
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
	Name       string
	Unit       string
	Spans      int
	MetricName string
	// MetricType is either "counter" or "histogram"
	MetricType   string
	Aggregations []MonitoringDashboardAggregation
}

type MonitoringDashboardAggregation struct {
	Label       string
	DisplayName string
}
