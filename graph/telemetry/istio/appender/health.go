package appender

import (
	"context"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
)

const HealthAppenderName = "health"

// HealthConfigAppenderis responsible for adding health configuration annotation to the graph.
// Name: healthConfig
type HealthAppender struct {
	GraphType string
}

// Name implements Appender
func (a HealthAppender) Name() string {
	return HealthConfigAppenderName
}

func (a HealthAppender) IsFinalizer() bool {
	return false
}

// AppendGraph implements Appender
func (a HealthAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	a.applyHealth(trafficMap, globalInfo, namespaceInfo)
}

func (a *HealthAppender) applyHealth(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	var workloads models.NamespaceWorkloadHealth
	var apps models.NamespaceAppHealth
	var services models.NamespaceServiceHealth
	var err error

	switch a.GraphType {
	case graph.GraphTypeVersionedApp:
		workloads, err = globalInfo.Business.Health.GetNamespaceWorkloadHealth(context.TODO(), namespaceInfo.Namespace, business.HealthCriteria{WithTelemetry: false})
		graph.CheckError(err)

		apps, err = globalInfo.Business.Health.GetNamespaceAppHealth(context.TODO(), namespaceInfo.Namespace, business.HealthCriteria{WithTelemetry: false})
		graph.CheckError(err)

		services, err = globalInfo.Business.Health.GetNamespaceServiceHealth(context.TODO(), namespaceInfo.Namespace, business.HealthCriteria{WithTelemetry: false})
		graph.CheckError(err)

	case graph.GraphTypeApp:
		apps, err = globalInfo.Business.Health.GetNamespaceAppHealth(context.TODO(), namespaceInfo.Namespace, business.HealthCriteria{WithTelemetry: false})
		graph.CheckError(err)

	case graph.GraphTypeService:
		services, err = globalInfo.Business.Health.GetNamespaceServiceHealth(context.TODO(), namespaceInfo.Namespace, business.HealthCriteria{WithTelemetry: false})
		graph.CheckError(err)

		workloads, err = globalInfo.Business.Health.GetNamespaceWorkloadHealth(context.TODO(), namespaceInfo.Namespace, business.HealthCriteria{WithTelemetry: false})
		graph.CheckError(err)

	case graph.GraphTypeWorkload:
		workloads, err = globalInfo.Business.Health.GetNamespaceWorkloadHealth(context.TODO(), namespaceInfo.Namespace, business.HealthCriteria{WithTelemetry: false})
		graph.CheckError(err)
	}

	for _, n := range trafficMap {
		if n.Namespace != namespaceInfo.Namespace {
			continue
		}

		switch n.NodeType {
		case graph.NodeTypeWorkload:
			for name, wk := range workloads {
				if n.Workload == name {
					if inbound, ok := n.Metadata["inbound"].(map[string]map[string]float64); ok {
						wk.Requests.Inbound = inbound
					}
					if outbound, ok := n.Metadata["outbound"].(map[string]map[string]float64); ok {
						wk.Requests.Outbound = outbound
					}
					n.Metadata[graph.NodeHealth] = wk
					break
				}
			}
		case graph.NodeTypeService:
			for name, svc := range services {
				if n.Service == name {
					if inbound, ok := n.Metadata["inbound"].(map[string]map[string]float64); ok {
						svc.Requests.Inbound = inbound
					}
					if outbound, ok := n.Metadata["outbound"].(map[string]map[string]float64); ok {
						svc.Requests.Outbound = outbound
					}
					n.Metadata[graph.NodeHealth] = svc
					break
				}
			}
		case graph.NodeTypeApp:
			for name, app := range apps {
				if n.App == name {
					if inbound, ok := n.Metadata["inbound"].(map[string]map[string]float64); ok {
						app.Requests.Inbound = inbound
					}
					if outbound, ok := n.Metadata["outbound"].(map[string]map[string]float64); ok {
						app.Requests.Outbound = outbound
					}
					n.Metadata[graph.NodeHealth] = app
					break
				}
			}
		}
	}
}
