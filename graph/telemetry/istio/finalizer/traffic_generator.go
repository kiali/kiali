package finalizer

import (
	"github.com/kiali/kiali/graph"
)

const TrafficGeneratorFinalizerName = "trafficGenerator"

// TrafficGeneratorFinalizer is responsible for marking the insider traffic generator nodes (i.e. inside the namespace and only having outgoing edges)
// Name: trafficGenerator
type TrafficGeneratorFinalizer struct{}

// Name implements Finalizer
func (f *TrafficGeneratorFinalizer) Name() string {
	return OutsiderFinalizerName
}

// FinalizeGraph implements Finalizer
func (f *TrafficGeneratorFinalizer) FinalizeGraph(trafficMap graph.TrafficMap, finalizerInfo *graph.FinalizerInfo, o graph.TelemetryOptions) {
	if len(trafficMap) == 0 {
		return
	}

	markTrafficGenerators(trafficMap)
}

// MarkTrafficGenerators set IsRoot metadata. It is called after appender work is complete.
func markTrafficGenerators(trafficMap graph.TrafficMap) {
	destMap := make(map[string]*graph.Node)
	for _, n := range trafficMap {
		for _, e := range n.Edges {
			destMap[e.Dest.ID] = e.Dest
		}
	}
	for _, n := range trafficMap {
		if len(n.Edges) == 0 {
			continue
		}
		if _, isDest := destMap[n.ID]; !isDest {
			n.Metadata[graph.IsRoot] = true
		}
	}
}
