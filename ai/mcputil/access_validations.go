package mcputil

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util"
)

func ExtractIstioMetricsQueryParams(args map[string]interface{}, q *models.IstioMetricsQuery, namespaceInfo *models.Namespace) error {
	q.FillDefaults()

	if filters := GetStringArg(args, "filters"); filters != "" {
		// Assuming comma separated
		q.Filters = strings.Split(filters, ",")
	}

	dir := GetStringOrDefault(args, DefaultDirection, "direction")
	if dir != "inbound" && dir != "outbound" {
		return errors.New("bad request, query parameter 'direction' must be either 'inbound' or 'outbound'")
	}
	q.Direction = dir

	reporter := GetStringOrDefault(args, DefaultReporter, "reporter")
	if err := models.ValidateReporter(reporter); err != nil {
		return err
	}
	q.Reporter = reporter

	q.RequestProtocol = GetStringOrDefault(args, DefaultRequestProtocol, "requestProtocol")

	return extractBaseMetricsQueryParams(args, &q.RangeQuery, namespaceInfo)
}

// ValidateNamespaceAccess checks that the given namespace is in the user's
// accessible set for the cluster. It returns an error message plus the HTTP
// status to be propagated by the tool.
func ValidateNamespaceAccess(ctx context.Context, businessLayer *business.Layer, namespace, cluster string) (string, int) {
	if _, err := businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		switch {
		case business.IsAccessibleError(err), k8serrors.IsForbidden(err), k8serrors.IsUnauthorized(err):
			// Not-in-set covers both "denied" and "does not exist": the uniform
			// 403 is deliberate, so the tool is not a namespace-existence
			// oracle (especially in require_namespace_get mode).
			return fmt.Sprintf("Namespace %q is not accessible in cluster %q.", namespace, cluster), http.StatusForbidden
		default:
			return fmt.Sprintf("failed to validate namespace %q in cluster %q: %v", namespace, cluster, err), http.StatusInternalServerError
		}
	}
	return "", http.StatusOK
}

// maxPointsPerSeries is kept below the 11,000 points Prometheus allows per series in a range query.
const maxPointsPerSeries = 10000

// metricsTimeWindow returns the start and end of the metrics query. `to` is an RFC3339 timestamp
// and defaults to now. `since` is either an RFC3339 timestamp or a duration before `to`, such as
// "2h" or "1d". Without them, the older `queryTime` (Unix seconds) and `duration` arguments apply.
func metricsTimeWindow(args map[string]interface{}, now time.Time) (time.Time, time.Time, error) {
	end := now
	if to := GetStringArg(args, "to"); to != "" {
		parsed, err := time.Parse(time.RFC3339, to)
		if err != nil {
			return time.Time{}, time.Time{}, errors.New("bad request, query parameter 'to' must be an RFC3339 timestamp such as '2026-01-02T15:04:05Z'")
		}
		end = parsed
	} else if queryTime := GetStringArg(args, "queryTime"); queryTime != "" {
		num, err := strconv.ParseInt(queryTime, 10, 64)
		if err != nil {
			return time.Time{}, time.Time{}, errors.New("bad request, cannot parse query parameter 'queryTime'")
		}
		end = time.Unix(num, 0)
	}

	var start time.Time
	if since := GetStringArg(args, "since"); since != "" {
		if parsed, err := time.Parse(time.RFC3339, since); err == nil {
			start = parsed
		} else if d, err := model.ParseDuration(since); err == nil && d > 0 {
			start = end.Add(-time.Duration(d))
		} else {
			return time.Time{}, time.Time{}, errors.New("bad request, query parameter 'since' must be an RFC3339 timestamp or a duration such as '30m', '2h' or '1d'")
		}
	} else {
		var duration time.Duration
		dur := GetStringOrDefault(args, DefaultDuration, "duration")
		if num, err := strconv.ParseInt(dur, 10, 64); err == nil {
			duration = time.Duration(num) * time.Second
		} else if parsedDur, err := time.ParseDuration(dur); err == nil {
			duration = parsedDur
		} else {
			return time.Time{}, time.Time{}, errors.New("bad request, cannot parse query parameter 'duration'")
		}
		start = end.Add(-duration)
	}

	if !start.Before(end) {
		return time.Time{}, time.Time{}, errors.New("bad request, 'since' must be before 'to'")
	}
	return start, end, nil
}

