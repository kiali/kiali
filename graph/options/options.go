// Options package holds the option settings for a single graph generation.
package options

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/appender"
	"github.com/kiali/kiali/services/models"
)

const (
	AppenderAll          string = "_all_"
	GroupByVersion       string = "version"
	NamespaceAll         string = "all"
	NamespaceIstioSystem string = "istio-system"
	defaultDuration      string = "10m"
	defaultGraphType     string = graph.GraphTypeAppPreferred
	defaultGroupBy       string = GroupByVersion
	defaultMetric        string = "istio_requests_total"
	defaultVendor        string = "cytoscape"
	defaultVersioned     bool   = true
)

// VendorOptions are those that are supplied to the vendor-specific generators.
type VendorOptions struct {
	GraphType string
	GroupBy   string
	Timestamp int64
	Versioned bool
}

// Options are all supported graph generation options.
type Options struct {
	Appenders    []appender.Appender
	Duration     time.Duration
	IncludeIstio bool // include istio-system services. Ignored for istio-system ns. Default false.
	Metric       string
	Namespaces   []string
	QueryTime    int64 // unix time in seconds
	Workload     string
	Vendor       string
	VendorOptions
}

func NewOptions(r *http.Request) Options {
	// path variables
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	workload := vars["workload"]

	// query params
	params := r.URL.Query()
	duration, durationErr := time.ParseDuration(params.Get("duration"))
	includeIstio, includeIstioErr := strconv.ParseBool(params.Get("includeIstio"))
	graphType := params.Get("graphType")
	groupBy := params.Get("groupBy")
	metric := params.Get("metric")
	queryTime, queryTimeErr := strconv.ParseInt(params.Get("queryTime"), 10, 64)
	namespaces := params.Get("namespaces") // csl of namespaces. Overrides namespace path param if set
	vendor := params.Get("vendor")
	versioned, versionedErr := strconv.ParseBool(params.Get("versioned"))

	var namespaceNames []string
	fetchNamespaces := namespaces == NamespaceAll || (namespaces == "" && (namespace == NamespaceAll))
	if fetchNamespaces {
		namespaces, err := models.GetNamespaces()
		checkError(err)

		for _, namespace := range namespaces {
			// The istio-system namespace is only shown when explicitly requested. Note that the
			// 'includeIstio' option doesn't apply here, that option affects what is done in
			// non-istio-system namespaces.
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
		duration, _ = time.ParseDuration(defaultDuration)
	}
	if includeIstioErr != nil {
		includeIstio = false
	}
	if "" == graphType {
		graphType = defaultGraphType
	}
	if "" == groupBy {
		groupBy = defaultGroupBy
	}
	if "" == metric {
		metric = defaultMetric
	}
	if queryTimeErr != nil {
		queryTime = time.Now().Unix()
	}
	if "" == vendor {
		vendor = defaultVendor
	}
	if versionedErr != nil {
		versioned = defaultVersioned
	}

	options := Options{
		Duration:     duration,
		IncludeIstio: includeIstio,
		Metric:       metric,
		Namespaces:   namespaceNames,
		QueryTime:    queryTime,
		Vendor:       vendor,
		Workload:     workload,
		VendorOptions: VendorOptions{
			GraphType: graphType,
			GroupBy:   groupBy,
			Timestamp: queryTime,
			Versioned: versioned,
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
	// To reduce processing, next run appenders that don't apply to unused services
	// Add orphan (unused) services
	// Run remaining appenders
	if csl == AppenderAll || strings.Contains(csl, "dead_node") {
		appenders = append(appenders, appender.DeadNodeAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, "response_time") {
		quantile := appender.DefaultQuantile
		if _, ok := params["responseTimeQuantile"]; ok {
			if responseTimeQuantile, err := strconv.ParseFloat(params.Get("responseTimeQuantile"), 64); err == nil {
				quantile = responseTimeQuantile
			}
		}
		a := appender.ResponseTimeAppender{
			Duration:  o.Duration,
			Quantile:  quantile,
			QueryTime: o.QueryTime,
			GraphType: o.GraphType,
			Versioned: o.Versioned,
		}
		appenders = append(appenders, a)
	}
	if csl == AppenderAll || strings.Contains(csl, "unused_service") {
		//		appenders = append(appenders, appender.UnusedServiceAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, "istio") {
		//appenders = append(appenders, appender.IstioAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, "sidecars_check") {
		//appenders = append(appenders, appender.SidecarsCheckAppender{})
	}

	return appenders
}

func checkError(err error) {
	if err != nil {
		panic(err.Error)
	}
}
