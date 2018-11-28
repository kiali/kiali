// Package options holds the option settings for a single graph generation.
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
	GroupByApp                string = "app"
	GroupByNone               string = "none"
	GroupByVersion            string = "version"
	NamespaceIstio            string = "istio-system"
	VendorCytoscape           string = "cytoscape"
	defaultDuration           string = "10m"
	defaultGraphType          string = graph.GraphTypeWorkload
	defaultGroupBy            string = GroupByNone
	defaultIncludeIstio       bool   = false
	defaultInjectServiceNodes bool   = false
	defaultVendor             string = VendorCytoscape
)

const (
	graphKindNamespace string = "namespace"
	graphKindNode      string = "node"
)

// NodeOptions are those that apply only to node-detail graphs
type NodeOptions struct {
	App       string
	Namespace string
	Service   string
	Version   string
	Workload  string
}

// VendorOptions are those that are supplied to the vendor-specific generators.
type VendorOptions struct {
	GraphType string
	GroupBy   string
	Timestamp int64
}

// Options are all supported graph generation options.
type Options struct {
	AccessibleNamespaces map[string]time.Time
	Appenders            []appender.Appender
	Duration             time.Duration
	IncludeIstio         bool // include istio-system services. Ignored for istio-system ns. Default false.
	InjectServiceNodes   bool // inject destination service nodes between source and destination nodes.
	Namespaces           map[string]graph.NamespaceInfo
	QueryTime            int64 // unix time in seconds
	Vendor               string
	NodeOptions
	VendorOptions
}

