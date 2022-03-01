package appender

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const LabelerAppenderName = "labeler"

// LabelerAppender is responsible for obtaining and attaching all k8s labels to all nodes in the graph.
// Name: labeler
type LabelerAppender struct{}

// Name implements Appender
func (f *LabelerAppender) Name() string {
	return LabelerAppenderName
}

// IsFinalizer implements Appender
func (a LabelerAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (f *LabelerAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, _namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	labelNodes(trafficMap, globalInfo)
}

// labelNodes puts all k8s labels in the metadata for all nodes.
func labelNodes(trafficMap graph.TrafficMap, gi *graph.AppenderGlobalInfo) {
	// We need to know the names of the Istio labels for app and version because we do not label the nodes with those.
	// There is no need to get the Istio label names multiple times, so get them once now.
	istioLabelNames := config.Get().IstioLabels

	for _, n := range trafficMap {
		// can't get labels for nodes on the outside or inaccessible nodes, so just go to the next and ignore this one.
		if b, ok := n.Metadata[graph.IsOutside]; ok && b.(bool) {
			continue
		}
		if b, ok := n.Metadata[graph.IsInaccessible]; ok && b.(bool) {
			continue
		}

		var labelsMetadata graph.LabelsMetadata

		switch n.NodeType {
		case graph.NodeTypeApp:
			if n.Version != "" {
				// the node is a "versioned-app" node
				if wl, ok := getWorkload(n.Namespace, n.Workload, gi); ok {
					labelsMetadata = copyMap(wl.Labels)
				} else {
					log.Debugf("Failed to obtain versioned-app details for [%+v]", n)
				}
			} else {
				// QUESTION: Is the following the right thing to do?
				// GetApp returns a list of workloads that make up the app. Capture the superset of all labels on all workloads.
				// However, throw away any labels that have different values across the different workloads.
				labelsMetadata = graph.LabelsMetadata{}
				if app, ok := getApp(n.Namespace, n.App, gi); ok {
					differentLabels := map[string]bool{}
					for _, w := range app.Workloads {
						// We do not know the workload's type, so pass in empty string and hope the API returns what we want.
						if r, ok := getWorkload(n.Namespace, w.WorkloadName, gi); ok {
							for k, v := range r.Labels {
								if _, skipIt := differentLabels[k]; !skipIt {
									if existingValue, ok := labelsMetadata[k]; ok {
										if existingValue != v {
											differentLabels[k] = true
											delete(labelsMetadata, k)
										}
									} else {
										labelsMetadata[k] = v
									}
								}
							}
						} else {
							log.Debugf("Failed to obtain app [%+v] workload details for [%v]", n, w.WorkloadName)
						}
					}
				} else {
					log.Debugf("Failed to obtain app details for [%+v]", n)
				}
			}
		case graph.NodeTypeService:
			if svc, ok := getServiceDefinition(n.Namespace, n.Service, gi); ok {
				labelsMetadata = copyMap(svc.Labels)
			} else {
				log.Debugf("Failed to obtain service details for [%+v]", n)
			}
		case graph.NodeTypeWorkload:
			// We do not know the workload's type, so pass in empty string and hope the API returns what we want.
			if wl, ok := getWorkload(n.Namespace, n.Workload, gi); ok {
				labelsMetadata = copyMap(wl.Labels)
			} else {
				log.Debugf("Failed to obtain workload details for [%+v].", n)
			}
		default:
			// skip any other nodes
		}

		if len(labelsMetadata) > 0 {
			n.Metadata[graph.Labels] = labelsMetadata
			delete(n.Metadata[graph.Labels].(graph.LabelsMetadata), istioLabelNames.AppLabelName)
			delete(n.Metadata[graph.Labels].(graph.LabelsMetadata), istioLabelNames.VersionLabelName)
		}
	}
}

func copyMap(orig map[string]string) map[string]string {
	c := make(map[string]string, len(orig))
	for k, v := range orig {
		c[k] = v
	}
	return c
}
