// Package options holds the currently supported path variables and query params
// for the graph handlers. See graph package for details.
package options

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// VendorOptions are those that arew supplied to the vendor-specific generators.
type VendorOptions struct {
	GroupByVersion bool
	ColorDead      string
	ColorError     string
	ColorNormal    string
	ColorWarn      string
	ThresholdError float64
	ThresholdWarn  float64
}

// Options are all supported graph generation options.
type Options struct {
	Namespace string
	Service   string
	Vendor    string
	Metric    string
	Offset    time.Duration
	Duration  time.Duration
	VendorOptions
}

func NewOptions(r *http.Request) Options {
	// path variables
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]

	// query params
	params := r.URL.Query()
	colorDead := params.Get("colorDead")
	colorError := params.Get("colorError")
	colorNormal := params.Get("colorNormal")
	colorWarn := params.Get("colorWarn")
	groupByVersion, groupByVersionErr := strconv.ParseBool(params.Get("groupByVersion"))
	duration, durationErr := time.ParseDuration(params.Get("duration"))
	metric := params.Get("metric")
	offset, offsetErr := time.ParseDuration(params.Get("offset"))
	vendor := params.Get("vendor")
	thresholdError, thresholdErrorErr := strconv.ParseFloat(params.Get("thresholdError"), 64)
	thresholdWarn, thresholdWarnErr := strconv.ParseFloat(params.Get("thresholdWarn"), 64)

	if "" == colorDead {
		colorDead = "black"
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
	if offsetErr != nil {
		offset, _ = time.ParseDuration("0m")
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
		Namespace: namespace,
		Service:   service,
		Vendor:    vendor,
		Duration:  duration,
		Metric:    metric,
		Offset:    offset,
		VendorOptions: VendorOptions{
			ColorDead:      colorDead,
			ColorError:     colorError,
			ColorNormal:    colorNormal,
			ColorWarn:      colorWarn,
			GroupByVersion: groupByVersion,
			ThresholdError: thresholdError,
			ThresholdWarn:  thresholdWarn,
		},
	}
}