func extractBaseMetricsQueryParams(args map[string]interface{}, q *prometheus.RangeQuery, namespaceInfo *models.Namespace) error {
	q.RateInterval = GetStringOrDefault(args, DefaultRateInterval, "rateInterval")

	if rf := GetStringArg(args, "rateFunc"); rf != "" {
		if rf != "rate" && rf != "irate" {
			return errors.New("bad request, query parameter 'rateFunc' must be either 'rate' or 'irate'")
		}
		q.RateFunc = rf
	}

	start, end, err := metricsTimeWindow(args, time.Now())
	if err != nil {
		return err
	}
	q.Start = start
	q.End = end

	step := GetStringOrDefault(args, DefaultStep, "step")
	if num, err := strconv.Atoi(step); err == nil {
		q.Step = time.Duration(num) * time.Second
	} else {
		return errors.New("bad request, cannot parse query parameter 'step'")
	}
	// A long since/to window at the default step can exceed the Prometheus limit on points per
	// series, so widen the step unless the caller set one.
	if GetStringArg(args, "step") == "" && q.Step > 0 {
		if minStep := q.End.Sub(q.Start) / maxPointsPerSeries; minStep > q.Step {
			q.Step = (minStep/time.Second + 1) * time.Second
		}
	}

	quantiles := GetStringOrDefault(args, DefaultQuantiles, "quantiles")
	qList := strings.Split(quantiles, ",")
	for _, quantile := range qList {
		f, err := strconv.ParseFloat(strings.TrimSpace(quantile), 64)
		if err != nil {
			return errors.New("bad request, cannot parse query parameter 'quantiles', float expected")
		}
		if f < 0 || f > 1 {
			return errors.New("bad request, invalid quantile(s): should be between 0 and 1")
		}
	}
	q.Quantiles = qList

	if avgStr := GetStringArg(args, "avg"); avgStr != "" {
		if avg, err := strconv.ParseBool(avgStr); err == nil {
			q.Avg = avg
		} else {
			return errors.New("bad request, cannot parse query parameter 'avg'")
		}
	}
	if lbls := GetStringArg(args, "byLabels"); lbls != "" {
		q.ByLabels = strings.Split(lbls, ",")
	}

	// If needed, adjust interval -- Make sure query won't fetch data before the namespace creation
	intervalStartTime, err := util.GetStartTimeForRateInterval(q.End, q.RateInterval)
	if err != nil {
		return err
	}
	if intervalStartTime.Before(namespaceInfo.CreationTimestamp) {
		q.RateInterval = fmt.Sprintf("%ds", int(q.End.Sub(namespaceInfo.CreationTimestamp).Seconds()))
		intervalStartTime = namespaceInfo.CreationTimestamp
	}
	// If needed, adjust query start time (bound to namespace creation time)
	intervalDuration := q.End.Sub(intervalStartTime)
	allowedStart := namespaceInfo.CreationTimestamp.Add(intervalDuration)
	if q.Start.Before(allowedStart) {
		q.Start = allowedStart

		if q.Start.After(q.End) {
			// This means that the query range does not fall in the range
			// of life of the namespace. So, there are no metrics to query.
			return errors.New("after checks, query start time is after end time")
		}
	}

	// Adjust start & end times to be a multiple of step
	if q.Step.Seconds() > 0 {
		stepInSecs := int64(q.Step.Seconds())
		q.Start = time.Unix((q.Start.Unix()/stepInSecs)*stepInSecs, 0)
	}
	return nil
}
