// Package options holds the option settings for a single graph generation.
package graph

import (
	"fmt"
	net_http "net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/business"
)

const (
	GroupByApp                string = "app"
	GroupByNone               string = "none"
	GroupByVersion            string = "version"
	NamespaceIstio            string = "istio-system"
	VendorCytoscape           string = "cytoscape"
	defaultDuration           string = "10m"
	defaultGraphType          string = GraphTypeWorkload
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
	Duration  time.Duration
	GraphType string
	GroupBy   string
	QueryTime int64 // unix time in seconds
}

// Options are all supported graph generation options.
type Options struct {
	AccessibleNamespaces map[string]time.Time
	Appenders            []string // nil if param not supplied
	IncludeIstio         bool     // include istio-system services. Ignored for istio-system ns. Default false.
	InjectServiceNodes   bool     // inject destination service nodes between source and destination nodes.
	Namespaces           map[string]NamespaceInfo
	Params               url.Values
	Vendor               string
	NodeOptions
	VendorOptions
}

func NewOptions(r *net_http.Request) Options {
	// path variables (0 or more will be set)
	vars := mux.Vars(r)
	app := vars["app"]
	namespace := vars["namespace"]
	service := vars["service"]
	version := vars["version"]
	workload := vars["workload"]

	// query params
	params := r.URL.Query()
	var duration model.Duration
	var includeIstio bool
	var injectServiceNodes bool
	var queryTime int64
	appenders := []string(nil)
	durationString := params.Get("duration")
	graphType := params.Get("graphType")
	groupBy := params.Get("groupBy")
	includeIstioString := params.Get("includeIstio")
	injectServiceNodesString := params.Get("injectServiceNodes")
	namespaces := params.Get("namespaces") // csl of namespaces
	queryTimeString := params.Get("queryTime")
	vendor := params.Get("vendor")

	if _, ok := params["appenders"]; ok {
		appenders = strings.Split(params.Get("appenders"), ",")
		for i, v := range appenders {
			appenders[i] = strings.TrimSpace(v)
		}
	}
	if durationString == "" {
		duration, _ = model.ParseDuration(defaultDuration)
	} else {
		var durationErr error
		duration, durationErr = model.ParseDuration(durationString)
		if durationErr != nil {
			BadRequest(fmt.Sprintf("Invalid duration [%s]", durationString))
		}
	}
	if graphType == "" {
		graphType = defaultGraphType
	} else if graphType != GraphTypeApp && graphType != GraphTypeService && graphType != GraphTypeVersionedApp && graphType != GraphTypeWorkload {
		BadRequest(fmt.Sprintf("Invalid graphType [%s]", graphType))
	}
	// app node graphs require an app graph type
	if app != "" && graphType != GraphTypeApp && graphType != GraphTypeVersionedApp {
		BadRequest(fmt.Sprintf("Invalid graphType [%s]. This node detail graph supports only graphType app or versionedApp.", graphType))
	}
	if groupBy == "" {
		groupBy = defaultGroupBy
	} else if groupBy != GroupByApp && groupBy != GroupByNone && groupBy != GroupByVersion {
		BadRequest(fmt.Sprintf("Invalid groupBy [%s]", groupBy))
	}
	if includeIstioString == "" {
		includeIstio = defaultIncludeIstio
	} else {
		var includeIstioErr error
		includeIstio, includeIstioErr = strconv.ParseBool(includeIstioString)
		if includeIstioErr != nil {
			BadRequest(fmt.Sprintf("Invalid includeIstio [%s]", includeIstioString))
		}
	}
	if injectServiceNodesString == "" {
		injectServiceNodes = defaultInjectServiceNodes
	} else {
		var injectServiceNodesErr error
		injectServiceNodes, injectServiceNodesErr = strconv.ParseBool(injectServiceNodesString)
		if injectServiceNodesErr != nil {
			BadRequest(fmt.Sprintf("Invalid injectServiceNodes [%s]", injectServiceNodesString))
		}
	}
	if queryTimeString == "" {
		queryTime = time.Now().Unix()
	} else {
		var queryTimeErr error
		queryTime, queryTimeErr = strconv.ParseInt(queryTimeString, 10, 64)
		if queryTimeErr != nil {
			BadRequest(fmt.Sprintf("Invalid queryTime [%s]", queryTimeString))
		}
	}
	if vendor == "" {
		vendor = defaultVendor
	} else if vendor != VendorCytoscape {
		BadRequest(fmt.Sprintf("Invalid vendor [%s]", vendor))
	}

	// Process namespaces options:
	namespaceMap := make(map[string]NamespaceInfo)

	tokenContext := r.Context().Value("token")
	var token string
	if tokenContext != nil {
		if tokenString, ok := tokenContext.(string); !ok {
			Error("token is not of type string")
		} else {
			token = tokenString
		}
	} else {
		Error("token missing in request context")
	}

	accessibleNamespaces := getAccessibleNamespaces(token)

	// If path variable is set then it is the only relevant namespace (it's a node graph)
	// Else if namespaces query param is set it specifies the relevant namespaces
	// Else error, at least one namespace is required.
	if namespace != "" {
		namespaces = namespace
	}

	if namespaces == "" {
		BadRequest(fmt.Sprintf("At least one namespace must be specified via the namespaces query parameter."))
	}

	for _, namespaceToken := range strings.Split(namespaces, ",") {
		namespaceToken = strings.TrimSpace(namespaceToken)
		if creationTime, found := accessibleNamespaces[namespaceToken]; found {
			namespaceMap[namespaceToken] = NamespaceInfo{
				Name:     namespaceToken,
				Duration: resolveNamespaceDuration(creationTime, time.Duration(duration), queryTime),
			}
		} else {
			Forbidden(fmt.Sprintf("Requested namespace [%s] is not accessible.", namespaceToken))
		}
	}

	// Service graphs require service injection
	if graphType == GraphTypeService {
		injectServiceNodes = true
	}

	options := Options{
		AccessibleNamespaces: accessibleNamespaces,
		Appenders:            appenders,
		IncludeIstio:         includeIstio,
		InjectServiceNodes:   injectServiceNodes,
		Namespaces:           namespaceMap,
		Params:               params,
		Vendor:               vendor,
		NodeOptions: NodeOptions{
			App:       app,
			Namespace: namespace,
			Service:   service,
			Version:   version,
			Workload:  workload,
		},
		VendorOptions: VendorOptions{
			Duration:  time.Duration(duration),
			GraphType: graphType,
			GroupBy:   groupBy,
			QueryTime: queryTime,
		},
	}

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

// getAccessibleNamespaces returns a Set of all namespaces accessible to the user.
// The Set is implemented using the map convention. Each map entry is set to the
// creation timestamp of the namespace, to be used to ensure valid time ranges for
// queries against the namespace.
func getAccessibleNamespaces(token string) map[string]time.Time {
	// Get the namespaces
	business, err := business.Get(token)
	CheckError(err)

	namespaces, err := business.Namespace.GetNamespaces()
	CheckError(err)

	// Create a map to store the namespaces
	namespaceMap := make(map[string]time.Time)
	for _, namespace := range namespaces {
		namespaceMap[namespace.Name] = namespace.CreationTimestamp
	}

	return namespaceMap
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
