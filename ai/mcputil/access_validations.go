package mcputil

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util"
)

func getAuthInfo(r *http.Request) (map[string]*api.AuthInfo, error) {
	authInfoContext := authentication.GetAuthInfoContext(r.Context())
	if authInfoContext != nil {
		if authInfo, ok := authInfoContext.(map[string]*api.AuthInfo); ok {
			return authInfo, nil
		} else {
			return nil, errors.New("authInfo is not of type map[string]*api.AuthInfo")
		}
	} else {
		return nil, errors.New("authInfo missing from the request context")
	}
}

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

	if includeAmbientParam := GetStringArg(args, "includeAmbient"); includeAmbientParam != "" {
		includeAmbient, err := strconv.ParseBool(includeAmbientParam)
		if err != nil {
			return errors.New("bad request, query parameter 'includeAmbient' must be either 'true' or 'false'")
		}
		q.IncludeAmbient = includeAmbient
	}

	reporter := GetStringOrDefault(args, DefaultReporter, "reporter")
	if reporter != "both" && reporter != "destination" && reporter != "source" {
		return errors.New("bad request, query parameter 'reporter' must be one of 'both, 'destination', or 'source'")
	}
	q.Reporter = reporter

	q.RequestProtocol = GetStringOrDefault(args, DefaultRequestProtocol, "requestProtocol")

	return extractBaseMetricsQueryParams(args, &q.RangeQuery, namespaceInfo)
}

// ValidateNamespaceAccess checks that the given namespace exists and is accessible.
// It returns an error message plus the HTTP status to be propagated by the tool.
func ValidateNamespaceAccess(ctx context.Context, businessLayer *business.Layer, namespace, cluster string) (string, int) {
	if _, err := businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		switch {
		case business.IsAccessibleError(err), k8serrors.IsForbidden(err), k8serrors.IsUnauthorized(err):
			return fmt.Sprintf("Namespace %q is not accessible in cluster %q.", namespace, cluster), http.StatusForbidden
		case k8serrors.IsNotFound(err):
			return fmt.Sprintf("Namespace %q does not exist in cluster %q.", namespace, cluster), http.StatusNotFound
		default:
			return fmt.Sprintf("failed to validate namespace %q in cluster %q: %v", namespace, cluster, err), http.StatusInternalServerError
		}
	}
	return "", http.StatusOK
}

func extractBaseMetricsQueryParams(args map[string]interface{}, q *prometheus.RangeQuery, namespaceInfo *models.Namespace) error {
	q.RateInterval = GetStringOrDefault(args, DefaultRateInterval, "rateInterval")

	if rf := GetStringArg(args, "rateFunc"); rf != "" {
		if rf != "rate" && rf != "irate" {
			return errors.New("bad request, query parameter 'rateFunc' must be either 'rate' or 'irate'")
		}
		q.RateFunc = rf
	}

	now := time.Now()
	q.End = now
	if queryTime := GetStringArg(args, "queryTime"); queryTime != "" {
		if num, err := strconv.ParseInt(queryTime, 10, 64); err == nil {
			q.End = time.Unix(num, 0)
		} else {
			return errors.New("bad request, cannot parse query parameter 'queryTime'")
		}
	}

	var duration time.Duration
	dur := GetStringOrDefault(args, DefaultDuration, "duration")
	if num, err := strconv.ParseInt(dur, 10, 64); err == nil {
		duration = time.Duration(num) * time.Second
	} else if parsedDur, err := time.ParseDuration(dur); err == nil {
		duration = parsedDur
	} else {
		return errors.New("bad request, cannot parse query parameter 'duration'")
	}
	q.Start = q.End.Add(-duration)

	step := GetStringOrDefault(args, DefaultStep, "step")
	if num, err := strconv.Atoi(step); err == nil {
		q.Step = time.Duration(num) * time.Second
	} else {
		return errors.New("bad request, cannot parse query parameter 'step'")
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
