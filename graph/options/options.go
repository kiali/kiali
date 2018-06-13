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
	"github.com/kiali/kiali/services/models"
)

const (
	AppenderAll          string = "_all_"
	NamespaceAll         string = "all"
	NamespaceIstioSystem string = "istio-system"
)

// VendorOptions are those that are supplied to the vendor-specific generators.
type VendorOptions struct {
	GroupByVersion bool
	Timestamp      int64
}

// Options are all supported graph generation options.
type Options struct {
	Appenders    []appender.Appender
	Duration     time.Duration
	IncludeIstio bool // include istio-system services. Ignored for istio-system ns. Default false.
	Metric       string
	Namespaces   []string
	QueryTime    int64 // unix time in seconds
	Service      string
	Vendor       string
	VendorOptions
}

func NewOptions(r *http.Request) Options {
	// path variables
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]

	// query params
	params := r.URL.Query()
	duration, durationErr := time.ParseDuration(params.Get("duration"))
	includeIstio, includeIstioErr := strconv.ParseBool(params.Get("includeIstio"))
	groupByVersion, groupByVersionErr := strconv.ParseBool(params.Get("groupByVersion"))
	metric := params.Get("metric")
	queryTime, queryTimeErr := strconv.ParseInt(params.Get("queryTime"), 10, 64)
	namespaces := params.Get("namespaces") // csl of namespaces. Overrides namespace path param if set
	vendor := params.Get("vendor")

	var namespaceNames []string
	fetchNamespaces := namespaces == NamespaceAll || (namespaces == "" && (namespace == NamespaceAll))
	if fetchNamespaces {
		namespaces, err := models.GetNamespaces()
		checkError(err)

		for _, namespace := range namespaces {
			if namespace.Name != NamespaceIstioSystem {
				namespaceNames = append(namespaceNames, namespace.Name)
			}
		}
	} else if namespaces != "" {
		namespaceNames = strings.Split(namespaces, ",")
	} else if namespace != "" {
		namespaceNames = []string{namespace}
	} else {
		// note, some global handlers do not require any namespaces
		namespaceNames = []string{}
	}

	if durationErr != nil {
		duration, _ = time.ParseDuration("10m")
	}
	if includeIstioErr != nil {
		includeIstio = false
	}
	if groupByVersionErr != nil {
		groupByVersion = true
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
		Duration:     duration,
		IncludeIstio: includeIstio,
		Metric:       metric,
		Namespaces:   namespaceNames,
		QueryTime:    queryTime,
		Service:      service,
		Vendor:       vendor,
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
	csl := AppenderAll
	_, ok := params["appenders"]
	if ok {
		csl = strings.ToLower(params.Get("appenders"))
	}

	// The appender order is important
	// To reduce processing, filter dead services first
	// To reduce processing, next run appenders that don't apply to orphan services
	// Add orphan (unused) services
	// Run remaining appenders
	if csl == AppenderAll || strings.Contains(csl, "dead_service") {
		appenders = append(appenders, appender.DeadServiceAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, "latency") {
		quantile := appender.DefaultQuantile
		if _, ok := params["latencyQuantile"]; ok {
			if latencyQuantile, err := strconv.ParseFloat(params.Get("latencyQuantile"), 64); err == nil {
				quantile = latencyQuantile
			}
		}
		a := appender.LatencyAppender{
			Duration:  o.Duration,
			Quantile:  quantile,
			QueryTime: o.QueryTime,
		}
		appenders = append(appenders, a)
	}
	if csl == AppenderAll || strings.Contains(csl, "unused_service") {
		appenders = append(appenders, appender.UnusedServiceAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, "istio") {
		appenders = append(appenders, appender.IstioAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, "sidecars_check") {
		appenders = append(appenders, appender.SidecarsCheckAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, "health") {
		appenders = append(appenders, appender.HealthAppender{})
	}

	return appenders
}

func checkError(err error) {
	if err != nil {
		panic(err.Error)
	}
}
