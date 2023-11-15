package mesh

import (
	"context"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/prometheus"
)

type AppenderVendorInfo map[string]interface{}

// AppenderGlobalInfo caches information relevant to a single graph. It allows
// an appender to populate the cache and then it, or another appender
// can re-use the information.  A new instance is generated for graph and
// is initially empty.
type AppenderGlobalInfo struct {
	Business   *business.Layer
	Context    context.Context
	PromClient *prometheus.Client
	Vendor     AppenderVendorInfo // telemetry vendor's global info
}

// AppenderNamespaceInfo caches information relevant to a single namespace. It allows
// one appender to populate the cache and another to then re-use the information.
// A new instance is generated for each namespace of a single graph and is initially
// seeded with only Namespace.
type AppenderNamespaceInfo struct {
	Namespace string             // always provided
	Vendor    AppenderVendorInfo // telemetry vendor's namespace info
}

func NewAppenderVendorInfo() AppenderVendorInfo {
	return make(map[string]interface{})
}

func NewAppenderGlobalInfo() *AppenderGlobalInfo {
	return &AppenderGlobalInfo{Vendor: NewAppenderVendorInfo()}
}

func NewAppenderNamespaceInfo(namespace string) *AppenderNamespaceInfo {
	return &AppenderNamespaceInfo{Namespace: namespace, Vendor: NewAppenderVendorInfo()}
}

// Appender is implemented by any code offering to append a service graph with
// supplemental information.  On error the appender should panic and it will be
// handled as an error response.
type Appender interface {
	// AppendGraph performs the appender work on the provided traffic map. The map may be initially empty.
	// An appender is allowed to add or remove map entries. namespaceInfo will be nil for Finalizer appenders.
	AppendGraph(meshMap MeshMap, globalInfo *AppenderGlobalInfo, namespaceInfo *AppenderNamespaceInfo)

	// IsFinalizer returns true if the appender should run only on the final TrafficMap, or false if the appender should
	// run against every requested namespace.
	IsFinalizer() bool

	// Name returns a unique appender name and which is the name used to identify the appender (e.g in 'appenders' query param)
	Name() string
}
