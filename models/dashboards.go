package models

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
)

type MonitoringDashboard struct {
	Title  string  `json:"title"`
	Charts []Chart `json:"charts"`
}

type Chart struct {
	Name         string               `json:"name"`
	Unit         string               `json:"unit"`
	Spans        int                  `json:"spans"`
	CounterRate  *prometheus.Metric   `json:"counterRate"`
	Histogram    prometheus.Histogram `json:"histogram"`
	Aggregations []Aggregation        `json:"aggregations"`
}

type Aggregation struct {
	Label       string `json:"label"`
	DisplayName string `json:"displayName"`
}

func ConvertChart(from kubernetes.MonitoringDashboardChart) Chart {
	aggs := []Aggregation{}
	for _, agg := range from.Aggregations {
		aggs = append(aggs, Aggregation{Label: agg.Label, DisplayName: agg.DisplayName})
	}
	return Chart{
		Name:         from.Name,
		Unit:         from.Unit,
		Spans:        from.Spans,
		Aggregations: aggs,
	}
}
