package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
)

const HealthConfigAppenderName = "healthConfig"

// HealthConfigAppenderis responsible for adding health configuration annotation to the graph.
// Name: healthConfig
type HealthConfigAppender struct{}

// Name implements Appender
func (a HealthConfigAppender) Name() string {
	return HealthConfigAppenderName
}

// AppendGraph implements Appender
func (a HealthConfigAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	if getWorkloadList(namespaceInfo) == nil {
		sdl, err := globalInfo.Business.Workload.GetWorkloadList(namespaceInfo.Namespace)
		graph.CheckError(err)
		namespaceInfo.Vendor[workloadListKey] = &sdl
	}

	if getServiceDefinitionList(namespaceInfo) == nil {
		sdl, err := globalInfo.Business.Svc.GetServiceDefinitionList(namespaceInfo.Namespace)
		graph.CheckError(err)
		namespaceInfo.Vendor[serviceDefinitionListKey] = sdl
	}

	a.applyHealthConfigPresence(trafficMap, namespaceInfo)
}

func (a *HealthConfigAppender) applyHealthConfigPresence(trafficMap graph.TrafficMap, namespaceInfo *graph.AppenderNamespaceInfo) {
	for _, n := range trafficMap {
		if n.Namespace != namespaceInfo.Namespace {
			continue
		}
		// get the workload for the node and check to see if they have health configuration.
		switch n.NodeType {
		case graph.NodeTypeWorkload:
			if workload, found := getWorkload(n.Workload, namespaceInfo); found {
				n.Metadata[graph.HasHealthConfig] = models.GetHealthAnnotation(workload.HealthAnnotations, models.GetHealthConfigAnnotation())
			}
		case graph.NodeTypeService:
			if srv, found := getService(n.Service, namespaceInfo); found {
				n.Metadata[graph.HasHealthConfig] = models.GetHealthAnnotation(srv.HealthAnnotations, models.GetHealthConfigAnnotation())
			}
		default:
			continue
		}
	}
}
