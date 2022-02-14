package graph

import (
	"github.com/kiali/kiali/business"
)

// FinalizerInfo caches information relevant to a single graph. It allows
// a finalizer to populate the cache and then it, or another finalizer
// can re-use the information.  A new instance is generated for graph and
// is initially empty.
type FinalizerInfo struct {
	Business    *business.Layer
	HomeCluster string
}

func NewFinalizerInfo() *FinalizerInfo {
	return &FinalizerInfo{}
}

// Finalizer is implemented by any code designed to add-to or alter the final TrafficMap.
// On error the finalizer should panic and it will be handled as an error response.
type Finalizer interface {
	// FinalizeGraph performs the finalizer work on the provided traffic map. The map
	// may be initially empty. A finalizer is allowed to add or remove map entries.
	FinalizeGraph(trafficMap TrafficMap, finalizerInfo *FinalizerInfo, o TelemetryOptions)

	// Name returns a unique finalizer name used to identify the finalizer (e.g in 'finalizers' query param)
	Name() string
}
