package appender

import (
	"strings"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
)

const ServiceEntryAppenderName = "serviceEntry"

// ServiceEntryAppender is responsible for identifying service nodes that are defined in Istio as
// a serviceEntry. A single serviceEntry can define multiple hosts and as such multiple service nodes may
// map to different hosts of a single serviceEntry. We'll call these "se-service" nodes.  The appender
// handles this in the following way:
//   For Each "se-service" node
//      if necessary, create an aggregate serviceEntry node ("se-aggregate")
//        -- an "se-aggregate" is a service node with isServiceEntry set in the metadata
//        -- an "se-aggregate" is namespace-specific. This can lead to mutiple serviceEntry nodes
//           in a multi-namespace graph. This makes some sense because serviceEntries are "exported"
//           to individual namespaces.
//      aggregate the "se-service" node into the "se-aggregate" node
//        -- incoming edges
//        -- outgoing edges (unusual but can have outgoing edge to egress gateway)
//        -- per-host traffic (in the metadata)
//      remove the "se-service" node from the trafficMap
//      add any new "se-aggregate" node to the trafficMap
//
// Doc Links
// - https://istio.io/docs/reference/config/networking/v1alpha3/service-entry/#ServiceEntry
// - https://istio.io/docs/examples/advanced-gateways/wildcard-egress-hosts/
//
// A note about wildcard hosts. External service entries allow for prefix wildcarding such that
// many different service requests may be handled by the same service entry definition.  For example,
// host = *.wikipedia.com would match requests for en.wikipedia.com and de.wikipedia.com. The Istio
// telemetry produces only one "se-service" node with the wilcard host as the destination_service_name.
//
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

	if globalInfo.HomeCluster == "" {
		globalInfo.HomeCluster = "unknown"
		c, err := globalInfo.Business.Mesh.ResolveKialiControlPlaneCluster(nil)
		graph.CheckError(err)
		if c != nil {
			globalInfo.HomeCluster = c.Name
		}
	}

	a.applyServiceEntries(trafficMap, globalInfo, namespaceInfo)
}

func (a ServiceEntryAppender) applyServiceEntries(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	// a map of "se-service" nodes to the "se-aggregate" information
	seMap := make(map[*serviceEntry][]*graph.Node)

	for _, n := range trafficMap {
		// only a service node can be a service entry
		if n.NodeType != graph.NodeTypeService {
			continue
		}
		// PassthroughCluster or BlackHoleCluster is not a service entry (nor a defined service)
		if n.Metadata[graph.IsEgressCluster] == true {
			continue
		}
		// a serviceEntry has at most one outgoing edge, to an egress gateway. (note: it may be that it
		// can only lead to "istio-egressgateway" but at the time of writing we're not sure, and so don't
		// want to hardcode that assumption.)
		if len(n.Edges) > 1 {
			continue
		}

		// To match, a service entry must be exported to the source namespace, and the requested
		// service must match a defined host.  Note that teh source namespace is assumed to be the
		// the same as the appender namespace as all requests for the service entry should be coming
		// from workloads in the current namespace being processed for the graph.
		if se, ok := a.getServiceEntry(namespaceInfo.Namespace, n.Service, globalInfo); ok {
			if nodes, ok := seMap[se]; ok {
				seMap[se] = append(nodes, n)
			} else {
				seMap[se] = []*graph.Node{n}
			}
		}
	}

	// Replace "se-service" nodes with an "se-aggregate" serviceEntry node
	for se, seServiceNodes := range seMap {
		serviceEntryNode := graph.NewNode(globalInfo.HomeCluster, namespaceInfo.Namespace, se.name, "", "", "", "", a.GraphType)
		serviceEntryNode.Metadata[graph.IsServiceEntry] = &graph.SEInfo{
			Location: se.location,
			Hosts:    se.hosts,
		}
		serviceEntryNode.Metadata[graph.DestServices] = graph.NewDestServicesMetadata()
		for _, doomedSeServiceNode := range seServiceNodes {
			// aggregate node traffic
			graph.AggregateNodeTraffic(doomedSeServiceNode, &serviceEntryNode)
			// aggregate node dest-services to capture all of the distinct requested services
			if destServices, ok := doomedSeServiceNode.Metadata[graph.DestServices]; ok {
				for k, v := range destServices.(graph.DestServicesMetadata) {
					serviceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)[k] = v
				}
			}
			// redirect edges leading to the doomed se-service node to the new aggregate
			for _, n := range trafficMap {
				for _, edge := range n.Edges {
					if edge.Dest.ID == doomedSeServiceNode.ID {
						edge.Dest = &serviceEntryNode
					}
				}

				// If there is more than one doomed node, edges leading to the new aggregated node must
				// also be aggregated per source and protocol.
				if len(seServiceNodes) > 1 {
					aggregateEdges(n, &serviceEntryNode)
				}
			}
			// redirect/aggregate edges leading from the doomed se-service node [to an egress gateway]
			for _, doomedEdge := range doomedSeServiceNode.Edges {
				var aggregateEdge *graph.Edge
				for _, e := range serviceEntryNode.Edges {
					if doomedEdge.Dest.ID == e.Dest.ID && doomedEdge.Metadata[graph.ProtocolKey] == e.Metadata[graph.ProtocolKey] {
						aggregateEdge = e
						break
					}
				}
				if nil == aggregateEdge {
					aggregateEdge = serviceEntryNode.AddEdge(doomedEdge.Dest)
					aggregateEdge.Metadata[graph.ProtocolKey] = doomedEdge.Metadata[graph.ProtocolKey]
				}
				graph.AggregateEdgeTraffic(doomedEdge, aggregateEdge)
			}
			delete(trafficMap, doomedSeServiceNode.ID)
		}
		trafficMap[serviceEntryNode.ID] = &serviceEntryNode
	}
}

