package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util"
)

// AggregateMetrics is the API handler to fetch metrics to be displayed, related to a single aggregate
func AggregateMetrics(w http.ResponseWriter, r *http.Request) {
	getAggregateMetrics(w, r, defaultPromClientSupplier)
}

// getServiceMetrics (mock-friendly version)
func getAggregateMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	aggregate := vars["aggregate"]
	aggregateValue := vars["aggregateValue"]

	prom, namespaceInfo := initClientsForMetrics(w, r, promSupplier, namespace)
	if prom == nil {
		// any returned value nil means error & response already written
		return
	}

	params := prometheus.IstioMetricsQuery{Namespace: namespace, Aggregate: aggregate, AggregateValue: aggregateValue}
	err := extractIstioMetricsQueryParams(r, &params, namespaceInfo)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	if params.Direction != "inbound" {
		RespondWithError(w, http.StatusBadRequest, "AggregateMetrics 'direction' must be 'inbound' as the metrics are associated with inbound traffic to the destination workload.")
		return
	}

	metrics := prom.GetMetrics(&params)
	RespondWithJSON(w, http.StatusOK, metrics)
}

func extractIstioMetricsQueryParams(r *http.Request, q *prometheus.IstioMetricsQuery, namespaceInfo *models.Namespace) error {
	q.FillDefaults()
	queryParams := r.URL.Query()
	if filters, ok := queryParams["filters[]"]; ok && len(filters) > 0 {
		q.Filters = filters
	}

	dir := queryParams.Get("direction")
	if dir != "" {
		if dir != "inbound" && dir != "outbound" {
			return errors.New("bad request, query parameter 'direction' must be either 'inbound' or 'outbound'")
		}
		q.Direction = dir
	}
	requestProtocol := queryParams.Get("requestProtocol")
	if requestProtocol != "" {
		q.RequestProtocol = requestProtocol
	}
	reporter := queryParams.Get("reporter")
	if reporter != "" {
		if reporter != "source" && reporter != "destination" {
			return errors.New("bad request, query parameter 'reporter' must be either 'source' or 'destination'")
		}
		q.Reporter = reporter
	}
	return extractBaseMetricsQueryParams(queryParams, &q.BaseMetricsQuery, namespaceInfo)
}

func extractBaseMetricsQueryParams(queryParams url.Values, q *prometheus.BaseMetricsQuery, namespaceInfo *models.Namespace) error {
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

	// If needed, adjust interval -- Make sure query won't fetch data before the namespace creation
	intervalStartTime, err := util.GetStartTimeForRateInterval(q.End, q.RateInterval)
	if err != nil {
		return err
	}
	if intervalStartTime.Before(namespaceInfo.CreationTimestamp) {
		q.RateInterval = fmt.Sprintf("%ds", int(q.End.Sub(namespaceInfo.CreationTimestamp).Seconds()))
		intervalStartTime = namespaceInfo.CreationTimestamp
		log.Debugf("[extractMetricsQueryParams] Interval set to: %v", q.RateInterval)
	}
	// If needed, adjust query start time (bound to namespace creation time)
	intervalDuration := q.End.Sub(intervalStartTime)
	allowedStart := namespaceInfo.CreationTimestamp.Add(intervalDuration)
	if q.Start.Before(allowedStart) {
		log.Debugf("[extractMetricsQueryParams] Requested query start time [%v] set to allowed time [%v]", q.Start, allowedStart)
		q.Start = allowedStart

		if q.Start.After(q.End) {
			// This means that the query range does not fall in the range
			// of life of the namespace. So, there are no metrics to query.
			log.Debugf("[extractMetricsQueryParams] Query end time = %v; not querying metrics.", q.End)
			return errors.New("after checks, query start time is after end time")
		}
	}

	// Adjust start & end times to be a multiple of step
	stepInSecs := int64(q.Step.Seconds())
	q.Start = time.Unix((q.Start.Unix()/stepInSecs)*stepInSecs, 0)
	return nil
}
