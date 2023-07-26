package appender

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
)

const AmbientCheckAppenderName = "ambientCheck"

// AmbientCheckAppender flags nodes whose backing workloads that doesn't have ambient component. Note that
// a node with no backing workloads is not flagged.
// Name: AmbientCheck
type AmbientCheckAppender struct {
	AccessibleNamespaces graph.AccessibleNamespaces
}

// Name implements Appender
func (a AmbientCheckAppender) Name() string {
	return AmbientCheckAppenderName
}

// IsFinalizer implements Appender
func (a AmbientCheckAppender) IsFinalizer() bool {
	return false
}

// AppendGraph implements Appender
func (a AmbientCheckAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}
	a.applyAmbientChecks(trafficMap, globalInfo, namespaceInfo)
}

func (a *AmbientCheckAppender) applyAmbientChecks(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	for _, n := range trafficMap {
		// skip if we already determined there is a missining ambient indicator. we can process the same
		// node multiple times because to ensure we check every node (missing ambient indicate missing
		// telemetry so we need to check nodes when we can, regardless of namespace)
		if n.Metadata[graph.HasMissingA] == true {
			continue
		}

		// skip if the node's namespace is outside of the accessible namespaces
		if !a.namespaceOK(n.Namespace, namespaceInfo) {
			continue
		}

		// We whitelist istio components because they may not report telemetry using ambient components.
		if config.IsIstioNamespace(n.Namespace) {
			continue
		}

		// dead nodes tell no tales (er, have no pods)
		if isDead, ok := n.Metadata[graph.IsDead]; ok && isDead.(bool) {
			continue
		}

		// get the workloads for the node and check to see if they have ambient components. Note that
		// if there are no workloads/pods we don't flag it as missing ambient.  No pods means
		// no missing ambient.  (In most cases this means it was flagged as dead, and handled above)
		hasIstioAmbient := true
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			if workload, found := getWorkload(n.Cluster, n.Namespace, n.Workload, globalInfo); found {
				hasIstioAmbient = workload.IstioAmbient
			}
		case graph.NodeTypeApp:
			workloads := getAppWorkloads(n.Cluster, n.Namespace, n.App, n.Version, globalInfo)
			if len(workloads) > 0 {
				for _, workload := range workloads {
					if !workload.IstioAmbient {
						hasIstioAmbient = false
						break
					}
				}
			}
		default:
			continue
		}

		if !hasIstioAmbient {
			n.Metadata[graph.HasMissingA] = true
		}
	}
}

// namespaceOk returns true if the namespace in question is the current appender namespace or any of the graph namespaces
func (a *AmbientCheckAppender) namespaceOK(namespace string, namespaceInfo *graph.AppenderNamespaceInfo) bool {
	if namespace == namespaceInfo.Namespace {
		return true
	}
	for _, ns := range a.AccessibleNamespaces {
		if namespace == ns.Name {
			return true
		}
	}
	return false
}
