package appender

import (
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
)

const SidecarsCheckAppenderName = "sidecarsCheck"

// SidecarsCheckAppender flags nodes whose backing workloads are missing at least one Envoy sidecar. Note that
// a node with no backing workloads is not flagged.
// Name: sidecarsCheck
type SidecarsCheckAppender struct {
	AccessibleNamespaces map[string]time.Time
}

// Name implements Appender
func (a SidecarsCheckAppender) Name() string {
	return SidecarsCheckAppenderName
}

// AppendGraph implements Appender
func (a SidecarsCheckAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	a.applySidecarsChecks(trafficMap, globalInfo, namespaceInfo)
}

func (a *SidecarsCheckAppender) applySidecarsChecks(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	for _, n := range trafficMap {
		// skip if we already determined there is a missing sidecar. we can process the same
		// node multiple times because to ensure we check every node (missing sidecars indicate missing
		// telemetry so we need to check nodes when we can, regardless of namespace)
		if n.Metadata[graph.HasMissingSC] == true {
			continue
		}

		// skip if the node's namespace is outside of the accessible namespaces
		if !a.namespaceOK(n.Namespace, namespaceInfo) {
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
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			if workload, found := getWorkload(n.Namespace, n.Workload, globalInfo); found {
				hasIstioSidecar = workload.IstioSidecar
			}
		case graph.NodeTypeApp:
			workloads := getAppWorkloads(n.Namespace, n.App, n.Version, globalInfo)
			if len(workloads) > 0 {
				for _, workload := range workloads {
					if !workload.IstioSidecar {
						hasIstioSidecar = false
						break
					}
				}
			}
		default:
			continue
		}

		if !hasIstioSidecar {
			n.Metadata[graph.HasMissingSC] = true
		}
	}
}

// namespaceOk returns true if the namespace in question is the current appender namespace or any of the graph namespaces
func (a *SidecarsCheckAppender) namespaceOK(namespace string, namespaceInfo *graph.AppenderNamespaceInfo) bool {
	if namespace == namespaceInfo.Namespace {
		return true
	}
	for ns := range a.AccessibleNamespaces {
		if namespace == ns {
			return true
		}
	}
	return false
}
