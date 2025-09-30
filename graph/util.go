package graph

import (
	"context"
	"fmt"
	nethttp "net/http"
	"strings"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	prom_client "github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type Response struct {
	Message string
	Code    int
}

// Error panics with InternalServerError (500) and the provided message
func Error(message string) {
	Panic(message, nethttp.StatusInternalServerError)
}

// BadRequest panics with BadRequest and the provided message
func BadRequest(message string) {
	Panic(message, nethttp.StatusBadRequest)
}

// Forbidden panics with Forbidden and the provided message
func Forbidden(message string) {
	Panic(message, nethttp.StatusForbidden)
}

// Panic panics with the provided HTTP response code and message
func Panic(message string, code int) Response {
	panic(Response{
		Message: message,
		Code:    code,
	})
}

// CheckError panics with the supplied error if it is non-nil
func CheckError(err error) {
	if err != nil {
		panic(err.Error())
	}
}

// CheckUnavailable panics with StatusServiceUnavailable (503) and the supplied error if it is non-nil
func CheckUnavailable(err error) {
	if err != nil {
		Panic(err.Error(), nethttp.StatusServiceUnavailable)
	}
}

// IsOK just validates that a telemetry label value is not empty or unknown
func IsOK(telemetryVal string) bool {
	return telemetryVal != "" && telemetryVal != Unknown
}

// IsOKVersion does standard validation and also rejects "latest", which is equivalent to "unknown"
// when using canonical_revision
func IsOKVersion(telemetryVal string) bool {
	return telemetryVal != "" && telemetryVal != Unknown && telemetryVal != "latest"
}

// AddQueryScope returns the prom query unchanged if there is no configured queryScope, otherwise
// it returns the query with the queryScope injected after each occurrence of a leading '{'.
func AddQueryScope(query string, conf *config.Config) string {
	queryScope := conf.ExternalServices.Prometheus.QueryScope
	if len(queryScope) == 0 {
		return query
	}

	scope := "{"
	for labelName, labelValue := range queryScope {
		scope = fmt.Sprintf("%s%s=\"%s\",", scope, prometheus.SanitizeLabelName(labelName), labelValue)
	}

	return strings.ReplaceAll(query, "{", scope)
}

// PromQuery queries Prometheus for metric data
func PromQuery(ctx context.Context, query string, queryTime time.Time, api prom_v1.API, conf *config.Config) model.Vector {
	return PromQueryAppender(ctx, query, queryTime, api, conf, "")
}

// PromQueryAppender is for appenders to query Prometheus for metric data
func PromQueryAppender(ctx context.Context, query string, queryTime time.Time, api prom_v1.API, conf *config.Config, appenderName string) model.Vector {
	if query == "" {
		return model.Vector{}
	}

	// Add tracing span for Prometheus query
	var end observability.EndFunc
	ctx, end = observability.StartSpan(
		ctx,
		"PromQueryAppender",
		observability.Attribute("package", "prometheus"),
		observability.Attribute("query", query),
		observability.Attribute("appenderName", appenderName),
	)
	defer end()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// get logger from context
	zl := log.FromContext(ctx)

	// add scope if necessary
	query = AddQueryScope(query, conf)

	// wrap with a round() to be in line with metrics api
	query = fmt.Sprintf("round(%s,0.001)", query)

	// start our timer
	var promtimer *prom_client.Timer
	if appenderName == "" {
		promtimer = internalmetrics.GetPrometheusProcessingTimePrometheusTimer("Graph-Generation")
	} else {
		promtimer = internalmetrics.GetPrometheusProcessingTimePrometheusTimer("Graph-Appender-" + appenderName)
	}

	// perform the Prometheus query now
	value, warnings, err := api.Query(ctx, query, queryTime)

	// log warnings and abort immediately on errors
	if len(warnings) > 0 {
		zl.Warn().Str("problemQuery", query).Msgf("PromQuery: Prometheus Warnings: [%s]", strings.Join(warnings, ","))
	}
	if err != nil {
		zl.Trace().Str("failedQuery", query).Msgf("PromQuery: Prometheus Error: [%v]", err)
	}
	CheckUnavailable(err)

	// notice we only collect metrics and log a message for successful prom queries
	internalmetrics.ObserveDurationAndLogResults(
		ctx,
		conf,
		promtimer,
		"PrometheusProcessingTime",
		map[string]string{"query": query},
		fmt.Sprintf("PromQuery: queryTime=[%v], queryTime.Unix=[%v])", queryTime.Format(TF), queryTime.Unix()))

	switch t := value.Type(); t {
	case model.ValVector: // Instant Vector
		return value.(model.Vector)
	default:
		Error(fmt.Sprintf("No handling for type %v!\n", t))
	}

	return nil
}
