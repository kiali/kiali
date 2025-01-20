package mesh

// Options.go holds the option settings for a single graph request.

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/business"
)

// The supported vendors
const (
	VendorCytoscape     string = "cytoscape"
	defaultConfigVendor string = VendorCytoscape
)

const (
	BoxByCluster            string = "cluster"
	BoxByNamespace          string = "namespace"
	defaultIncludeGateways  bool   = false
	defaultIncludeWaypoints bool   = false
)

// CommonOptions are those supplied to Vendors
type CommonOptions struct {
	IncludeGateways  bool
	IncludeWaypoints bool
	Params           url.Values // make available the raw query params for vendor-specific handling
	QueryTime        int64      // unix time in seconds
}

// ConfigOptions are those supplied to Config Vendors
type ConfigOptions struct {
	BoxBy string
	CommonOptions
	MeshName string
}

type RequestedAppenders struct {
	All           bool
	AppenderNames []string
}

// ClusterSensitiveKey is the recommended [string] type for maps keying on a cluster-sensitive name
type ClusterSensitiveKey = string

// GetClusterSensitiveKey returns a valid key for maps using a ClusterSensitiveKey
func GetClusterSensitiveKey(cluster, name string) ClusterSensitiveKey {
	return fmt.Sprintf("%s:%s", cluster, name)
}

type AccessibleNamespace struct {
	Cluster           string
	CreationTimestamp time.Time
	Name              string
}

// AccessibleNamepaces is a map with Key: ClusterSensitive namespace Key, Value: *AccessibleNamespace
type AccessibleNamespaces map[ClusterSensitiveKey]*AccessibleNamespace

// Options comprises all available options
type Options struct {
	AccessibleNamespaces AccessibleNamespaces
	Appenders            RequestedAppenders // requested appenders, nil if param not supplied
	ConfigVendor         string
	Namespaces           NamespaceInfoMap
	ConfigOptions
}

func NewOptions(r *http.Request, namespacesService *business.NamespaceService) Options {
	// path variables (0 or more will be set)
	// vars := mux.Vars(r)

	// query params
	params := r.URL.Query()
	var includeGateways bool
	var includeWaypoints bool
	var queryTime int64
	appenders := RequestedAppenders{All: true}
	configVendor := params.Get("configVendor")
	includeGatewaysString := params.Get("includeGateways")
	includeWaypointsString := params.Get("includeWaypoints")
	queryTimeString := params.Get("queryTime")

	if _, ok := params["appenders"]; ok {
		appenderNames := strings.Split(params.Get("appenders"), ",")
		for i, appenderName := range appenderNames {
			appenderNames[i] = strings.TrimSpace(appenderName)
		}
		appenders = RequestedAppenders{All: false, AppenderNames: appenderNames}
	}
	if configVendor == "" {
		configVendor = defaultConfigVendor
	} else if configVendor != VendorCytoscape {
		BadRequest(fmt.Sprintf("Invalid configVendor [%s]", configVendor))
	}
	if includeGatewaysString == "" {
		includeGateways = defaultIncludeGateways
	} else {
		var meshGatewaysErr error
		includeGateways, meshGatewaysErr = strconv.ParseBool(includeGatewaysString)
		if meshGatewaysErr != nil {
			BadRequest(fmt.Sprintf("Invalid meshGateways [%s]", includeGatewaysString))
		}
	}
	if includeWaypointsString == "" {
		includeWaypoints = defaultIncludeWaypoints
	} else {
		var meshWaypointsErr error
		includeWaypoints, meshWaypointsErr = strconv.ParseBool(includeWaypointsString)
		if meshWaypointsErr != nil {
			BadRequest(fmt.Sprintf("Invalid meshWaypoints [%s]", includeWaypointsString))
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

	// Process namespaces options:
	namespaceMap := NewNamespaceInfoMap()

	accessibleNamespaces := getAccessibleNamespaces(r.Context(), namespacesService)

	options := Options{
		AccessibleNamespaces: accessibleNamespaces,
		Appenders:            appenders,
		Namespaces:           namespaceMap,
		ConfigVendor:         configVendor,
		ConfigOptions: ConfigOptions{
			CommonOptions: CommonOptions{
				IncludeGateways:  includeGateways,
				IncludeWaypoints: includeWaypoints,
				Params:           params,
				QueryTime:        queryTime,
			},
		},
	}

	return options
}

// getAccessibleNamespaces returns a Set of all namespaces accessible to the user.
// The Set is implemented using the map convention. Each map entry is set to the
// creation timestamp of the namespace, to be used to ensure valid time ranges for
// queries against the namespace.
func getAccessibleNamespaces(ctx context.Context, namespacesService *business.NamespaceService) AccessibleNamespaces {
	// Get the namespaces
	namespaces, err := namespacesService.GetNamespaces(ctx)
	CheckError(err)

	// Create a map to store the namespaces
	accessibleNamespaces := make(AccessibleNamespaces)
	for _, namespace := range namespaces {
		accessibleNamespaces[GetClusterSensitiveKey(namespace.Cluster, namespace.Name)] = &AccessibleNamespace{
			Cluster:           namespace.Cluster,
			CreationTimestamp: namespace.CreationTimestamp,
			Name:              namespace.Name,
		}
	}

	return accessibleNamespaces
}
