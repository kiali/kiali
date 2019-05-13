package appender

import (
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const ServiceEntryAppenderName = "serviceEntry"

// ServiceEntryAppender is responsible for identifying service nodes that are
// Istio Service Entries.
// Name: serviceEntry
type ServiceEntryAppender struct {
	AccessibleNamespaces map[string]time.Time
}

// Name implements Appender
func (a ServiceEntryAppender) Name() string {
	return ServiceEntryAppenderName
}

// AppendGraph implements Appender
func (a ServiceEntryAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	a.applyServiceEntries(trafficMap, globalInfo, namespaceInfo)
}

func (a ServiceEntryAppender) applyServiceEntries(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	for _, n := range trafficMap {
		// only a service node can be a service entry
		if n.NodeType != graph.NodeTypeService {
			continue
		}
		// only a terminal node can be a service entry (no outgoing edges because the service is performed outside the mesh)
		if len(n.Edges) > 0 {
			continue
		}

		// A service node with no outgoing edges may be an egress.
		// If so flag it, don't discard it (kiali-1526, see also kiali-2014).
		// The flag will be passed to the UI to inhibit links to non-existent detail pages.
		if location, ok := a.getServiceEntry(n.Service, globalInfo); ok {
			n.Metadata[graph.IsServiceEntry] = location
		}
	}
}

// getServiceEntry queries the cluster API to resolve service entries
// across all accessible namespaces in the cluster. All ServiceEntries are needed because
// Istio does not distinguish where a ServiceEntry is created when routing traffic (i.e.
// a ServiceEntry can be in any namespace and it will still work).
func (a ServiceEntryAppender) getServiceEntry(service string, globalInfo *graph.AppenderGlobalInfo) (string, bool) {
	if globalInfo.Telemetry["ServiceEntries"] == nil {
		globalInfo.Telemetry["ServiceEntries"] = make(map[string]string)

		for ns := range a.AccessibleNamespaces {
			istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigList(business.IstioConfigCriteria{
				IncludeServiceEntries: true,
				Namespace:             ns,
			})
			graph.CheckError(err)

			for _, entry := range istioCfg.ServiceEntries {
				if entry.Spec.Hosts != nil {
					location := "MESH_EXTERNAL"
					if entry.Spec.Location == "MESH_INTERNAL" {
						location = "MESH_INTERNAL"
					}
					for _, host := range entry.Spec.Hosts.([]interface{}) {
						globalInfo.Telemetry["ServiceEntries"].(map[string]string)[host.(string)] = location
					}
				}
			}
		}
		log.Tracef("Found [%v] service entries", len(globalInfo.Telemetry["ServiceEntries"].(map[string]string)))
	}

	location, ok := globalInfo.Telemetry["ServiceEntries"].(map[string]string)[service]
	return location, ok
}
