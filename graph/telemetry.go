package graph

import (
	"github.com/kiali/kiali/prometheus"
)

// TelemetryVendor is an interface that must be satisfied for each telemetry implementation.
type TelemetryVendor interface {

	// BuildNamespaceTrafficMap must be implemented to satisfy TelemetryVendor.  It must produce a valid
	// TrafficMap for the requested namespaces, It is recommended to use the graph/util.go definitions for
	// error handling. It should be modeled after the Istio implementation.
	BuildNamespacesTrafficMap(o Options, client *prometheus.Client, globalInfo *AppenderGlobalInfo) TrafficMap

	// BuildNodeTrafficMap must be implemented to satisfy TelemetryVendor.  It must produce a valid
	// TrafficMap for the requested node, It is recommended to use the graph/util.go definitions for
	// error handling. It should be modeled after the Istio implementation.
	BuildNodeTrafficMap(o Options, client *prometheus.Client, globalInfo *AppenderGlobalInfo) TrafficMap
}
