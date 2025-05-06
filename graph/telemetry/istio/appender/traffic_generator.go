package appender

import (
	"context"

	"github.com/kiali/kiali/graph"
)

const TrafficGeneratorAppenderName = "trafficGenerator"

// TrafficGeneratorAppender is responsible for marking the insider traffic generator nodes (i.e. inside the namespace and only having outgoing edges)
// Name: trafficGenerator
type TrafficGeneratorAppender struct {
}

// Name implements Appender
func (f *TrafficGeneratorAppender) Name() string {
	return TrafficGeneratorAppenderName
}

// IsFinalizer implements Appender
func (a TrafficGeneratorAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (f *TrafficGeneratorAppender) AppendGraph(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, _namespaceInfo *graph.AppenderNamespaceInfo) {
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
