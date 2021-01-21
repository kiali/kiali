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

// AppendGraph implements Appender
func (a IdleNodeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if a.IsNodeGraph {
		return
	}

	services := []models.ServiceDetails{}
	workloads := []models.WorkloadListItem{}

	if a.GraphType != graph.GraphTypeService {
		if getWorkloadList(namespaceInfo) == nil {
			workloadList, err := globalInfo.Business.Workload.GetWorkloadList(namespaceInfo.Namespace)
			graph.CheckError(err)
			namespaceInfo.Vendor[workloadListKey] = &workloadList
		}
		workloads = getWorkloadList(namespaceInfo).Workloads
	}

	if a.GraphType == graph.GraphTypeService || a.InjectServiceNodes {
		if getServiceDefinitionList(namespaceInfo) == nil {
			sdl, err := globalInfo.Business.Svc.GetServiceDefinitionList(namespaceInfo.Namespace)
			graph.CheckError(err)
			namespaceInfo.Vendor[serviceDefinitionListKey] = sdl
		}
		services = getServiceDefinitionList(namespaceInfo).ServiceDefinitions
	}

	a.addIdleNodes(trafficMap, namespaceInfo.Namespace, services, workloads)
}

func (a IdleNodeAppender) addIdleNodes(trafficMap graph.TrafficMap, namespace string, services []models.ServiceDetails, workloads []models.WorkloadListItem) {
	idleNodeTrafficMap := a.buildIdleNodeTrafficMap(trafficMap, namespace, services, workloads)

	// Integrate the idle nodes into the existing traffic map
	for id, idleNode := range idleNodeTrafficMap {
		trafficMap[id] = idleNode
	}
}

func (a IdleNodeAppender) buildIdleNodeTrafficMap(trafficMap graph.TrafficMap, namespace string, services []models.ServiceDetails, workloads []models.WorkloadListItem) graph.TrafficMap {
	idleNodeTrafficMap := graph.NewTrafficMap()

	for _, s := range services {
		id, nodeType := graph.Id(graph.Unknown, namespace, s.Service.Name, "", "", "", "", a.GraphType)
		if _, found := trafficMap[id]; !found {
			if _, found = idleNodeTrafficMap[id]; !found {
				log.Tracef("Adding idle node for service [%s]", s.Service.Name)
				node := graph.NewNodeExplicit(id, graph.Unknown, namespace, "", "", "", s.Service.Name, nodeType, a.GraphType)
				// note: we don't know what the protocol really should be, http is most common, it's a dead edge anyway
				node.Metadata = graph.Metadata{"httpIn": 0.0, "httpOut": 0.0, graph.IsIdle: true}
				idleNodeTrafficMap[id] = &node
			}
		}
	}

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
		id, nodeType := graph.Id(graph.Unknown, "", "", namespace, w.Name, app, version, a.GraphType)
		if _, found := trafficMap[id]; !found {
			if _, found = idleNodeTrafficMap[id]; !found {
				log.Tracef("Adding idle node for workload [%s] with labels [%v]", w.Name, labels)
				node := graph.NewNodeExplicit(id, graph.Unknown, namespace, w.Name, app, version, "", nodeType, a.GraphType)
				// note: we don't know what the protocol really should be, http is most common, it's a dead edge anyway
				node.Metadata = graph.Metadata{"httpIn": 0.0, "httpOut": 0.0, graph.IsIdle: true}
				idleNodeTrafficMap[id] = &node
			}
		}
	}
	return idleNodeTrafficMap
}
