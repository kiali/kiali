package appender

import (
	"github.com/kiali/kiali/graph"
	klog "github.com/kiali/kiali/log"
)

const LabelerAppenderName = "labeler"

// LabelerAppender is responsible for obtaining and attaching all k8s labels to all nodes in the graph.
// Name: labeler
type LabelerAppender struct {
	log klog.ContextLogger
}

// Name implements Appender
func (f *LabelerAppender) Name() string {
	return LabelerAppenderName
}

// IsFinalizer implements Appender
func (a LabelerAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (f *LabelerAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, _namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	labelNodes(trafficMap, globalInfo, f.log)
}

// labelNodes puts all k8s labels in the metadata for all nodes.
func labelNodes(trafficMap graph.TrafficMap, gi *graph.GlobalInfo, log klog.ContextLogger) {
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
				if wl, ok := getWorkload(n.Cluster, n.Namespace, n.Workload, gi); ok {
					labelsMetadata = copyMap(wl.Labels)
				} else {
					log.Debugf("Failed to obtain versioned-app details for [%+v]", n)
				}
			} else {
				if app, ok := getApp(n.Namespace, n.App, gi); ok {
					labelsMetadata = copyMap(app.Labels)
				} else {
					log.Debugf("Failed to obtain app details for [%+v]", n)
				}
			}
		case graph.NodeTypeService:
			if svc, ok := getServiceDefinition(n.Cluster, n.Namespace, n.Service, gi); ok {
				labelsMetadata = copyMap(svc.Labels)
			} else {
				log.Debugf("Failed to obtain service details for [%+v]", n)
			}
		case graph.NodeTypeWorkload:
			if wl, ok := getWorkload(n.Cluster, n.Namespace, n.Workload, gi); ok {
				labelsMetadata = copyMap(wl.Labels)
			} else {
				log.Debugf("Failed to obtain workload details for [%+v].", n)
			}
		default:
			// skip any other nodes
		}

		if len(labelsMetadata) > 0 {
			n.Metadata[graph.Labels] = labelsMetadata
			if appLabelName, found := gi.Conf.GetAppLabelName(labelsMetadata); found {
				delete(n.Metadata[graph.Labels].(graph.LabelsMetadata), appLabelName)
			}
			if verLabelName, found := gi.Conf.GetVersionLabelName(labelsMetadata); found {
				delete(n.Metadata[graph.Labels].(graph.LabelsMetadata), verLabelName)
			}
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
