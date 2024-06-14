package appender

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
)

const MeshCheckAppenderName = "meshCheck"
const SidecarsCheckAppenderName = "sidecarsCheck"

// MeshCheckAppender flags nodes whose backing workloads are missing at least one Envoy sidecar. Note that
// a node with no backing workloads is not flagged.
// Name: meshCheck
type MeshCheckAppender struct {
	AccessibleNamespaces graph.AccessibleNamespaces
}

// Name implements Appender
func (a MeshCheckAppender) Name() string {
	return MeshCheckAppenderName
}

// IsFinalizer implements Appender
func (a MeshCheckAppender) IsFinalizer() bool {
	return false
}

// AppendGraph implements Appender
func (a MeshCheckAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	a.applyMeshChecks(trafficMap, globalInfo, namespaceInfo)
}

func (a *MeshCheckAppender) applyMeshChecks(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	for _, n := range trafficMap {
		// skip if we've already determined the node is out-of-mesh. we may process the same
		// node multiple times to ensure we check every node (e.g. missing sidecars indicate missing
		// telemetry and so we need to check nodes when we can, regardless of namespace)
		if n.Metadata[graph.IsOutOfMesh] == true {
			continue
		}

		// skip if the node is not in an accessible namespace, we can't do the checking
		if !a.nodeOK(n) {
			continue
		}

		// We whitelist istio components because they may not report telemetry using injected sidecars.
		if config.IsIstioNamespace(n.Namespace) {
			continue
		}

		// dead nodes tell no tales (er, have no pods)
		if isDead, ok := n.Metadata[graph.IsDead]; ok && isDead.(bool) {
			continue
		}

		// get the workloads for the node and check to see if they have sidecars. Note that
		// if there are no workloads/pods we don't flag it as missing sidecars.  No pods means
		// no missing sidecars.  (In most cases this means it was flagged as dead, and handled above)
		hasIstioSidecar := true
		hasIstioAmbient := true
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			if workload, found := getWorkload(n.Cluster, n.Namespace, n.Workload, globalInfo); found {
				hasIstioSidecar = workload.IstioSidecar
				hasIstioAmbient = workload.IstioAmbient
			}
		case graph.NodeTypeApp:
			workloads := getAppWorkloads(n.Cluster, n.Namespace, n.App, n.Version, globalInfo)
			if len(workloads) > 0 {
				for _, workload := range workloads {
					if !workload.IstioSidecar {
						hasIstioSidecar = false
					}
					if !workload.IstioAmbient {
						hasIstioAmbient = false
					}
					if !hasIstioSidecar && !hasIstioAmbient {
						break
					}
				}
			}
		default:
			continue
		}

		if hasIstioAmbient || n.Metadata[graph.IsWaypoint] == true {
			n.Metadata[graph.IsAmbient] = true
		}
		if !hasIstioSidecar && !hasIstioAmbient && n.Metadata[graph.IsWaypoint] != true {
			n.Metadata[graph.IsOutOfMesh] = true
		}
	}
}

// nodeOK returns true if we have access to its workload info
func (a *MeshCheckAppender) nodeOK(node *graph.Node) bool {
	key := graph.GetClusterSensitiveKey(node.Cluster, node.Namespace)
	_, ok := a.AccessibleNamespaces[key]
	return ok
}
