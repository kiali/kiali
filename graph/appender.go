package graph

import (
	"context"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

// ServiceEntry represents a service entry configuration
type ServiceEntry struct {
	Hosts     []string
	ExportTo  []string
	Namespace string
}

// NodeKey maps a Workload to its node on the map.
type NodeKey struct {
	Cluster   string
	Namespace string
	Workload  string
}

// GlobalInfo caches information relevant to a single graph. It allows
// the main graph code, or an appender, to populate the cache and then it,
// or another appender can re-use the information.  A new instance is
// generated for graph and is initially empty.
type GlobalInfo[T any] struct {
	Business   *business.Layer
	Clusters   []models.KubeCluster
	Conf       *config.Config
	PromClient prometheus.ClientInterface
	Vendor     T // telemetry vendor's global info
}

// AppenderNamespaceInfo caches information relevant to a single namespace. It allows
// one appender to populate the cache and another to then re-use the information.
// A new instance is generated for each namespace of a single graph and is initially
// seeded with only Namespace.
type AppenderNamespaceInfo[T any] struct {
	Namespace string // always provided
	Vendor    T      // telemetry vendor's namespace info
}

func NewGlobalInfo[T any](business *business.Layer, prom prometheus.ClientInterface, conf *config.Config, clusters []models.KubeCluster, vendorInfo T) *GlobalInfo[T] {
	return &GlobalInfo[T]{
		Business:   business,
		Clusters:   clusters,
		Conf:       conf,
		PromClient: prom,
		Vendor:     vendorInfo,
	}
}

// Appender is implemented by any code offering to append a service graph with
// supplemental information.  On error the appender should panic and it will be
// handled as an error response.
type Appender[T any] interface {
	// AppendGraph performs the appender work on the provided traffic map. The map may be initially empty.
	// An appender is allowed to add or remove map entries. namespaceInfo will be nil for Finalizer appenders.
	AppendGraph(ctx context.Context, trafficMap TrafficMap, globalInfo *GlobalInfo[T], namespaceInfo *AppenderNamespaceInfo[T])

	// IsFinalizer returns true if the appender should run only on the final TrafficMap, or false if the appender should
	// run against every requested namespace.
	IsFinalizer() bool

	// Name returns a unique appender name and which is the name used to identify the appender (e.g in 'appenders' query param)
	Name() string
}
