package business

import (
	"fmt"
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
	if q.Reporter != "both" {
		lb.Reporter(q.Reporter, q.IncludeAmbient)
	}

	namespaceSet := false

	// add custom labels from config if custom labels are configured
	lb.QueryScope()

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
	if q.Cluster != "" {
		lb.Cluster(q.Cluster)
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

	// The number of queries could be high, limit concurrent requests to 10 at a time (see https://github.com/kiali/kiali/issues/5584)
	// Note that the default prometheus_engine_queries_concurrent_max = 20, so by limiting here to 10 we leave some room for
	// other users hitting prom while still allowing a decent amount of concurrency.  Prom also has a default query timeout
	// of 2 minutes, and any queries pending execution (so any number > 20 by default) are still subject to that timer.
	chunkSize := 10
	numQueries := len(queries)
	var queryChunks [][]models.MetricsStatsQuery
	for i := 0; i < numQueries; i += chunkSize {
		end := i + chunkSize
		if end > numQueries {
			end = numQueries
		}
		queryChunks = append(queryChunks, queries[i:end])
	}

	result := make(map[string]models.MetricsStats)

	for i, queryChunk := range queryChunks {
		statsChan := make(chan statsChanResult, len(queryChunk))
		var wg sync.WaitGroup

		for _, q := range queryChunks[i] {
			wg.Add(1)
			go func(q models.MetricsStatsQuery) {
				defer wg.Done()
				stats, err := in.getSingleQueryStats(&q)
				statsChan <- statsChanResult{key: q.GenKey(), stats: stats, err: err}
			}(q)
		}
		wg.Wait()
		// All chunk stats are fetched, close channel
		close(statsChan)
		// Read channel
		for r := range statsChan {
			if r.err != nil {
				return nil, r.err
			}
			if r.stats != nil {
				result[r.key] = *r.stats
			}
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
	if q.Target.Cluster != "" {
		lb.Cluster(q.Target.Cluster)
	}
	return lb
}

func (in *MetricsService) GetControlPlaneMetrics(q models.IstioMetricsQuery, pods models.Pods, scaler func(n string) float64) (models.MetricsMap, error) {
	podRegex := ""
	separator := ""
	for _, pod := range pods {
		podRegex = fmt.Sprintf("%s%s%s", podRegex, separator, pod.Name)
		separator = "|"
	}
	podLabel := fmt.Sprintf(`{pod="%s"}`, podRegex)

	metrics := make(models.MetricsMap)
	var err error

	// pilot_proxy_convergence_time is handled in a special way.  our typical "sum(range(" queries for avg and quantiles,
	// don't work here. Because proxy sync is reported more like a step function.  The count and sum are updated one time,
	// and so there is typically no range, because any range requires at least two data points.  What we really want here
	// is delta(sum) / delta(count) for the time period. Note, this is pretty non-standard manipulation of a histogram,
	// don't try this at home.
	deltaDuration := q.End.Sub(q.Start)
	deltaSumMetric := in.prom.FetchDelta("pilot_proxy_convergence_time_sum", podLabel, "", q.End, deltaDuration)
	deltaSumConverted, err := models.ConvertMetric("pilot_proxy_convergence_time_sum", deltaSumMetric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}
	deltaCountMetric := in.prom.FetchDelta("pilot_proxy_convergence_time_count", podLabel, "", q.End, deltaDuration)
	deltaCountConverted, err := models.ConvertMetric("pilot_proxy_convergence_time_count", deltaCountMetric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}

	var converted []models.Metric

	// if the supporting metrics are not there just don't report this metric
	if len(deltaSumConverted) > 0 && len(deltaSumConverted[0].Datapoints) > 0 && len(deltaCountConverted) > 0 && len(deltaCountConverted[0].Datapoints) > 0 {
		deltaSum := deltaSumConverted[0].Datapoints[0].Value
		deltaCount := deltaCountConverted[0].Datapoints[0].Value
		converted = deltaSumConverted
		converted[0].Datapoints[0].Value = deltaSum / deltaCount
		metrics["pilot_proxy_convergence_time"] = append(metrics["pilot_proxy_convergence_time"], converted...)
	}

	metric := in.prom.FetchRateRange("container_cpu_usage_seconds_total", []string{podLabel}, "", &q.RangeQuery)
	converted, err = models.ConvertMetric("container_cpu_usage_seconds_total", metric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}
	metrics["container_cpu_usage_seconds_total"] = append(metrics["container_cpu_usage_seconds_total"], converted...)

	metric = in.prom.FetchRateRange("process_cpu_seconds_total", []string{podLabel}, "", &q.RangeQuery)
	converted, err = models.ConvertMetric("process_cpu_seconds_total", metric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}
	metrics["process_cpu_seconds_total"] = append(metrics["process_cpu_seconds_total"], converted...)

	metric = in.prom.FetchRange("container_memory_working_set_bytes", podLabel, "", "", &q.RangeQuery)
	converted, err = models.ConvertMetric("container_memory_working_set_bytes", metric, models.ConversionParams{Scale: 0.000001})
	if err != nil {
		return nil, err
	}
	metrics["container_memory_working_set_bytes"] = append(metrics["container_memory_working_set_bytes"], converted...)

	metric = in.prom.FetchRange("process_resident_memory_bytes", podLabel, "", "", &q.RangeQuery)
	converted, err = models.ConvertMetric("process_resident_memory_bytes", metric, models.ConversionParams{Scale: 0.000001})
	if err != nil {
		return nil, err
	}
	metrics["process_resident_memory_bytes"] = append(metrics["process_resident_memory_bytes"], converted...)

	return metrics, nil
}

func (in *MetricsService) GetZtunnelMetrics(q models.IstioMetricsQuery, pods models.Pods) (models.MetricsMap, error) {

	metrics := make(models.MetricsMap)
	var err error
	var converted []models.Metric

	// ZTunnel connections
	metric := in.prom.FetchRateRange("istio_tcp_connections_opened_total", []string{"{pod=~\"ztunnel-.*\"}"}, "pod", &q.RangeQuery)
	converted, err = models.ConvertMetric("istio_tcp_connections_opened_total", metric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}
	metrics["ztunnel_connections"] = append(metrics["istio_tcp_connections_closed_total"], converted...)
	metric = in.prom.FetchRateRange("istio_tcp_connections_closed_total", []string{"{pod=~\"ztunnel-.*\"}"}, "pod", &q.RangeQuery)
	converted, err = models.ConvertMetric("istio_tcp_connections_closed_total", metric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}
	metrics["ztunnel_connections"] = append(metrics["istio_tcp_connections_closed_total"], converted...)

	// Ztunnel versions
	metric = in.prom.FetchRange("istio_build", "{component=\"ztunnel\"}", "tag", "sum", &q.RangeQuery)
	converted, err = models.ConvertMetric("istio_build", metric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}
	metrics["ztunnel_versions"] = append(metrics["istio_build"], converted...)

	// Ztunnel memory usage ztunnel_memory_usage
	metric = in.prom.FetchRange("container_memory_working_set_bytes", "{pod=~\"ztunnel-.*\"}", "pod", "sum", &q.RangeQuery)
	converted, err = models.ConvertMetric("container_memory_working_set_bytes", metric, models.ConversionParams{Scale: 0.000001})
	if err != nil {
		return nil, err
	}
	metrics["ztunnel_memory_usage"] = append(metrics["container_memory_working_set_bytes"], converted...)

	// Ztunnel ztunnel_cpu_usage
	metricName := fmt.Sprintf("irate(container_cpu_usage_seconds_total{pod=~\"ztunnel-.*\"}[%s])", q.RateInterval)
	metric = in.prom.FetchRange(metricName, "", "pod", "sum", &q.RangeQuery)
	converted, err = models.ConvertMetric(metricName, metric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}
	metrics["ztunnel_cpu_usage"] = append(metrics[metricName], converted...)

	// ztunnel_bytes_transmitted
	metric = in.prom.FetchRateRange("istio_tcp_received_bytes_total", []string{"{pod=~\"ztunnel-.*\"}"}, "pod", &q.RangeQuery)
	converted, err = models.ConvertMetric("ztunnel_bytes_transmitted", metric, models.ConversionParams{Scale: 0.001, LabelPrefix: "Received"})
	if err != nil {
		return nil, err
	}
	metrics["ztunnel_bytes_transmitted"] = append(metrics["ztunnel_bytes_transmitted"], converted...)
	metric = in.prom.FetchRateRange("istio_tcp_sent_bytes_total", []string{"{pod=~\"ztunnel-.*\"}"}, "pod", &q.RangeQuery)
	converted, err = models.ConvertMetric("ztunnel_bytes_transmitted", metric, models.ConversionParams{Scale: 0.001, LabelPrefix: "Sent"})
	if err != nil {
		return nil, err
	}
	metrics["ztunnel_bytes_transmitted"] = append(metrics["ztunnel_bytes_transmitted"], converted...)

	// ztunnel_workload_manager
	metric = in.prom.FetchRange("workload_manager_active_proxy_count", "{pod=~\"ztunnel-.*\"}", "pod", "sum", &q.RangeQuery)
	converted, err = models.ConvertMetric("ztunnel_workload_manager", metric, models.ConversionParams{Scale: 1})
	if err != nil {
		return nil, err
	}
	metrics["ztunnel_workload_manager"] = append(metrics["ztunnel_workload_manager"], converted...)

	return metrics, nil
}
