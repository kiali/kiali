package appender

import (
	"context"
	"strings"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

const ServiceEntryAppenderName = "serviceEntry"

// ServiceEntryAppender is responsible for identifying service nodes that are defined in Istio as
// a serviceEntry. A single serviceEntry can define multiple hosts and as such multiple service nodes may
// map to different hosts of a single serviceEntry. We'll call these "se-service" nodes.  The appender
// handles this in the following way:
//
//		For Each "se-service" node
//		   1. if necessary, create a "service-entry" node to aggregate this, and possibly other, "se-service" nodes
//		     -- a "service-entry" node is a service node-type with isServiceEntry set in the metadata
//		     -- a "service-entry" is namespace-specific; An Istio service entry is defined in a particular
//	         namespace, but it can be "exported" to many (all namespaces by default).  So, think as if the
//	         service entry definition is duplicated in each exported namespace, and therefore you can get a
//	         "service-entry" node in each.
//		   2. aggregate the "se-service" node into the appropriate, new or existing, "service-entry" node
//		     -- incoming edges
//		     -- outgoing edges (unusual but can have outgoing edge to egress gateway)
//		     -- per-host traffic (in the metadata)
//		   3. remove the "se-service" node from the trafficMap
//		   4. add any new "service-entry" node to the trafficMap
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
// A note about visibility. The namespace-local representation above is only used when the requesting
// namespace can see the ServiceEntry. We build a host lookup per (cluster, requesting namespace),
// first checking the ServiceEntry's exportTo, or meshConfig.defaultServiceExportTo when omitted.
// meshConfig.serviceEntryVisibility can further restrict that scope; it never widens exportTo.
// Its policies are matched in order against the labels of the original definition namespace,
// not the requesting namespace. The first matching policy wins, otherwise defaultVisibility applies.
// The shared visibility evaluator combines that result with the exportTo decision.
//
// We assume requesting namespaces with IsAmbient=true have ambient callers, and other namespaces
// have sidecar callers. The visibility constraint applies to ambient callers and also to sidecar
// callers when applyToSidecars=true, including in sidecar-only deployments. Otherwise only the
// existing exportTo rules apply. Compiled policies are reused with the cached mesh snapshot;
// namespace host lookups are rebuilt as needed for each graph generation.
//
// This only controls attribution to a ServiceEntry. A host that is not visible to the requesting
// namespace is left to normal graph handling, preserving observed traffic. Eligible hosts still
// use the same namespace-local ServiceEntry representation and aggregation described above.
type ServiceEntryAppender struct {
	AccessibleNamespaces graph.AccessibleNamespaces
	GraphType            string
}

// Name implements Appender
func (a ServiceEntryAppender) Name() string {
	return ServiceEntryAppenderName
}

// IsFinalizer implements Appender
func (a ServiceEntryAppender) IsFinalizer() bool {
	return false
}

// AppendGraph implements Appender
func (a ServiceEntryAppender) AppendGraph(ctx context.Context, trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	// First, identify the candidate "se-service" nodes (i.e. the service nodes that are candidates for conversion to a "service-entry" node)
	candidates := make(map[string]*graph.Node)
	for _, n := range trafficMap {
		// a non-injected service node may represent a mesh_internal ServiceEntry, if it has cluster and namespace set
		if n.NodeType == graph.NodeTypeService {
			isInjected := n.Metadata[graph.IsInjected] == true
			if !isInjected && graph.IsOK(n.Cluster) && graph.IsOK(n.Namespace) {
				candidates[n.ID] = n
			}
			continue
		}

		// for non-service nodes, look for edges to non-injected service nodes that may represent a mesh_external ServicEntry.
		// It probably will not have cluster and namespace set (because it's external to the mesh, the dest_service is just a
		// host name), either way, we need to get this information from the source node because it is the requesting service
		// that needs access to the ServiceEntry.
		for _, e := range n.Edges {
			isDestService := e.Dest.NodeType == graph.NodeTypeService
			isDestInjected := e.Dest.Metadata[graph.IsInjected] == true
			if isDestService && !isDestInjected {
				candidates[n.ID] = n
				break
			}
		}
	}
	// If there are no "se-service" node candidates then we can return immediately.
	if len(candidates) == 0 {
		return
	}

	// Fetch mesh once and precompute namespace -> MeshConfig for all candidate
	// (cluster, namespace) pairs. This avoids repeated discovery.Mesh() mutex acquisition inside the loop.
	nsMeshConfigs := make(map[string]*models.MeshConfig)
	mesh, err := globalInfo.Business.Mesh.GetMesh(ctx)
	if err == nil && mesh != nil {
		byCluster := make(map[string][]string)
		for _, n := range candidates {
			byCluster[n.Cluster] = append(byCluster[n.Cluster], n.Namespace)
		}
		for cluster, namespaces := range byCluster {
			for ns, meshConfig := range mesh.BuildNamespaceToMeshConfig(cluster, namespaces) {
				nsMeshConfigs[graph.GetClusterSensitiveKey(cluster, ns)] = meshConfig
			}
		}
	}

	// Otherwise, if there are SE hosts defined for the cluster:namespace, check to see if they apply to the node
	finalCandidates := []*graph.Node{}
	for _, n := range candidates {
		nsMeshConfig := nsMeshConfigs[graph.GetClusterSensitiveKey(n.Cluster, n.Namespace)]
		if a.loadServiceEntryHosts(ctx, n.Cluster, n.Namespace, nsMeshConfig, globalInfo) {
			finalCandidates = append(finalCandidates, n)
		}
	}

	if len(finalCandidates) > 0 {
		a.applyServiceEntries(ctx, trafficMap, finalCandidates, globalInfo, namespaceInfo)
	}
}

// loadServiceEntryHosts loads serviceEntry hosts for the provided cluster and namespace. Returns true if any are found, otherwise false.
func (a ServiceEntryAppender) loadServiceEntryHosts(ctx context.Context, cluster, namespace string, meshConfig *models.MeshConfig, globalInfo *GlobalInfo) bool {
	if !a.isAccessible(cluster, namespace) {
		return false
	}

	serviceEntryHosts, found := getServiceEntryHosts(cluster, namespace, globalInfo)
	if !found {
		istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigList(ctx, cluster, business.IstioConfigCriteria{
			IncludeServiceEntries: true,
		})
		graph.CheckError(err)

		requestingNamespace := a.AccessibleNamespaces[graph.GetClusterSensitiveKey(cluster, namespace)]
		requestingAmbient := requestingNamespace.IsAmbient
		var applyVisibility bool
		var definitionNamespaces map[string]models.Namespace
		var visibilities map[string]models.ServiceEntryVisibility
		if meshConfig != nil {
			visibility := meshConfig.GetServiceEntryVisibility()
			applyVisibility = visibility != nil && (requestingAmbient || visibility.GetApplyToSidecars())
			if applyVisibility {
				visibilities = make(map[string]models.ServiceEntryVisibility)
				if len(visibility.GetPolicies()) > 0 {
					definitionNamespaces = getServiceEntryNamespaces(ctx, cluster, globalInfo)
				}
			}
		}
		policy := meshConfig.ServiceEntryVisibilityPolicy()
		// Keep the namespace-local graph representation, but only attribute hosts that
		// this requesting namespace can see. Rejected hosts retain their observed traffic.
		for _, entry := range istioCfg.ServiceEntries {
			var visible bool
			if applyVisibility {
				visibility, resolved := visibilities[entry.Namespace]
				if !resolved {
					visibility = policy.ForNamespace(entry.Namespace, definitionNamespaces[entry.Namespace].Labels)
					visibilities[entry.Namespace] = visibility
				}
				visible = visibility.IsVisible(entry.Spec.ExportTo, namespace, requestingAmbient)
			} else {
				visible = policy.IsExportedTo(entry.Spec.ExportTo, entry.Namespace, namespace)
			}
			if entry.Spec.Hosts != nil && visible {
				location := "MESH_EXTERNAL"
				if entry.Spec.Location.String() == "MESH_INTERNAL" {
					location = "MESH_INTERNAL"
				}
				se := serviceEntry{
					cluster:   cluster,
					exportTo:  entry.Spec.ExportTo,
					location:  location,
					name:      entry.Name,
					namespace: namespace,
				}
				for _, host := range entry.Spec.Hosts {
					serviceEntryHosts.addHost(host, &se)
				}
			}
		}
	}
	return len(serviceEntryHosts) > 0
}

func getServiceEntryNamespaces(ctx context.Context, cluster string, globalInfo *GlobalInfo) map[string]models.Namespace {
	if namespaces, found := globalInfo.Vendor.ServiceEntryNamespaces[cluster]; found {
		return namespaces
	}
	list, err := globalInfo.Business.Namespace.GetClusterNamespaces(ctx, cluster)
	graph.CheckError(err)
	namespaces := make(map[string]models.Namespace, len(list))
	for _, ns := range list {
		namespaces[ns.Name] = ns
	}
	globalInfo.Vendor.ServiceEntryNamespaces[cluster] = namespaces
	return namespaces
}

func (a ServiceEntryAppender) applyServiceEntries(ctx context.Context, trafficMap graph.TrafficMap, candidates []*graph.Node, globalInfo *GlobalInfo, namespaceInfo *AppenderNamespaceInfo) {
	zl := log.FromContext(ctx)

	// a map from "service-entry" information to matching "se-service" nodes
	seMap := make(map[*serviceEntry][]*graph.Node)

	for _, n := range candidates {
		if n.NodeType == graph.NodeTypeService {
			// Must be a non-egress(PassthroughCluster or BlackHoleCluster) service node
			candidate := n
			isEgressCluster := candidate.Metadata[graph.IsEgressCluster] == true
			if candidate.NodeType == graph.NodeTypeService && !isEgressCluster {
				// To match, a service entry must be exported to the candidate's cluster and namespace, and
				// the requested service must match a defined host. Fwiw, the candidate's namespace should be the
				// the same as the appender namespace, as all requests for the service entry should be coming
				// from workloads in the current namespace being processed for the graph.
				if se, ok := a.getServiceEntry(candidate.Cluster, candidate.Namespace, candidate.Service, globalInfo); ok {
					if nodes, ok := seMap[se]; ok {
						seMap[se] = append(nodes, candidate)
					} else {
						seMap[se] = []*graph.Node{candidate}
					}
				}
			}
			continue
		}

		for _, e := range n.Edges {
			// Must be a non-egress(PassthroughCluster or BlackHoleCluster) service node
			candidate := e.Dest
			isEgressCluster := candidate.Metadata[graph.IsEgressCluster] == true
			if candidate.NodeType == graph.NodeTypeService && !isEgressCluster {
				// Same matching rules as above, but SE must be available to the source node
				if se, ok := a.getServiceEntry(n.Cluster, n.Namespace, candidate.Service, globalInfo); ok {
					if nodes, ok := seMap[se]; ok {
						seMap[se] = append(nodes, candidate)
					} else {
						seMap[se] = []*graph.Node{candidate}
					}
				}
			}
		}
	}

	// Replace "se-service" nodes with a "service-entry" node
	for se, seServiceNodes := range seMap {
		serviceEntryNode, err := graph.NewNode(se.cluster, namespaceInfo.Namespace, se.name, "", "", "", "", a.GraphType)
		if err != nil {
			zl.Warn().Msgf("Skipping serviceEntryNode, %s", err)
			continue
		}
		serviceEntryNode.Metadata[graph.IsServiceEntry] = &graph.SEInfo{
			Hosts:     se.hosts,
			Location:  se.location,
			Namespace: se.namespace,
		}
		serviceEntryNode.Metadata[graph.DestServices] = graph.NewDestServicesMetadata()

		for _, doomedSeServiceNode := range seServiceNodes {
			// if the doomedSeServiceNode is no longer in the traffic map, then skip. This means
			// it has already been converted when processing a different SE, which can happen
			// when SE's define overlapping host information (resulting in nondeterministic SE matching)
			if _, found := trafficMap[doomedSeServiceNode.ID]; !found {
				continue
			}

			// aggregate node traffic
			graph.AggregateNodeTraffic(doomedSeServiceNode, serviceEntryNode)
			// aggregate node dest-services to capture all of the distinct requested services
			if destServices, ok := doomedSeServiceNode.Metadata[graph.DestServices]; ok {
				for k, v := range destServices.(graph.DestServicesMetadata) {
					serviceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)[k] = v
				}
			}
			// redirect edges leading to the doomed se-service node to the new aggregate.
			deleteDoomedSeServiceNode := true
			for _, n := range trafficMap {
				// note that the doomedSeServiceNode may have edges from nodes in different clusters (see Kiali7589), because
				// it itself may have no cluster or namespace (just some host name). We need to limit this reassignment to
				// only nodes defined on the same cluster as the SE.  Each cluster has its own SE definitions.
				for _, edge := range n.Edges {
					if edge.Dest.ID == doomedSeServiceNode.ID {
						if n.Cluster != serviceEntryNode.Cluster {
							// don't delete the doomedSeServiceNode, it still has edges
							deleteDoomedSeServiceNode = false
							continue
						}
						edge.Dest = serviceEntryNode
					}
				}

				// If there is more than one doomed node, edges leading to the new aggregated node must
				// also be aggregated per source and protocol.
				if len(seServiceNodes) > 1 {
					aggregateEdges(n, serviceEntryNode)
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

			// remove the se-service node
			if deleteDoomedSeServiceNode {
				delete(trafficMap, doomedSeServiceNode.ID)
			}

			// if not done already, add the service entry node
			if _, found := trafficMap[serviceEntryNode.ID]; !found {
				trafficMap[serviceEntryNode.ID] = serviceEntryNode
			}
		}
	}
}

// TODO: I don't know what happens (nothing good) if a ServiceEntry is defined in an inaccessible namespace
// but exported to all namespaces (exportTo: *). It's possible that would allow traffic to flow from an
// accessible workload through a serviceEntry whose definition we can't fetch.
func (a ServiceEntryAppender) getServiceEntry(cluster, namespace, serviceName string, globalInfo *GlobalInfo) (*serviceEntry, bool) {
	serviceEntryHosts, _ := getServiceEntryHosts(cluster, namespace, globalInfo)

	for host, serviceEntriesForHost := range serviceEntryHosts {
		for _, se := range serviceEntriesForHost {
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

// returns true if we have access to the cluster-specific namespace
func (a *ServiceEntryAppender) isAccessible(cluster, namespace string) bool {
	key := graph.GetClusterSensitiveKey(cluster, namespace)
	_, ok := a.AccessibleNamespaces[key]
	return ok
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
