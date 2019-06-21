package appender

import (
	"strings"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

const ServiceEntryAppenderName = "serviceEntry"

// ServiceEntryAppender is responsible for identifying service nodes that are defined in Istio as
// a serviceEntry. A single serviceEntry can define multiple hosts and as such multiple service nodes may
// map to different hosts of a single serviceEntry. We'll call these "se" service nodes.  The appender
// handles this in the following way:
//   For Each "se" service node
//      if necessary, create an aggregate serviceEntry node ("se-aggregate")
//        -- an "se-aggregate" is a service node with isServiceEntry set in the metadata
//        -- an "se-aggregate" is namespace-specific. This can lead to mutiple serviceEntry nodes
//           in a multi-namespace graph. This makes some sense because serviceEntries are "exported"
//           to individual namespaces.
//      aggregate the "se" service node into the "se-aggregate" service node
//        -- incoming links
//        -- per-host traffic (in the metadata)
//      remove the "se" service node
//
// Doc Links
// - https://istio.io/docs/reference/config/networking/v1alpha3/service-entry/#ServiceEntry
// - https://istio.io/docs/examples/advanced-gateways/wildcard-egress-hosts/
//
// A note about wildcard hosts. External service entries allow for prefix wildcarding such that
// many different service requests may be handled by the same service entry definition.  For example,
// host = *.wikipedia.com would match requests for en.wikipedia.com and de.wikipedia.com. The Istio
// telemetry produces only one service node with the wilcard host as the destination_service_name.
type ServiceEntryAppender struct {
	AccessibleNamespaces map[string]time.Time
	GraphType            string // This appender does not operate on service graphs because it adds workload nodes.
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

	log.Warningf("NamespaceInfo=%+v", *namespaceInfo)
	a.applyServiceEntries(trafficMap, globalInfo, namespaceInfo)
}

func (a ServiceEntryAppender) applyServiceEntries(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	seMap := make(map[*serviceEntry][]*graph.Node)

	for _, n := range trafficMap {
		// only a service node can be a service entry
		if n.NodeType != graph.NodeTypeService {
			continue
		}
		// only a terminal node can be a service entry (no outgoing edges because the service is performed outside the mesh)
		if len(n.Edges) > 0 {
			continue
		}

		// A service node with no outgoing edges represents a serviceEntry when the service name matches
		// serviceEntry host. Map these "se" nodes to the serviceEntries that represent them.
		if se, ok := a.getServiceEntry(n.Service, globalInfo); ok {
			if nodes, ok := seMap[se]; ok {
				seMap[se] = append(nodes, n)
			} else {
				seMap[se] = []*graph.Node{n}
			}
		}
	}

	// Replace "se" nodes with an aggregated serviceEntry node
	for se, serviceNodes := range seMap {
		log.Warningf("Aggregating into %+v", *se)
		serviceEntryNode := graph.NewNode(namespaceInfo.Namespace, se.name, "", "", "", "", a.GraphType)
		serviceEntryNode.Metadata[graph.IsServiceEntry] = se.location
		for _, doomedServiceNode := range serviceNodes {
			// redirect edges leading to the doomed service node to the new aggregate
			for _, n := range trafficMap {
				for _, edge := range n.Edges {
					if edge.Dest.ID == doomedServiceNode.ID {
						edge.Dest = &serviceEntryNode
						graph.AggregateNodeMetadata(doomedServiceNode.Metadata, serviceEntryNode.Metadata)
					}
				}
			}
			log.Warningf("Deleting %+v", *doomedServiceNode)
			delete(trafficMap, doomedServiceNode.ID)
		}
		log.Warningf("Adding %+v", serviceEntryNode)
		trafficMap[serviceEntryNode.ID] = &serviceEntryNode
	}
}

// getServiceEntry queries the cluster API to resolve service entries across all accessible namespaces
// in the cluster.
// TODO: We may need to do more work here. serviceEntries can now be exported to specific namespaces.  The
// default is all namespaces (*) but a single namespace (.) is also supported.
func (a ServiceEntryAppender) getServiceEntry(serviceName string, globalInfo *graph.AppenderGlobalInfo) (*serviceEntry, bool) {
	serviceEntryHosts, found := getServiceEntryHosts(globalInfo)
	if !found {
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
						serviceEntryHosts = append(serviceEntryHosts, serviceEntryHost{
							host: host.(string),
							serviceEntry: serviceEntry{
								location: location,
								name:     entry.Metadata.Name,
							},
						})
					}
				}
			}
		}
		globalInfo.Vendor[serviceEntryHostsKey] = serviceEntryHosts
	}

	for _, serviceEntryHost := range serviceEntryHosts {
		// handle exact match
		// note: this also handles wildcard-prefix cases because the destination_service_name set by istio
		// is the matching host (e.g. *.wikipedia.com), not the rested service (e.g. de.wikipedia.com)
		if serviceEntryHost.host == serviceName {
			return &serviceEntryHost.serviceEntry, true
		}
		// handle serviceName prefix (e.g. host = serviceName.namespace.svc.cluster.local)
		if serviceEntryHost.location == "MESH_INTERNAL" {
			if strings.Split(serviceEntryHost.host, ".")[0] == serviceName {
				return &serviceEntryHost.serviceEntry, true
			}
		}
	}

	return nil, false
}
