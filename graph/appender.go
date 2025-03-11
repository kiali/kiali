package graph

import (
	"context"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus"
)

type VendorInfo map[string]interface{}

// GlobalInfo caches information relevant to a single graph. It allows
// the main graph code, or an appender, to populate the cache and then it,
// or another appender can re-use the information.  A new instance is
// generated for graph and is initially empty.
type GlobalInfo struct {
	Business   *business.Layer
	Conf       *config.Config
	Context    context.Context
	PromClient *prometheus.Client
	Vendor     VendorInfo // telemetry vendor's global info
}

// AppenderNamespaceInfo caches information relevant to a single namespace. It allows
// one appender to populate the cache and another to then re-use the information.
// A new instance is generated for each namespace of a single graph and is initially
// seeded with only Namespace.
type AppenderNamespaceInfo struct {
	Namespace string     // always provided
	Vendor    VendorInfo // telemetry vendor's namespace info
}

func NewVendorInfo() VendorInfo {
	return make(map[string]interface{})
}

func NewGlobalInfo() *GlobalInfo {
	return &GlobalInfo{Conf: config.Get(), Vendor: NewVendorInfo()}
}

func NewAppenderNamespaceInfo(namespace string) *AppenderNamespaceInfo {
	return &AppenderNamespaceInfo{Namespace: namespace, Vendor: NewVendorInfo()}
}

// Appender is implemented by any code offering to append a service graph with
// supplemental information.  On error the appender should panic and it will be
// handled as an error response.
type Appender interface {
	// AppendGraph performs the appender work on the provided traffic map. The map may be initially empty.
	// An appender is allowed to add or remove map entries. namespaceInfo will be nil for Finalizer appenders.
	AppendGraph(trafficMap TrafficMap, globalInfo *GlobalInfo, namespaceInfo *AppenderNamespaceInfo)

	// IsFinalizer returns true if the appender should run only on the final TrafficMap, or false if the appender should
	// run against every requested namespace.
	IsFinalizer() bool

	// Name returns a unique appender name and which is the name used to identify the appender (e.g in 'appenders' query param)
	Name() string
}
