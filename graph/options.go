package graph

// Options.go holds the option settings for a single graph request.

import (
	"context"
	"fmt"
	net_http "net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// The supported vendors
const (
	VendorCommon           string = "common"
	VendorIstio            string = "istio"
	defaultConfigVendor    string = VendorCommon
	defaultTelemetryVendor string = VendorIstio
)

const (
	AmbientTrafficNone        string = "none"
	AmbientTrafficTotal       string = "total"
	AmbientTrafficWaypoint    string = "waypoint"
	AmbientTrafficZtunnel     string = "ztunnel"
	BoxByApp                  string = "app"
	BoxByCluster              string = "cluster"
	BoxByNamespace            string = "namespace"
	BoxByNone                 string = "none"
	RateNone                  string = "none"
	RateReceived              string = "received" // tcp bytes received, grpc response messages, etc
	RateRequests              string = "requests" // request count
	RateSent                  string = "sent"     // tcp bytes sent, grpc request messages, etc
	RateTotal                 string = "total"    // Sent+Received
	defaultAmbientTraffic     string = AmbientTrafficTotal
	defaultBoxBy              string = BoxByNone
	defaultDuration           string = "10m"
	defaultGraphType          string = GraphTypeWorkload
	defaultIncludeIdleEdges   bool   = false
	defaultInjectServiceNodes bool   = false
	defaultRateGrpc           string = RateRequests
	defaultRateHttp           string = RateRequests
	defaultRateTcp            string = RateSent
)

const (
	graphKindNamespace string = "namespace"
	graphKindNode      string = "node"
)

// NodeOptions are those that apply only to node-detail graphs
type NodeOptions struct {
	Aggregate      string
	AggregateValue string
	App            string
	Cluster        string
	Namespace      NamespaceInfo
	Service        string
	Version        string
	Workload       string
}

// CommonOptions are those supplied to Telemetry and Config Vendors
type CommonOptions struct {
	Duration  time.Duration
	GraphType string
	Params    url.Values // make available the raw query params for vendor-specific handling
	QueryTime int64      // unix time in seconds
}

// ConfigOptions are those supplied to Config Vendors
type ConfigOptions struct {
	BoxBy string
	CommonOptions
}

type RequestedAppenders struct {
	All           bool
	AppenderNames []string
}

type RequestedRates struct {
	Ambient string
	Grpc    string
	Http    string
	Tcp     string
}

// ClusterSensitiveKey is the recommended [string] type for maps keying on a cluster-sensitive name
type ClusterSensitiveKey = string

// GetClusterSensitiveKey returns a valid key for maps using a ClusterSensitiveKey
func GetClusterSensitiveKey(cluster, name string) ClusterSensitiveKey {
	return cluster + ":" + name
}

type AccessibleNamespace struct {
	Cluster           string
	CreationTimestamp time.Time
	IsAmbient         bool
	Name              string
}

// AccessibleNamepaces is a map with Key: ClusterSensitive namespace Key, Value: *AccessibleNamespace
type AccessibleNamespaces map[ClusterSensitiveKey]*AccessibleNamespace

// TelemetryOptions are those supplied to Telemetry Vendors
type TelemetryOptions struct {
	AccessibleNamespaces AccessibleNamespaces
	Appenders            RequestedAppenders // requested appenders, nil if param not supplied
	IncludeIdleEdges     bool               // include edges with request rates of 0
	InjectServiceNodes   bool               // inject destination service nodes between source and destination nodes.
	Namespaces           NamespaceInfoMap
	Rates                RequestedRates
	CommonOptions
	NodeOptions
}

// Options comprises all available options
type Options struct {
	ConfigVendor    string
	TelemetryVendor string
	ConfigOptions
	TelemetryOptions
}

func NewOptions(r *net_http.Request, namespacesService *business.NamespaceService) Options {
	// path variables (0 or more will be set)
	vars := mux.Vars(r)
	aggregate := vars["aggregate"]
	aggregateValue := vars["aggregateValue"]
	app := vars["app"]
	namespace := vars["namespace"]
	service := vars["service"]
	version := vars["version"]
	workload := vars["workload"]

	// query params
	params := r.URL.Query()
	var duration model.Duration
	var includeIdleEdges bool
	var injectServiceNodes bool
	var queryTime int64
	ambientTraffic := params.Get("ambientTraffic")
	appenders := RequestedAppenders{All: true}
	boxBy := params.Get("boxBy")
	// @TODO requires refactoring to use clusterNameFromQuery
	cluster := params.Get("clusterName")
	configVendor := params.Get("configVendor")
	durationString := params.Get("duration")
	graphType := params.Get("graphType")
	includeIdleEdgesString := params.Get("includeIdleEdges")
	injectServiceNodesString := params.Get("injectServiceNodes")
	namespaces := params.Get("namespaces") // csl of namespaces
	queryTimeString := params.Get("queryTime")
	rateGrpc := params.Get("rateGrpc")
	rateHttp := params.Get("rateHttp")
	rateTcp := params.Get("rateTcp")
	telemetryVendor := params.Get("telemetryVendor")

	if _, ok := params["appenders"]; ok {
		appenderNames := strings.Split(params.Get("appenders"), ",")
		for i, appenderName := range appenderNames {
			appenderNames[i] = strings.TrimSpace(appenderName)
		}
		appenders = RequestedAppenders{All: false, AppenderNames: appenderNames}
	}
	if cluster == "" {
		cluster = Unknown
	}
	if configVendor == "" {
		configVendor = defaultConfigVendor
	} else if configVendor != VendorCommon {
		BadRequest(fmt.Sprintf("Invalid configVendor [%s]", configVendor))
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
	// service graphs do not inject service nodes
	if graphType == GraphTypeService {
		injectServiceNodesString = "false"
	}
	// app node graphs require an app graph type
	if app != "" && graphType != GraphTypeApp && graphType != GraphTypeVersionedApp {
		BadRequest(fmt.Sprintf("Invalid graphType [%s]. This node detail graph supports only graphType app or versionedApp.", graphType))
	}
	if boxBy == "" {
		boxBy = defaultBoxBy
	} else {
		for _, box := range strings.Split(boxBy, ",") {
			switch strings.TrimSpace(box) {
			case BoxByApp:
				continue
			case BoxByCluster:
				continue
			case BoxByNamespace:
				continue
			default:
				BadRequest(fmt.Sprintf("Invalid boxBy [%s]", boxBy))
			}
		}
	}
	if includeIdleEdgesString == "" {
		includeIdleEdges = defaultIncludeIdleEdges
	} else {
		var includeIdleEdgesErr error
		includeIdleEdges, includeIdleEdgesErr = strconv.ParseBool(includeIdleEdgesString)
		if includeIdleEdgesErr != nil {
			BadRequest(fmt.Sprintf("Invalid includeIdleEdges [%s]", includeIdleEdgesString))
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
	if telemetryVendor == "" {
		telemetryVendor = defaultTelemetryVendor
	} else if telemetryVendor != VendorIstio {
		BadRequest(fmt.Sprintf("Invalid telemetryVendor [%s]", telemetryVendor))
	}

	// Process namespaces options:
	namespaceMap := NewNamespaceInfoMap()
	accessibleNamespaces := getAccessibleNamespaces(r.Context(), namespacesService)

	// If path variable is set then it is the only relevant namespace (it's a node graph)
	// Else if namespaces query param is set it specifies the relevant namespaces
	// Else error, at least one namespace is required.
	if namespace != "" {
		namespaces = namespace
	}

	if namespaces == "" {
		BadRequest("At least one namespace must be specified via the namespaces query parameter.")
	}

	for _, namespaceName := range strings.Split(namespaces, ",") {
		namespaceName = strings.TrimSpace(namespaceName)
		var earliestCreationTimestamp *time.Time
		var isAmbient bool
		for _, an := range accessibleNamespaces {
			if namespaceName == an.Name {
				if nil == earliestCreationTimestamp || earliestCreationTimestamp.After(an.CreationTimestamp) {
					earliestCreationTimestamp = &an.CreationTimestamp
				}
				isAmbient = an.IsAmbient
			}
		}
		if nil == earliestCreationTimestamp {
			Forbidden(fmt.Sprintf("Requested namespace [%s] is not accessible.", namespaceName))
		} else {
			namespaceMap[namespaceName] = NamespaceInfo{
				Name:      namespaceName,
				Duration:  getSafeNamespaceDuration(r, namespaceName, *earliestCreationTimestamp, time.Duration(duration), queryTime),
				IsAmbient: isAmbient,
				IsIstio:   config.IsIstioNamespace(namespaceName),
			}
		}
	}

	// Process Rate Options

	rates := RequestedRates{
		Ambient: defaultAmbientTraffic,
		Grpc:    defaultRateGrpc,
		Http:    defaultRateHttp,
		Tcp:     defaultRateTcp,
	}

	if ambientTraffic != "" {
		switch ambientTraffic {
		case AmbientTrafficNone:
			rates.Ambient = AmbientTrafficNone
		case AmbientTrafficTotal:
			rates.Ambient = AmbientTrafficTotal
		case AmbientTrafficWaypoint:
			rates.Ambient = AmbientTrafficWaypoint
		case AmbientTrafficZtunnel:
			rates.Ambient = AmbientTrafficZtunnel
		default:
			BadRequest(fmt.Sprintf("Invalid Ambient Traffic [%s]", rates.Ambient))
		}
	}

	if rateGrpc != "" {
		switch rateGrpc {
		case RateNone:
			rates.Grpc = RateNone
		case RateReceived:
			rates.Grpc = RateReceived
		case RateRequests:
			rates.Grpc = RateRequests
		case RateSent:
			rates.Grpc = RateSent
		case RateTotal:
			rates.Grpc = RateTotal
		default:
			BadRequest(fmt.Sprintf("Invalid gRPC Rate [%s]", rateGrpc))
		}
	}

	if rateHttp != "" {
		switch rateHttp {
		case RateNone:
			rates.Http = RateNone
		case RateRequests:
			rates.Http = RateRequests
		default:
			BadRequest(fmt.Sprintf("Invalid HTTP Rate [%s]", rateHttp))
		}
	}

	if rateTcp != "" {
		switch rateTcp {
		case RateNone:
			rates.Tcp = RateNone
		case RateReceived:
			rates.Tcp = RateReceived
		case RateSent:
			rates.Tcp = RateSent
		case RateTotal:
			rates.Tcp = RateTotal
		default:
			BadRequest(fmt.Sprintf("Invalid TCP Rate [%s]", rateTcp))
		}
	}

	// Service graphs require service injection
	if graphType == GraphTypeService {
		injectServiceNodes = true
	}

	options := Options{
		ConfigVendor:    configVendor,
		TelemetryVendor: telemetryVendor,
		ConfigOptions: ConfigOptions{
			BoxBy: boxBy,
			CommonOptions: CommonOptions{
				Duration:  time.Duration(duration),
				GraphType: graphType,
				Params:    params,
				QueryTime: queryTime,
			},
		},
		TelemetryOptions: TelemetryOptions{
			AccessibleNamespaces: accessibleNamespaces,
			Appenders:            appenders,
			IncludeIdleEdges:     includeIdleEdges,
			InjectServiceNodes:   injectServiceNodes,
			Namespaces:           namespaceMap,
			Rates:                rates,
			CommonOptions: CommonOptions{
				Duration:  time.Duration(duration),
				GraphType: graphType,
				Params:    params,
				QueryTime: queryTime,
			},
			NodeOptions: NodeOptions{
				Aggregate:      aggregate,
				AggregateValue: aggregateValue,
				App:            app,
				Cluster:        cluster,
				Namespace:      namespaceMap[namespace],
				Service:        service,
				Version:        version,
				Workload:       workload,
			},
		},
	}

	return options
}

// GetGraphKind will return the kind of graph represented by the options.
func (o *TelemetryOptions) GetGraphKind() string {
	if o.NodeOptions.App != "" ||
		o.NodeOptions.Version != "" ||
		o.NodeOptions.Workload != "" ||
		o.NodeOptions.Service != "" {
		return graphKindNode
	}
	return graphKindNamespace
}

// getAccessibleNamespaces returns a Set of all namespaces accessible to the user.
// The Set is implemented using the map convention. Each map entry is set to the
// creation timestamp of the namespace, to be used to ensure valid time ranges for
// queries against the namespace.
func getAccessibleNamespaces(ctx context.Context, namespacesService *business.NamespaceService) AccessibleNamespaces {
	namespaces, err := namespacesService.GetNamespaces(ctx)
	CheckError(err)

	// Create a map to store the namespaces
	accessibleNamespaces := make(AccessibleNamespaces)
	for _, namespace := range namespaces {
		accessibleNamespaces[GetClusterSensitiveKey(namespace.Cluster, namespace.Name)] = &AccessibleNamespace{
			Cluster:           namespace.Cluster,
			CreationTimestamp: namespace.CreationTimestamp,
			IsAmbient:         namespace.IsAmbient,
			Name:              namespace.Name,
		}
	}

	return accessibleNamespaces
}

// getSafeNamespaceDuration returns a safe duration for the query. If queryTime-requestedDuration > namespace
// creation time just return the requestedDuration.  Otherwise reduce the duration as needed to ensure the
// namespace existed for the entire time range.  An error is generated if no safe duration exists (i.e. the
// queryTime precedes the namespace).
func getSafeNamespaceDuration(r *net_http.Request, ns string, nsCreationTime time.Time, requestedDuration time.Duration, queryTime int64) time.Duration {
	var endTime time.Time
	safeDuration := requestedDuration

	if !nsCreationTime.IsZero() {
		if queryTime != 0 {
			endTime = time.Unix(queryTime, 0)
		} else {
			endTime = time.Now()
		}

		nsLifetime := endTime.Sub(nsCreationTime)
		if nsLifetime <= 0 {
			BadRequest(fmt.Sprintf("Namespace [%s] did not exist at requested queryTime [%v]", ns, endTime))
		}

		if nsLifetime < safeDuration {
			safeDuration = nsLifetime
			log.FromRequest(r).Debug().Msgf("Reducing requestedDuration [%v] to safeDuration [%v]", requestedDuration, safeDuration)
		}
	}

	return safeDuration
}
