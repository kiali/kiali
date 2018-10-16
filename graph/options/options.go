// Options package holds the option settings for a single graph generation.
package options

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/appender"
)

const (
	AppenderAll               string = "_all_"
	GroupByVersion            string = "version"
	NamespaceAll              string = "all"
	NamespaceIstioSystem      string = "istio-system"
	defaultDuration           string = "10m"
	defaultGraphType          string = graph.GraphTypeWorkload
	defaultGroupBy            string = GroupByVersion
	defaultIncludeIstio       bool   = false
	defaultInjectServiceNodes bool   = false
	defaultVendor             string = "cytoscape"
)

// NodeOptions are those that apply only to node-detail graphs
type NodeOptions struct {
	App      string
	Service  string
	Version  string
	Workload string
}

// VendorOptions are those that are supplied to the vendor-specific generators.
type VendorOptions struct {
	GraphType string
	GroupBy   string
	Timestamp int64
}

// Options are all supported graph generation options.
type Options struct {
	AccessibleNamespaces map[string]bool
	Appenders            []appender.Appender
	Duration             time.Duration
	IncludeIstio         bool // include istio-system services. Ignored for istio-system ns. Default false.
	InjectServiceNodes   bool // inject destination service nodes between source and destination nodes.
	Namespaces           []string
	QueryTime            int64 // unix time in seconds
	Vendor               string
	NodeOptions
	VendorOptions
}

func NewOptions(r *http.Request) Options {
	// path variables
	vars := mux.Vars(r)
	app := vars["app"]
	version := vars["version"]
	namespace := vars["namespace"]
	service := vars["service"]
	workload := vars["workload"]

	// query params
	params := r.URL.Query()
	duration, durationErr := time.ParseDuration(params.Get("duration"))
	includeIstio, includeIstioErr := strconv.ParseBool(params.Get("includeIstio"))
	injectServiceNodes, injectServiceNodesErr := strconv.ParseBool(params.Get("injectServiceNodes"))
	graphType := params.Get("graphType")
	groupBy := params.Get("groupBy")
	queryTime, queryTimeErr := strconv.ParseInt(params.Get("queryTime"), 10, 64)
	namespaces := params.Get("namespaces") // csl of namespaces. Overrides namespace path param if set
	vendor := params.Get("vendor")

	accessibleNamespaces := getAccessibleNamespaces()

	var namespaceNames []string
	fetchNamespaces := namespaces == NamespaceAll || (namespaces == "" && (namespace == NamespaceAll))
	if fetchNamespaces {
		for namespace, _ := range accessibleNamespaces {
			// The istio-system namespace is only shown when explicitly requested. Note that the
			// 'includeIstio' option doesn't apply here, that option affects what is done in
			// non-istio-system namespaces.
			if namespace != NamespaceIstioSystem {
				namespaceNames = append(namespaceNames, namespace)
			}
		}
	} else if namespaces != "" {
		namespaceNames = strings.Split(namespaces, ",")
		for _, namespaceName := range namespaceNames {
			if _, found := accessibleNamespaces[namespaceName]; !found {
				checkError(errors.New(fmt.Sprintf("Requested namespace [%s] is not accessible.", namespaceName)))
			}
		}
	} else if namespace != "" {
		if _, found := accessibleNamespaces[namespace]; !found {
			checkError(errors.New(fmt.Sprintf("Requested namespace [%s] is not accessible.", namespace)))
		} else {
			namespaceNames = []string{namespace}
		}
	} else {
		// note, some global handlers do not require any namespaces
		namespaceNames = []string{}
	}

	if durationErr != nil {
		duration, _ = time.ParseDuration(defaultDuration)
	}
	if includeIstioErr != nil {
		includeIstio = defaultIncludeIstio
	}
	if injectServiceNodesErr != nil {
		injectServiceNodes = defaultInjectServiceNodes
	}
	if "" == graphType {
		graphType = defaultGraphType
	}
	if "" == groupBy {
		groupBy = defaultGroupBy
	}
	if queryTimeErr != nil {
		queryTime = time.Now().Unix()
	}
	if "" == vendor {
		vendor = defaultVendor
	}

	// Service graphs require service injection
	if graphType == graph.GraphTypeService {
		injectServiceNodes = true
	}

	options := Options{
		AccessibleNamespaces: accessibleNamespaces,
		Duration:             duration,
		IncludeIstio:         includeIstio,
		InjectServiceNodes:   injectServiceNodes,
		Namespaces:           namespaceNames,
		QueryTime:            queryTime,
		Vendor:               vendor,
		NodeOptions: NodeOptions{
			App:      app,
			Service:  service,
			Version:  version,
			Workload: workload,
		},
		VendorOptions: VendorOptions{
			GraphType: graphType,
			GroupBy:   groupBy,
			Timestamp: queryTime,
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
			Duration:           o.Duration,
			Quantile:           quantile,
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			IncludeIstio:       o.IncludeIstio,
			QueryTime:          o.QueryTime,
		}
		appenders = append(appenders, a)
	}
	if csl == AppenderAll || strings.Contains(csl, "security_policy") {
		a := appender.SecurityPolicyAppender{
			Duration:     o.Duration,
			GraphType:    o.GraphType,
			IncludeIstio: o.IncludeIstio,
			QueryTime:    o.QueryTime,
		}
		appenders = append(appenders, a)
	}
	if csl == AppenderAll || strings.Contains(csl, "unused_node") {
		hasNodeOptions := o.App != "" || o.Workload != "" || o.Service != ""
		appenders = append(appenders, appender.UnusedNodeAppender{
			GraphType:   o.GraphType,
			IsNodeGraph: hasNodeOptions,
		})
	}
	if csl == AppenderAll || strings.Contains(csl, "istio") {
		appenders = append(appenders, appender.IstioAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, "sidecars_check") {
		appenders = append(appenders, appender.SidecarsCheckAppender{})
	}

	return appenders
}

// getAccessibleNamespaces returns a Set of all namespaces accessible to the user.
// The Set is implemented using the map[string]bool convention.
func getAccessibleNamespaces() map[string]bool {
	// Get the namespaces
	business, err := business.Get()
	checkError(err)

	namespaces, err := business.Namespace.GetNamespaces()
	checkError(err)

	// Create a map to store the namespaces
	namespaceMap := make(map[string]bool)
	for _, namespace := range namespaces {
		namespaceMap[namespace.Name] = true
	}

	return namespaceMap
}

func checkError(err error) {
	if err != nil {
		panic(err.Error)
	}
}
