package business

import (
	"fmt"
	"strings"
	"sync"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/status"
)

const (
	regexGrpcResponseStatusErr = "^[1-9]$|^1[0-6]$"
	regexResponseCodeErr       = "^0$|^[4-5]\\\\d\\\\d$"
)

// MetricsService deals with fetching metrics from prometheus
type MetricsService struct {
	prom prometheus.ClientInterface
}

// NewMetricsService initializes this business service
func NewMetricsService(prom prometheus.ClientInterface) *MetricsService {
	return &MetricsService{prom: prom}
}

func (in *MetricsService) GetMetrics(q IstioMetricsQuery) models.Metrics {
	labels, labelsError := buildLabelStrings(q)
	grouping := strings.Join(q.ByLabels, ",")
	return in.fetchAllMetrics(q, labels, labelsError, grouping)
}

func buildLabelStrings(q IstioMetricsQuery) (string, []string) {
	labels := []string{fmt.Sprintf(`reporter="%s"`, q.Reporter)}
	ref := "destination"
	if q.Direction == "outbound" {
		ref = "source"
	}

	if q.Service != "" {
		// inbound only
		labels = append(labels, fmt.Sprintf(`destination_service_name="%s"`, q.Service))
		if q.Namespace != "" {
			labels = append(labels, fmt.Sprintf(`destination_service_namespace="%s"`, q.Namespace))
		}
	} else if q.Namespace != "" {
		labels = append(labels, fmt.Sprintf(`%s_workload_namespace="%s"`, ref, q.Namespace))
	}
	if q.Workload != "" {
		labels = append(labels, fmt.Sprintf(`%s_workload="%s"`, ref, q.Workload))
	}
	if q.App != "" {
		if status.AreCanonicalMetricsAvailable() {
			labels = append(labels, fmt.Sprintf(`%s_canonical_service="%s"`, ref, q.App))
		} else {
			labels = append(labels, fmt.Sprintf(`%s_app="%s"`, ref, q.App))
		}
	}
	if q.RequestProtocol != "" {
		labels = append(labels, fmt.Sprintf(`request_protocol="%s"`, q.RequestProtocol))
	}
	if q.Aggregate != "" {
		labels = append(labels, fmt.Sprintf(`%s="%s"`, q.Aggregate, q.AggregateValue))
	}

	full := "{" + strings.Join(labels, ",") + "}"

	errors := []string{}
	protocol := strings.ToLower(q.RequestProtocol)

	// both http and grpc requests can suffer from no response (response_code=0) or an http error
	// (response_code=4xx,5xx), and so we always perform a query against response_code:
	httpLabels := append(labels, fmt.Sprintf(`response_code=~"%s"`, regexResponseCodeErr))
	errors = append(errors, "{"+strings.Join(httpLabels, ",")+"}")

	// if necessary also look for grpc errors. note that the grpc test intentionally avoids
	// `grpc_response_status!="0"`. We need to be backward compatible and handle the case where
	// grpc_response_status does not exist, or if it is simply unset. In Prometheus, negative tests on a
	// non-existent label match everything, but positive tests match nothing. So, we stay positive.
	// furthermore, make sure we only count grpc errors with successful http status.
	if protocol != "http" {
		grpcLabels := append(labels, fmt.Sprintf(`grpc_response_status=~"%s",response_code!~"%s"`, regexGrpcResponseStatusErr, regexResponseCodeErr))
		errors = append(errors, ("{" + strings.Join(grpcLabels, ",") + "}"))
	}

	return full, errors
}

func (in *MetricsService) fetchAllMetrics(q IstioMetricsQuery, labels string, labelsError []string, grouping string) models.Metrics {
	var wg sync.WaitGroup
	fetchRate := func(p8sFamilyName string, metric **prometheus.Metric, lbl []string) {
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
		metric     *prometheus.Metric
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
	metrics := make(map[string]*prometheus.Metric)
	histograms := make(map[string]prometheus.Histogram)
	for _, result := range results {
		if result != nil {
			if result.definition.isHisto {
				histograms[result.definition.kialiName] = result.histo
			} else {
				metrics[result.definition.kialiName] = result.metric
			}
		}
	}
	return models.Metrics{
		Metrics:    metrics,
		Histograms: histograms,
	}
}
