package appender

import (
	"context"

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
func labelNodes(trafficMap graph.TrafficMap, fi *graph.AppenderGlobalInfo) {
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
			// QUESTION: Is the following the right thing to do?
			// GetApp returns a list of workloads that make up the app. Capture the superset of all labels on all workloads.
			// However, throw away any labels that have different values across the different workloads.
			labelsMetadata = graph.LabelsMetadata{}
			if app, err := fi.Business.App.GetApp(context.TODO(), n.Namespace, n.App); err == nil {
				differentLabels := map[string]bool{}
				for _, w := range app.Workloads {
					// We do not know the workload's type, so pass in empty string and hope the API returns what we want.
					if r, err := fi.Business.Workload.GetWorkload(context.TODO(), n.Namespace, w.WorkloadName, "", false); err == nil {
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
						log.Debugf("Failed to obtain app [%+v] workload details for [%v]. err=%v", n, w.WorkloadName, err)
					}
				}
			} else {
				log.Debugf("Failed to obtain app details for [%+v]. err=%v", n, err)
			}
		case graph.NodeTypeService:
			if svc, err := fi.Business.Svc.GetService(context.TODO(), n.Namespace, n.Service); err == nil {
				labelsMetadata = svc.Labels
			} else {
				log.Debugf("Failed to obtain service details for [%+v]. err=%v", n, err)
			}
		case graph.NodeTypeWorkload:
			// We do not know the workload's type, so pass in empty string and hope the API returns what we want.
			if wl, err := fi.Business.Workload.GetWorkload(context.TODO(), n.Namespace, n.Workload, "", false); err == nil {
				labelsMetadata = wl.Labels
			} else {
				log.Debugf("Failed to obtain workload details for [%+v]. err=%v", n, err)
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
