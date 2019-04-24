package prometheus

import (
	"time"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// MetricsQuery holds common parameters for all kinds of queries
type MetricsQuery struct {
	v1.Range
	RateInterval string
	RateFunc     string
	Quantiles    []string
	Avg          bool
	ByLabels     []string
}

// FillDefaults fills the struct with default parameters
func (q *MetricsQuery) FillDefaults() {
	q.End = time.Now()
	q.Start = q.End.Add(-30 * time.Minute)
	q.Step = 15 * time.Second
	q.RateInterval = "1m"
	q.RateFunc = "rate"
	q.Avg = true
}

// Metrics contains all simple metrics and histograms data
type Metrics struct {
	Metrics    map[string]*Metric   `json:"metrics"`
	Histograms map[string]Histogram `json:"histograms"`
}

// Metric holds the Prometheus Matrix model, which contains one or more time series (depending on grouping)
type Metric struct {
	Matrix model.Matrix `json:"matrix"`
	Err    error
}

// Histogram contains Metric objects for several histogram-kind statistics
type Histogram = map[string]Metric