// getServiceEntry queries the cluster API to resolve service entries across all accessible namespaces
// in the cluster.
// TODO: I don't know what happens (nothing good) if a ServiceEntry is defined in an inaccessible namespace
// but exported to all namespaces (exportTo: *). It's possible that would allow traffic to flow from an
// accessible workload through a serviceEntry whose definition we can't fetch.
func (a ServiceEntryAppender) getServiceEntry(namespace, serviceName string, globalInfo *graph.AppenderGlobalInfo) (*serviceEntry, bool) {
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
					se := serviceEntry{
						exportTo:  entry.Spec.ExportTo,
						location:  location,
						name:      entry.Metadata.Name,
						namespace: entry.Metadata.Namespace,
					}
					for _, host := range entry.Spec.Hosts.([]interface{}) {
						serviceEntryHosts.addHost(host.(string), &se)
					}
				}
			}
		}
		globalInfo.Vendor[serviceEntryHostsKey] = serviceEntryHosts
	}

	for host, serviceEntriesForHost := range serviceEntryHosts {
		for _, se := range serviceEntriesForHost {
			if !isExportedToNamespace(se, namespace) {
				continue
			}

			// handle exact match
			// note: this also handles wildcard-prefix cases because the destination_service_name set by istio
			// is the matching host (e.g. *.wikipedia.com), not the rested service (e.g. de.wikipedia.com)
			if host == serviceName {
				return se, true
			}
			// handle serviceName prefix (e.g. host = serviceName.namespace.svc.cluster.local)
			if se.location == "MESH_INTERNAL" {
				hostSplitted := strings.Split(host, ".")

				if len(hostSplitted) == 3 && hostSplitted[2] == config.IstioMultiClusterHostSuffix {
					// If suffix is "global", this node should be a service entry
					// related to multi-cluster configs. Only exact match should be done, so
					// skip prefix matching.
					//
					// Number of entries == 3 in the host is checked because the host
					// must be of the form svc.namespace.global for Istio to
					// work correctly in the multi-cluster/multiple-control-plane scenario.
					continue
				} else if hostSplitted[0] == serviceName {
					return se, true
				}
			}
		}
	}

	return nil, false
}

func isExportedToNamespace(se *serviceEntry, namespace string) bool {
	if se.exportTo == nil {
		return true
	}
	for _, export := range se.exportTo.([]interface{}) {
		if export == "*" {
			return true
		}
		if export == "." && se.namespace == namespace {
			return true
		}
		if export == se.namespace {
			return true
		}
	}

	return false
}

// aggregateEdges identifies edges that are going from <node> to <serviceEntryNode> and
// aggregates them in only one edge per protocol. This ensures that the traffic map
// will comply with the assumption/rule of one edge per protocol between any two nodes.
func aggregateEdges(node *graph.Node, serviceEntryNode *graph.Node) {
	edgesToAggregate := make(map[string][]*graph.Edge)
	bound := 0
	for _, edge := range node.Edges {
		if edge.Dest == serviceEntryNode {
			protocol := edge.Metadata[graph.ProtocolKey].(string)
			edgesToAggregate[protocol] = append(edgesToAggregate[protocol], edge)
		} else {
			// Manipulating the slice as in this StackOverflow post: https://stackoverflow.com/a/20551116
			node.Edges[bound] = edge
			bound++
		}
	}
	node.Edges = node.Edges[:bound]
	// Add aggregated edge
	for protocol, edges := range edgesToAggregate {
		aggregatedEdge := node.AddEdge(serviceEntryNode)
		aggregatedEdge.Metadata[graph.ProtocolKey] = protocol
		for _, e := range edges {
			graph.AggregateEdgeTraffic(e, aggregatedEdge)
		}
	}
}
