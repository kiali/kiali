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
	GroupByVersion bool
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
	groupByVersion, groupByVersionErr := strconv.ParseBool(params.Get("groupByVersion"))
	duration, durationErr := time.ParseDuration(params.Get("duration"))
	metric := params.Get("metric")
	vendor := params.Get("vendor")
	queryTime, queryTimeErr := strconv.ParseInt(params.Get("queryTime"), 10, 64)

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

	options := Options{
		Duration:  duration,
		Metric:    metric,
		Namespace: namespace,
		QueryTime: queryTime,
		Service:   service,
		Vendor:    vendor,
		VendorOptions: VendorOptions{
			GroupByVersion: groupByVersion,
			Timestamp:      queryTime,
		},
	}

	appenders := parseAppenders(params, options)
	options.Appenders = appenders

	return options
}

func parseAppenders(params url.Values, o Options) []appender.Appender {
	var appenders []appender.Appender
	const all = "_all_"
	csl := all
	_, ok := params["appenders"]
	if ok {
		csl = strings.ToLower(params.Get("appenders"))
	}

	if csl == all || strings.Contains(csl, "dead_service") {
		appenders = append(appenders, appender.DeadServiceAppender{})
	}
	if csl == all || strings.Contains(csl, "istio") {
		appenders = append(appenders, appender.IstioAppender{})
	}
	if csl == all || strings.Contains(csl, "latency") {
		quantile := appender.DefaultQuantile
		if _, ok := params["latencyQuantile"]; ok {
			if latencyQuantile, err := strconv.ParseFloat(params.Get("latencyQuantile"), 64); err == nil {
				quantile = latencyQuantile
			}
		}
		appenders = append(appenders, appender.LatencyAppender{
			Duration:  o.Duration,
			Quantile:  quantile,
			QueryTime: o.QueryTime,
		})
	}
	if csl == all || strings.Contains(csl, "unused_service") {
		appenders = append(appenders, appender.UnusedServiceAppender{})
	}
	if csl == all || strings.Contains(csl, "sidecars_check") {
		appenders = append(appenders, appender.SidecarsCheckAppender{})
	}
	return appenders
}
