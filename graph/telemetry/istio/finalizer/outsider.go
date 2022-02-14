package finalizer

import (
	"time"

	"github.com/kiali/kiali/graph"
)

const OutsiderFinalizerName = "outsider"

// OutsiderFinalizer is responsible for marking the outsiders (i.e. nodes not in the requested namespaces) and inaccessible nodes
// Name: outsider
type OutsiderFinalizer struct{}

// Name implements Finalizer
func (f *OutsiderFinalizer) Name() string {
	return OutsiderFinalizerName
}

// FinalizeGraph implements Appender
func (f *OutsiderFinalizer) FinalizeGraph(trafficMap graph.TrafficMap, finalizerInfo *graph.FinalizerInfo, o graph.TelemetryOptions) {
	if len(trafficMap) == 0 {
		return
	}

	markOutsideOrInaccessible(trafficMap, o)
}

// MarkOutsideOrInaccessible sets metadata for outsider and inaccessible nodes.  It should be called
// after all appender work is completed.
func markOutsideOrInaccessible(trafficMap graph.TrafficMap, o graph.TelemetryOptions) {
	for _, n := range trafficMap {
		switch n.NodeType {
		case graph.NodeTypeUnknown:
			n.Metadata[graph.IsInaccessible] = true
		case graph.NodeTypeService:
			if n.Namespace == graph.Unknown {
				n.Metadata[graph.IsInaccessible] = true
			} else if n.Metadata[graph.IsEgressCluster] == true {
				n.Metadata[graph.IsInaccessible] = true
			} else {
				if isOutside(n, o.Namespaces) {
					n.Metadata[graph.IsOutside] = true
				}
			}
		default:
			if isOutside(n, o.Namespaces) {
				n.Metadata[graph.IsOutside] = true
			}
		}
		if isOutsider, ok := n.Metadata[graph.IsOutside]; ok && isOutsider.(bool) {
			if _, ok2 := n.Metadata[graph.IsInaccessible]; !ok2 {
				if isInaccessible(n, o.AccessibleNamespaces) {
					n.Metadata[graph.IsInaccessible] = true
				}
			}
		}
	}
}

func isOutside(n *graph.Node, namespaces map[string]graph.NamespaceInfo) bool {
	if n.Namespace == graph.Unknown {
		return false
	}
	for _, ns := range namespaces {
		if n.Namespace == ns.Name {
			return false
		}
	}
	return true
}

func isInaccessible(n *graph.Node, accessibleNamespaces map[string]time.Time) bool {
	if _, found := accessibleNamespaces[n.Namespace]; !found {
		return true
	} else {
		return false
	}
}