func NewOptions(r *http.Request) Options {
	// path variables (0 or more will be set)
	vars := mux.Vars(r)
	app := vars["app"]
	namespace := vars["namespace"]
	service := vars["service"]
	version := vars["version"]
	workload := vars["workload"]

	// query params
	params := r.URL.Query()
	duration, durationErr := time.ParseDuration(params.Get("duration"))
	graphType := params.Get("graphType")
	groupBy := params.Get("groupBy")
	includeIstio, includeIstioErr := strconv.ParseBool(params.Get("includeIstio"))
	injectServiceNodes, injectServiceNodesErr := strconv.ParseBool(params.Get("injectServiceNodes"))
	namespaces := params.Get("namespaces") // csl of namespaces.
	queryTime, queryTimeErr := strconv.ParseInt(params.Get("queryTime"), 10, 64)
	vendor := params.Get("vendor")

	// Set defaults, if needed.
	if durationErr != nil {
		duration, _ = time.ParseDuration(defaultDuration)
	}
	if graphType != graph.GraphTypeApp && graphType != graph.GraphTypeService && graphType != graph.GraphTypeVersionedApp && graphType != graph.GraphTypeWorkload {
		graphType = defaultGraphType
	}
	if groupBy != GroupByApp && groupBy != GroupByNone && groupBy != GroupByVersion {
		groupBy = defaultGroupBy
	}
	if includeIstioErr != nil {
		includeIstio = defaultIncludeIstio
	}
	if injectServiceNodesErr != nil {
		injectServiceNodes = defaultInjectServiceNodes
	}
	if queryTimeErr != nil {
		queryTime = time.Now().Unix()
	}
	if vendor != VendorCytoscape {
		vendor = defaultVendor
	}

	// Process namespaces options:
	namespaceMap := make(map[string]graph.NamespaceInfo)
	accessibleNamespaces := getAccessibleNamespaces()

	// If path variable is set then it is the only relevant namespace (it's a node graph)
	// Else if namespaces query param is set it specifies the relevant namespaces
	// Else the request is for all [accessible] namespaces
	if namespace != "" {
		namespaces = namespace
	}

	if namespaces == "" {
		for accessibleNamespace, creationTime := range accessibleNamespaces {
			// The istio-system namespace is only shown when explicitly requested. Note that the
			// 'includeIstio' option doesn't apply here, that option affects what is done in
			// non-istio-system namespaces.
			if accessibleNamespace != NamespaceIstio {
				namespaceMap[accessibleNamespace] = graph.NamespaceInfo{
					Name:     accessibleNamespace,
					Duration: resolveNamespaceDuration(creationTime, duration, queryTime),
				}
			}
		}
	} else {
		for _, namespaceToken := range strings.Split(namespaces, ",") {
			namespaceToken = strings.TrimSpace(namespaceToken)
			if creationTime, found := accessibleNamespaces[namespaceToken]; found {
				namespaceMap[namespaceToken] = graph.NamespaceInfo{
					Name:     namespaceToken,
					Duration: resolveNamespaceDuration(creationTime, duration, queryTime),
				}
			} else {
				// TODO: Should this return Forbidden status?
				checkError(errors.New(fmt.Sprintf("Requested namespace [%s] is not accessible.", namespaceToken)))
			}
		}
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
		Namespaces:           namespaceMap,
		QueryTime:            queryTime,
		Vendor:               vendor,
		NodeOptions: NodeOptions{
			App:       app,
			Namespace: namespace,
			Service:   service,
			Version:   version,
			Workload:  workload,
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

// GetGraphKind will return the kind of graph represented by the options.
func (o *Options) GetGraphKind() string {
	if o.NodeOptions.App != "" ||
		o.NodeOptions.Version != "" ||
		o.NodeOptions.Workload != "" ||
		o.NodeOptions.Service != "" {
		return graphKindNode
	} else {
		return graphKindNamespace
	}
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
	if csl == AppenderAll || strings.Contains(csl, appender.DeadNodeAppenderName) || strings.Contains(csl, "dead_node") {
		a := appender.DeadNodeAppender{
			AccessibleNamespaces: o.AccessibleNamespaces,
		}
		appenders = append(appenders, a)
	}
	if csl == AppenderAll || strings.Contains(csl, appender.ResponseTimeAppenderName) || strings.Contains(csl, "response_time") {
		quantile := appender.DefaultQuantile
		if _, ok := params["responseTimeQuantile"]; ok {
			if responseTimeQuantile, err := strconv.ParseFloat(params.Get("responseTimeQuantile"), 64); err == nil {
				quantile = responseTimeQuantile
			}
		}
		a := appender.ResponseTimeAppender{
			Quantile:           quantile,
			GraphType:          o.GraphType,
			InjectServiceNodes: o.InjectServiceNodes,
			IncludeIstio:       o.IncludeIstio,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
		}
		appenders = append(appenders, a)
	}
	if csl == AppenderAll || strings.Contains(csl, appender.SecurityPolicyAppenderName) || strings.Contains(csl, "security_policy") {
		a := appender.SecurityPolicyAppender{
			GraphType:          o.GraphType,
			IncludeIstio:       o.IncludeIstio,
			InjectServiceNodes: o.InjectServiceNodes,
			Namespaces:         o.Namespaces,
			QueryTime:          o.QueryTime,
		}
		appenders = append(appenders, a)
	}
	if csl == AppenderAll || strings.Contains(csl, appender.UnusedNodeAppenderName) || strings.Contains(csl, "unused_node") {
		hasNodeOptions := o.App != "" || o.Workload != "" || o.Service != ""
		appenders = append(appenders, appender.UnusedNodeAppender{
			GraphType:   o.GraphType,
			IsNodeGraph: hasNodeOptions,
		})
	}
	if csl == AppenderAll || strings.Contains(csl, appender.IstioAppenderName) || strings.Contains(csl, "istio") {
		appenders = append(appenders, appender.IstioAppender{})
	}
	if csl == AppenderAll || strings.Contains(csl, appender.SidecarsCheckAppenderName) || strings.Contains(csl, "sidecars_check") {
		appenders = append(appenders, appender.SidecarsCheckAppender{})
	}

	return appenders
}

// getAccessibleNamespaces returns a Set of all namespaces accessible to the user.
// The Set is implemented using the map convention. Each map entry is set to the
// creation timestamp of the namespace, to be used to ensure valid time ranges for
// queries against the namespace.
func getAccessibleNamespaces() map[string]time.Time {
	// Get the namespaces
	business, err := business.Get()
	checkError(err)

	namespaces, err := business.Namespace.GetNamespaces()
	checkError(err)

	// Create a map to store the namespaces
	namespaceMap := make(map[string]time.Time)
	for _, namespace := range namespaces {
		namespaceMap[namespace.Name] = namespace.CreationTimestamp
	}

	return namespaceMap
}

func checkError(err error) {
	if err != nil {
		panic(err.Error)
	}
}

// resolveNamespaceDuration determines if, given queryTime, the requestedRange won't lead to
// querying data before nsCreationTime. If this is the case, resolveNamespaceDuration returns
// and adjusted range. Else, the original requestedRange is returned.
func resolveNamespaceDuration(nsCreationTime time.Time, requestedRange time.Duration, queryTime int64) time.Duration {
	var referenceTime time.Time
	resolvedBound := requestedRange

	if !nsCreationTime.IsZero() {
		if queryTime != 0 {
			referenceTime = time.Unix(queryTime, 0)
		} else {
			referenceTime = time.Now()
		}

		nsLifetime := referenceTime.Sub(nsCreationTime)
		if nsLifetime < resolvedBound {
			resolvedBound = nsLifetime
		}
	}

	return resolvedBound
}
