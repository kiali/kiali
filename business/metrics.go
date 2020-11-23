package business

import (
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

// MetricsService deals with fetching metrics from prometheus
type MetricsService struct {
	prom prometheus.ClientInterface
}

// NewMetricsService initializes this business service
func NewMetricsService(prom prometheus.ClientInterface) *MetricsService {
	return &MetricsService{prom: prom}
}

func (in *MetricsService) GetMetrics(q models.IstioMetricsQuery, scaler func(n string) float64) (models.MetricsMap, error) {
	lb := createMetricsLabelsBuilder(&q)
	grouping := strings.Join(q.ByLabels, ",")
	return in.fetchAllMetrics(q, lb, grouping, scaler)
}

func createMetricsLabelsBuilder(q *models.IstioMetricsQuery) *MetricsLabelsBuilder {
	lb := NewMetricsLabelsBuilder(q.Direction)
	lb.Reporter(q.Reporter)

	namespaceSet := false
	if q.Service != "" {
		lb.Service(q.Service, q.Namespace)
		namespaceSet = true
	}
	if q.Workload != "" {
		lb.Workload(q.Workload, q.Namespace)
		namespaceSet = true
	}
	if q.App != "" {
		lb.App(q.App, q.Namespace)
		namespaceSet = true
	}
	if !namespaceSet && q.Namespace != "" {
		lb.Namespace(q.Namespace)
	}
	if q.RequestProtocol != "" {
		lb.Protocol(q.RequestProtocol)
	}
	if q.Aggregate != "" {
		lb.Aggregate(q.Aggregate, q.AggregateValue)
	}
	return lb
}

func (in *MetricsService) fetchAllMetrics(q models.IstioMetricsQuery, lb *MetricsLabelsBuilder, grouping string, scaler func(n string) float64) (models.MetricsMap, error) {
	labels := lb.Build()
	labelsError := lb.BuildForErrors()

	var wg sync.WaitGroup
	fetchRate := func(p8sFamilyName string, metric *prometheus.Metric, lbl []string) {
		defer wg.Done()
		m := in.prom.FetchRateRange(p8sFamilyName, lbl, grouping, &q.RangeQuery)
		*metric = m
	}

	fetchHisto := func(p8sFamilyName string, histo *prometheus.Histogram) {
		defer wg.Done()
		h := in.prom.FetchHistogramRange(p8sFamilyName, labels, grouping, &q.RangeQuery)
		*histo = h
	}

	type resultHolder struct {
		metric     prometheus.Metric
		histo      prometheus.Histogram
		definition istioMetric
	}
	maxResults := len(istioMetrics)
	if len(q.Filters) != 0 {
		maxResults = len(q.Filters)
	}
	results := make([]*resultHolder, maxResults)

	for _, istioMetric := range istioMetrics {
		// if filters is empty, fetch all anyway
		doFetch := len(q.Filters) == 0
		if !doFetch {
			for _, filter := range q.Filters {
				if filter == istioMetric.kialiName {
					doFetch = true
					break
				}
			}
		}
		if doFetch {
			wg.Add(1)
			result := resultHolder{definition: istioMetric}
			results = append(results, &result)
			if istioMetric.isHisto {
				go fetchHisto(istioMetric.istioName, &result.histo)
			} else {
				labelsToUse := istioMetric.labelsToUse(labels, labelsError)
				go fetchRate(istioMetric.istioName, &result.metric, labelsToUse)
			}
		}
	}
	wg.Wait()

	// Return results as two maps per reporter
	metrics := make(models.MetricsMap)
	for _, result := range results {
		if result != nil {
			conversionParams := models.ConversionParams{Scale: 1.0}
			if scaler != nil {
				scale := scaler(result.definition.kialiName)
				if scale != 0.0 {
					conversionParams.Scale = scale
				}
			}
			var converted []models.Metric
			var err error
			if result.definition.isHisto {
				converted, err = models.ConvertHistogram(result.definition.kialiName, result.histo, conversionParams)
				if err != nil {
					return nil, err
				}
			} else {
				converted, err = models.ConvertMetric(result.definition.kialiName, result.metric, conversionParams)
				if err != nil {
					return nil, err
				}
			}
			metrics[result.definition.kialiName] = append(metrics[result.definition.kialiName], converted...)
		}
	}
	return metrics, nil
}

// GetStats computes metrics stats, currently response times, for a set of queries
func (in *MetricsService) GetStats(queries []models.MetricsStatsQuery) (map[string]models.MetricsStats, error) {
	type statsChanResult struct {
		key   string
		stats *models.MetricsStats
		err   error
	}

	statsChan := make(chan statsChanResult, len(queries))
	var wg sync.WaitGroup

	for _, q := range queries {
		wg.Add(1)
		go func(q models.MetricsStatsQuery) {
			defer wg.Done()
			stats, err := in.getSingleQueryStats(&q)
			statsChan <- statsChanResult{key: q.GenKey(), stats: stats, err: err}
		}(q)
	}
	wg.Wait()
	// All stats are fetched, close channel
	close(statsChan)
	// Read channel
	result := make(map[string]models.MetricsStats)
	for r := range statsChan {
		if r.err != nil {
			return nil, r.err
		}
		if r.stats != nil {
			result[r.key] = *r.stats
		}
	}
	return result, nil
}

func (in *MetricsService) getSingleQueryStats(q *models.MetricsStatsQuery) (*models.MetricsStats, error) {
	lb := createStatsMetricsLabelsBuilder(q)
	labels := lb.Build()
	stats, err := in.prom.FetchHistogramValues("istio_request_duration_milliseconds", labels, "", q.Interval, q.Avg, q.Quantiles, q.QueryTime)
	if err != nil {
		return nil, err
	}
	metricsStats := models.MetricsStats{
		ResponseTimes: []models.Stat{},
	}
	for stat, vec := range stats {
		for _, sample := range vec {
			value := float64(sample.Value)
			if math.IsNaN(value) {
				continue
			}
			metricsStats.ResponseTimes = append(metricsStats.ResponseTimes, models.Stat{Name: stat, Value: value})
		}
	}
	sort.Slice(metricsStats.ResponseTimes, func(i, j int) bool {
		return metricsStats.ResponseTimes[i].Name < metricsStats.ResponseTimes[j].Name
	})
	return &metricsStats, nil
}

func createStatsMetricsLabelsBuilder(q *models.MetricsStatsQuery) *MetricsLabelsBuilder {
	lb := NewMetricsLabelsBuilder(q.Direction)
	lb.SelfReporter()
	if q.Target.Kind == "app" {
		lb.App(q.Target.Name, q.Target.Namespace)
	} else if q.Target.Kind == "workload" {
		lb.Workload(q.Target.Name, q.Target.Namespace)
	} else if q.Target.Kind == "service" {
		lb.Service(q.Target.Name, q.Target.Namespace)
	}
	if q.PeerTarget != nil {
		if q.PeerTarget.Kind == "app" {
			lb.PeerApp(q.PeerTarget.Name, q.PeerTarget.Namespace)
		} else if q.PeerTarget.Kind == "workload" {
			lb.PeerWorkload(q.PeerTarget.Name, q.PeerTarget.Namespace)
		} else if q.PeerTarget.Kind == "service" {
			lb.PeerService(q.PeerTarget.Name, q.PeerTarget.Namespace)
		}
	}
	return lb
}
