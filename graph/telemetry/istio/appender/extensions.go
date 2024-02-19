package appender

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

const IdleNodeAppenderName = "idleNode"

// IdleNodeAppender looks for services that have never seen request traffic.  It adds nodes to represent the
// idle/unused definitions.  The added node types depend on the graph type and/or labeling on the definition.
// Name: idleNode
type IdleNodeAppender struct {
	GraphType          string
	InjectServiceNodes bool // This appender adds idle services only when service nodes are injected or graphType=service
	IsNodeGraph        bool // This appender does not operate on node detail graphs because we want to focus on the specific node.
}

// Name implements Appender
func (a IdleNodeAppender) Name() string {
	return IdleNodeAppenderName
}

// IsFinalizer implements Appender
func (a IdleNodeAppender) IsFinalizer() bool {
	return false
}

// AppendGraph implements Appender
func (a IdleNodeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if a.IsNodeGraph {
		return
	}

	serviceLists := map[string]*models.ServiceList{}
	workloadLists := map[string]*models.WorkloadList{}

	if a.GraphType != graph.GraphTypeService {
		workloadLists = getWorkloadLists(nil, namespaceInfo.Namespace, globalInfo)
	}

	if a.GraphType == graph.GraphTypeService || a.InjectServiceNodes {
		serviceLists = getServiceLists(nil, namespaceInfo.Namespace, globalInfo)
	}

	a.addIdleNodes(trafficMap, namespaceInfo.Namespace, serviceLists, workloadLists)
}

func (a IdleNodeAppender) addIdleNodes(trafficMap graph.TrafficMap, namespace string, serviceLists map[string]*models.ServiceList, workloadLists map[string]*models.WorkloadList) {
	idleNodeTrafficMap := a.buildIdleNodeTrafficMap(trafficMap, namespace, serviceLists, workloadLists)

	// Integrate the idle nodes into the existing traffic map
	for id, idleNode := range idleNodeTrafficMap {
		trafficMap[id] = idleNode
	}
}

func (a IdleNodeAppender) buildIdleNodeTrafficMap(trafficMap graph.TrafficMap, namespace string, serviceLists map[string]*models.ServiceList, workloadLists map[string]*models.WorkloadList) graph.TrafficMap {
	idleNodeTrafficMap := graph.NewTrafficMap()

	for cluster, serviceList := range serviceLists {
		for _, s := range serviceList.Services {
			id, nodeType, _ := graph.Id(cluster, namespace, s.Name, "", "", "", "", a.GraphType)
			if _, found := trafficMap[id]; !found {
				if _, found = idleNodeTrafficMap[id]; !found {
					log.Tracef("Adding idle node for service [%s]", s.Name)
					node := graph.NewNodeExplicit(id, cluster, namespace, "", "", "", s.Name, nodeType, a.GraphType)
					// note: we don't know what the protocol really should be, http is most common, it's a dead edge anyway
					node.Metadata = graph.Metadata{"httpIn": 0.0, "httpOut": 0.0, graph.IsIdle: true}
					idleNodeTrafficMap[id] = node
				}
			}
		}

		cfg := config.Get()
		appLabel := cfg.IstioLabels.AppLabelName
		versionLabel := cfg.IstioLabels.VersionLabelName
		if workloadList, ok := workloadLists[cluster]; ok {
			for _, w := range workloadList.Workloads {
				labels := w.Labels
				app := graph.Unknown
				version := graph.Unknown
				if v, ok := labels[appLabel]; ok {
					app = v
				}
				if v, ok := labels[versionLabel]; ok {
					version = v
				}
				id, nodeType, _ := graph.Id(cluster, "", "", namespace, w.Name, app, version, a.GraphType)
				if _, found := trafficMap[id]; !found {
					if _, found = idleNodeTrafficMap[id]; !found {
						log.Tracef("Adding idle node for workload [%s] with labels [%v]", w.Name, labels)
						node := graph.NewNodeExplicit(id, cluster, namespace, w.Name, app, version, "", nodeType, a.GraphType)
						// note: we don't know what the protocol really should be, http is most common, it's a dead edge anyway
						node.Metadata = graph.Metadata{"httpIn": 0.0, "httpOut": 0.0, graph.IsIdle: true}
						idleNodeTrafficMap[id] = node
					}
				}
			}
		}
	}
	return idleNodeTrafficMap
}
