// Package options holds the currently supported path variables and query params
// for the graph handlers. See graph package for details.
package options

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/graph/appender"
)

// VendorOptions are those that are supplied to the vendor-specific generators.
type VendorOptions struct {
	ColorError     string
	ColorNormal    string
	ColorNoTraffic string
	ColorWarn      string
	GroupByVersion bool
	ThresholdError float64
	ThresholdWarn  float64
	Timestamp      int64
}

// Options are all supported graph generation options.
type Options struct {
	Appenders []appender.Appender
	Duration  time.Duration
	Metric    string
	Namespace string
	QueryTime int64 // unix time in seconds
	Service   string
	Vendor    string
	VendorOptions
}

func NewOptions(r *http.Request) Options {
	// path variables
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]

	// query params
	params := r.URL.Query()
	appenders := parseAppenders(params)
	colorNoTraffic := params.Get("colorNoTraffic")
	colorError := params.Get("colorError")
	colorNormal := params.Get("colorNormal")
	colorWarn := params.Get("colorWarn")
	groupByVersion, groupByVersionErr := strconv.ParseBool(params.Get("groupByVersion"))
	duration, durationErr := time.ParseDuration(params.Get("duration"))
	metric := params.Get("metric")
	vendor := params.Get("vendor")
	thresholdError, thresholdErrorErr := strconv.ParseFloat(params.Get("thresholdError"), 64)
	thresholdWarn, thresholdWarnErr := strconv.ParseFloat(params.Get("thresholdWarn"), 64)
	queryTime, queryTimeErr := strconv.ParseInt(params.Get("queryTime"), 10, 64)

	if "" == colorNoTraffic {
		colorNoTraffic = "black"
	}
	if "" == colorError {
		colorError = "red"
	}
	if "" == colorNormal {
		colorNormal = "green"
	}
	if "" == colorWarn {
		colorWarn = "orange"
	}
	if groupByVersionErr != nil {
		groupByVersion = true
	}
	if durationErr != nil {
		duration, _ = time.ParseDuration("10m")
	}
	if "" == metric {
		metric = "istio_request_count"
	}
	if queryTimeErr != nil {
		queryTime = time.Now().Unix()
	}
	if "" == vendor {
		vendor = "cytoscape"
	}
	if thresholdErrorErr != nil {
		thresholdError = 0.2
	}
	if thresholdWarnErr != nil {
		thresholdError = 0.0
	}

	return Options{
		Appenders: appenders,
		Duration:  duration,
		Metric:    metric,
		Namespace: namespace,
		QueryTime: queryTime,
		Service:   service,
		Vendor:    vendor,
		VendorOptions: VendorOptions{
			ColorNoTraffic: colorNoTraffic,
			ColorError:     colorError,
			ColorNormal:    colorNormal,
			ColorWarn:      colorWarn,
			GroupByVersion: groupByVersion,
			ThresholdError: thresholdError,
			ThresholdWarn:  thresholdWarn,
			Timestamp:      queryTime,
		},
	}
}

func parseAppenders(params url.Values) []appender.Appender {
	var appenders []appender.Appender
	const all = "_all_"
	csl := all
	_, ok := params["appenders"]
	if ok {
		csl = strings.ToLower(params.Get("appenders"))
	}

	if csl == all || strings.Contains(csl, "unused_service") {
		appenders = append(appenders, appender.UnusedServiceAppender{})
	}
	if csl == all || strings.Contains(csl, "circuit_breaker") {
		appenders = append(appenders, appender.CircuitBreakerAppender{})
	}
	return appenders
}
