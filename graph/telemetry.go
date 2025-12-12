package graph

import (
	"github.com/kiali/kiali/prometheus"
)

// TelemetryVendor is an interface that must be satisfied for each telemetry implementation.
type TelemetryVendor[T any] interface {
	// BuildNamespaceTrafficMap is required by the TelemetryVendor interface.  It must produce a valid
	// TrafficMap for the requested namespaces, It is recommended to use the graph/util.go definitions for
	// error handling. It should be modeled after the Istio implementation.
	BuildNamespacesTrafficMap(o TelemetryOptions, client *prometheus.Client, globalInfo *GlobalInfo[T]) TrafficMap

	// BuildNodeTrafficMap is required by the TelemetryVendor interface. It must produce a valid
	// TrafficMap for the requested node, It is recommended to use the graph/util.go definitions for
	// error handling. It should be modeled after the Istio implementation.
	BuildNodeTrafficMap(o TelemetryOptions, client *prometheus.Client, globalInfo *GlobalInfo[T]) TrafficMap

	// GraphOptionsMatch is required by the TelemetryVendor interface. It returns true if there is any difference
	// in the options that would result in a fundamental change to the resulting traffic map (and therefore would
	// invalidate any cached graph)
	GraphOptionsMatch(a, b TelemetryOptions) bool
}
