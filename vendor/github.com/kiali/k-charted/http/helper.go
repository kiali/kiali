package http

import (
	"errors"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/k-charted/model"
	"github.com/kiali/k-charted/prometheus"
)

func ExtractDashboardQueryParams(queryParams url.Values, q *model.DashboardQuery) error {
	q.FillDefaults()
	q.LabelsFilters = extractLabelsFilters(queryParams.Get("labelsFilters"))
	additionalLabels := strings.Split(queryParams.Get("additionalLabels"), ",")
	for _, additionalLabel := range additionalLabels {
		kvPair := strings.Split(additionalLabel, ":")
		if len(kvPair) == 2 {
			q.AdditionalLabels = append(q.AdditionalLabels, model.Aggregation{
				Label:       strings.TrimSpace(kvPair[0]),
				DisplayName: strings.TrimSpace(kvPair[1]),
			})
		}
	}
	op := queryParams.Get("rawDataAggregator")
	// Explicit white-listing operators to prevent any kind of injection
	// For a list of operators, see https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators
	if op == "sum" || op == "min" || op == "max" || op == "avg" || op == "stddev" || op == "stdvar" {
		q.RawDataAggregator = op
	}
	return extractBaseMetricsQueryParams(queryParams, &q.MetricsQuery)
}

func extractLabelsFilters(rawString string) map[string]string {
	labelsFilters := make(map[string]string)
	rawFilters := strings.Split(rawString, ",")
	for _, rawFilter := range rawFilters {
		kvPair := strings.Split(rawFilter, ":")
		if len(kvPair) == 2 {
			labelsFilters[strings.TrimSpace(kvPair[0])] = strings.TrimSpace(kvPair[1])
		}
	}
	return labelsFilters
}

func extractBaseMetricsQueryParams(queryParams url.Values, q *prometheus.MetricsQuery) error {
	if ri := queryParams.Get("rateInterval"); ri != "" {
		q.RateInterval = ri
	}
	if rf := queryParams.Get("rateFunc"); rf != "" {
		if rf != "rate" && rf != "irate" {
			return errors.New("bad request, query parameter 'rateFunc' must be either 'rate' or 'irate'")
		}
		q.RateFunc = rf
	}
	if queryTime := queryParams.Get("queryTime"); queryTime != "" {
		if num, err := strconv.ParseInt(queryTime, 10, 64); err == nil {
			q.End = time.Unix(num, 0)
		} else {
			return errors.New("bad request, cannot parse query parameter 'queryTime'")
		}
	}
	if dur := queryParams.Get("duration"); dur != "" {
		if num, err := strconv.ParseInt(dur, 10, 64); err == nil {
			duration := time.Duration(num) * time.Second
			q.Start = q.End.Add(-duration)
		} else {
			return errors.New("bad request, cannot parse query parameter 'duration'")
		}
	}
	if step := queryParams.Get("step"); step != "" {
		if num, err := strconv.Atoi(step); err == nil {
			q.Step = time.Duration(num) * time.Second
		} else {
			return errors.New("bad request, cannot parse query parameter 'step'")
		}
	}
	if quantiles, ok := queryParams["quantiles[]"]; ok && len(quantiles) > 0 {
		for _, quantile := range quantiles {
			f, err := strconv.ParseFloat(quantile, 64)
			if err != nil {
				// Non parseable quantile
				return errors.New("bad request, cannot parse query parameter 'quantiles', float expected")
			}
			if f < 0 || f > 1 {
				return errors.New("bad request, invalid quantile(s): should be between 0 and 1")
			}
		}
		q.Quantiles = quantiles
	}
	if avgStr := queryParams.Get("avg"); avgStr != "" {
		if avg, err := strconv.ParseBool(avgStr); err == nil {
			q.Avg = avg
		} else {
			return errors.New("bad request, cannot parse query parameter 'avg'")
		}
	}
	if lbls, ok := queryParams["byLabels[]"]; ok && len(lbls) > 0 {
		q.ByLabels = lbls
	}

	// Adjust start & end times to be a multiple of step
	stepInSecs := int64(q.Step.Seconds())
	q.Start = time.Unix((q.Start.Unix()/stepInSecs)*stepInSecs, 0)
	return nil
}
