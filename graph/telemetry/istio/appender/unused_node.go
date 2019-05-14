package appender

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

const UnusedNodeAppenderName = "unusedNode"

// UnusedNodeAppender looks for services that have never seen request traffic.  It adds nodes to represent the
// unused definitions.  The added node types depend on the graph type and/or labeling on the definition.
// Name: unusedNode
type UnusedNodeAppender struct {
	GraphType   string // This appender does not operate on service graphs because it adds workload nodes.
	IsNodeGraph bool   // This appender does not operate on node detail graphs because we want to focus on the specific node.
}

// Name implements Appender
func (a UnusedNodeAppender) Name() string {
	return UnusedNodeAppenderName
}

// AppendGraph implements Appender
func (a UnusedNodeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if graph.GraphTypeService == a.GraphType || a.IsNodeGraph {
		return
	}

	if getWorkloadList(namespaceInfo) == nil {
		workloadList, err := globalInfo.Business.Workload.GetWorkloadList(namespaceInfo.Namespace)
		graph.CheckError(err)
		namespaceInfo.Vendor[workloadListKey] = &workloadList
	}

	workloadList := getWorkloadList(namespaceInfo)
	a.addUnusedNodes(trafficMap, namespaceInfo.Namespace, workloadList.Workloads)
}

func (a UnusedNodeAppender) addUnusedNodes(trafficMap graph.TrafficMap, namespace string, workloads []models.WorkloadListItem) {
	unusedTrafficMap := a.buildUnusedTrafficMap(trafficMap, namespace, workloads)

	// Integrate the unused nodes into the existing traffic map
	for id, unusedNode := range unusedTrafficMap {
		trafficMap[id] = unusedNode
	}
}

func (a UnusedNodeAppender) buildUnusedTrafficMap(trafficMap graph.TrafficMap, namespace string, workloads []models.WorkloadListItem) graph.TrafficMap {
	unusedTrafficMap := graph.NewTrafficMap()
	cfg := config.Get()
	appLabel := cfg.IstioLabels.AppLabelName
	versionLabel := cfg.IstioLabels.VersionLabelName
	for _, w := range workloads {
		labels := w.Labels
		app := graph.Unknown
		version := graph.Unknown
		if v, ok := labels[appLabel]; ok {
			app = v
		}
		if v, ok := labels[versionLabel]; ok {
			version = v
		}
		id, nodeType := graph.Id("", "", namespace, w.Name, app, version, a.GraphType)
		if _, found := trafficMap[id]; !found {
			if _, found = unusedTrafficMap[id]; !found {
				log.Tracef("Adding unused node for workload [%s] with labels [%v]", w.Name, labels)
				node := graph.NewNodeExplicit(id, namespace, w.Name, app, version, "", nodeType, a.GraphType)
				// note: we don't know what the protocol really should be, http is most common, it's a dead edge anyway
				node.Metadata = graph.Metadata{"httpIn": 0.0, "httpOut": 0.0, "isUnused": true}
				unusedTrafficMap[id] = &node
			}
		}
	}
	return unusedTrafficMap
}
