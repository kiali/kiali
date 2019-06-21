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
	if rateIntervals, ok := queryParams["rateInterval"]; ok && len(rateIntervals) > 0 {
		// Only first is taken into consideration
		q.RateInterval = rateIntervals[0]
	}
	if rateFuncs, ok := queryParams["rateFunc"]; ok && len(rateFuncs) > 0 {
		// Only first is taken into consideration
		if rateFuncs[0] != "rate" && rateFuncs[0] != "irate" {
			// Bad request
			return errors.New("bad request, query parameter 'rateFunc' must be either 'rate' or 'irate'")
		}
		q.RateFunc = rateFuncs[0]
	}
	if queryTimes, ok := queryParams["queryTime"]; ok && len(queryTimes) > 0 {
		if num, err := strconv.ParseInt(queryTimes[0], 10, 64); err == nil {
			q.End = time.Unix(num, 0)
		} else {
			// Bad request
			return errors.New("bad request, cannot parse query parameter 'queryTime'")
		}
	}
	if durations, ok := queryParams["duration"]; ok && len(durations) > 0 {
		if num, err := strconv.ParseInt(durations[0], 10, 64); err == nil {
			duration := time.Duration(num) * time.Second
			q.Start = q.End.Add(-duration)
		} else {
			// Bad request
			return errors.New("bad request, cannot parse query parameter 'duration'")
		}
	}
	if steps, ok := queryParams["step"]; ok && len(steps) > 0 {
		if num, err := strconv.Atoi(steps[0]); err == nil {
			q.Step = time.Duration(num) * time.Second
		} else {
			// Bad request
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
	if avgFlags, ok := queryParams["avg"]; ok && len(avgFlags) > 0 {
		if avgFlag, err := strconv.ParseBool(avgFlags[0]); err == nil {
			q.Avg = avgFlag
		} else {
			// Bad request
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
