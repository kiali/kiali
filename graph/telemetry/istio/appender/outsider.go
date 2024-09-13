package appender

import (
	"github.com/kiali/kiali/graph"
)

const OutsiderAppenderName = "outsider"

// OutsiderAppender is responsible for marking the outsiders (i.e. nodes not in the requested namespaces) and inaccessible nodes
// Name: outsider
type OutsiderAppender struct {
	AccessibleNamespaces graph.AccessibleNamespaces
	Namespaces           graph.NamespaceInfoMap
}

// Name implements Appender
func (a *OutsiderAppender) Name() string {
	return OutsiderAppenderName
}

// IsFinalizer implements Appender
func (a OutsiderAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (a *OutsiderAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, _namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	a.markOutsideOrInaccessible(trafficMap)
}

// MarkOutsideOrInaccessible sets metadata for outsider and inaccessible nodes.  It should be called
// after all appender work is completed.
func (a *OutsiderAppender) markOutsideOrInaccessible(trafficMap graph.TrafficMap) {
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
				if isOutside(n, a.Namespaces) {
					n.Metadata[graph.IsOutside] = true
				}
			}
		default:
			if isOutside(n, a.Namespaces) {
				n.Metadata[graph.IsOutside] = true
			}
		}
		// Check if the node is outside accessible namespaces.
		if _, ok := n.Metadata[graph.IsInaccessible]; !ok {
			if isInaccessible(n, a.AccessibleNamespaces) {
				n.Metadata[graph.IsInaccessible] = true
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

func isInaccessible(n *graph.Node, accessibleNamespaces graph.AccessibleNamespaces) bool {
	key := graph.GetClusterSensitiveKey(n.Cluster, n.Namespace)
	_, found := accessibleNamespaces[key]
	return !found
}
