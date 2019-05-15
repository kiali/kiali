package graph

import (
	"github.com/kiali/kiali/prometheus"
)

// Appender is implemented by any code offering to append a service graph with
// supplemental information.  On error the appender should panic and it will be
// handled as an error response.
type Telemetry interface {

	// GraphNamespaces is implemented by any supported telemetry provider. It is required produce
	BuildNamespacesTrafficMap(o Options, client *prometheus.Client, globalInfo *AppenderGlobalInfo) TrafficMap

	BuildNodeTrafficMap(o Options, client *prometheus.Client, globalInfo *AppenderGlobalInfo) TrafficMap
}
