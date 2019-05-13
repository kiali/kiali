package graph

import (
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/prometheus"
)

// AppenderGlobalInfo caches information relevant to a single graph. It allows
// an appender to populate the cache and then it, or another appender
// can re-use the information.  A new instance is generated for graph and
// is initially empty.
type AppenderGlobalInfo struct {
	Business   *business.Layer
	PromClient *prometheus.Client
	Telemetry  map[string]interface{} // Telemetry impl-specific information
}

//
func NewAppenderGlobalInfo() *AppenderGlobalInfo {
	return &AppenderGlobalInfo{Telemetry: make(map[string]interface{})}
}

// AppenderNamespaceInfo caches information relevant to a single namespace. It allows
// one appender to populate the cache and another to then re-use the information.
// A new instance is generated for each namespace of a single graph and is initially
// seeded with only Namespace.
type AppenderNamespaceInfo struct {
	Namespace string                 // always provided
	Telemetry map[string]interface{} // Telemetry impl-specific information
}

func NewAppenderNamespaceInfo(namespace string) *AppenderNamespaceInfo {
	return &AppenderNamespaceInfo{Namespace: namespace, Telemetry: make(map[string]interface{})}
}

// Appender is implemented by any code offering to append a service graph with
// supplemental information.  On error the appender should panic and it will be
// handled as an error response.
type Appender interface {
	// AppendGraph performs the appender work on the provided traffic map. The map
	// may be initially empty. An appender is allowed to add or remove map entries.
	AppendGraph(trafficMap TrafficMap, globalInfo *AppenderGlobalInfo, namespaceInfo *AppenderNamespaceInfo)

	// Name returns a unique appender name and which is the name used to identify the appender (e.g in 'appenders' query param)
	Name() string
}
