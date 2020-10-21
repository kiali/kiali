package models

import "github.com/kiali/kiali/prometheus"

// Metrics contains all simple metrics and histograms data
type Metrics struct {
	Metrics    map[string]*prometheus.Metric   `json:"metrics"`
	Histograms map[string]prometheus.Histogram `json:"histograms"`
}
