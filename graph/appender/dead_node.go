package appender

import (
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/services/business"
)

// DeadNodeAppender is responsible for removing from the graph unwanted nodes:
// - nodes for which there is no traffic reported and the related schema is missing
//   (presumably removed from K8S). (kiali-621)
// - service nodes for which there is no incoming error traffic and no outgoing
//   edges (kiali-1326). Kiali-1526 adds an exclusion to this rule. Egress is a special
//   terminal service node and we want to show it even if it has no incoming traffic
//   for the time period.
type DeadNodeAppender struct {
	// externalServices acts as a cache. This prevents from querying multiple times
	// the cluster for service entries when the graph is requested for all namespaces.
	externalServices map[string]bool
}

// AppendGraph implements Appender
func (a DeadNodeAppender) AppendGraph(trafficMap graph.TrafficMap, _ string) {
	if len(trafficMap) == 0 {
		return
	}

	business, err := business.Get()
	checkError(err)

	if a.externalServices == nil {
		a.externalServices = resolveExternalServices(business)
	}

	applyDeadNodes(trafficMap, business.Workload, a.externalServices)
}

// resolveExternalServices queries the cluster API to resolve egress services
// by using ServiceEntries resources across all namespaces in the cluster.
// All ServiceEntries are needed, because Istio does not distinguish where the
// ServiceEntries are created when routing egress traffic.
func resolveExternalServices(bLayer *business.Layer) map[string]bool {
	namespaces, err := bLayer.Namespace.GetNamespaces()
	checkError(err)

	serviceEntries := make(map[string]bool)
	for _, ns := range namespaces {
		istioCfg, err := bLayer.IstioConfig.GetIstioConfig(business.IstioConfigCriteria{
			IncludeServiceEntries: true,
			Namespace:             ns.Name,
		})
		checkError(err)

		for _, entry := range istioCfg.ServiceEntries {
			if entry.Hosts != nil && entry.Location == "MESH_EXTERNAL" {
				for _, host := range entry.Hosts.([]interface{}) {
					serviceEntries[host.(string)] = true
				}
			}
		}
	}

	return serviceEntries
}

func applyDeadNodes(trafficMap graph.TrafficMap, wkSvc business.WorkloadService, serviceEntries map[string]bool) {
	numRemoved := 0
	for id, n := range trafficMap {
		switch n.NodeType {
		case graph.NodeTypeUnknown:
			continue
		case graph.NodeTypeService:
			if serviceEntries[n.Service] {
				// Flag and don't discard the node if it's an external service (kiali-1526).
				// The flag will be passed to the UI to not place links to non-existent details pages.
				n.Metadata["isEgress"] = true
				continue
			}
			// a service node with no incoming error traffic and no outgoing edges, is dead.
			// Incoming non-error traffic can not raise the dead because it is caused by an
			// edge case (pod life-cycle change) that we don't want to see.
			rate4xx, hasRate4xx := n.Metadata["rate4xx"]
			rate5xx, hasRate5xx := n.Metadata["rate5xx"]
			numOutEdges := len(n.Edges)
			if numOutEdges == 0 && (!hasRate4xx || rate4xx.(float64) == 0) && (!hasRate5xx || rate5xx.(float64) == 0) {
				delete(trafficMap, id)
				numRemoved++
			}
		default:
			// a node with HTTP traffic is not dead, skip
			rate, hasRate := n.Metadata["rate"]
			rateOut, hasRateOut := n.Metadata["rateOut"]
			if (hasRate && rate.(float64) > 0) || (hasRateOut && rateOut.(float64) > 0) {
				continue
			}
			// a node with TCP Sent traffic is not dead, skip
			rate, hasRate = n.Metadata["tcpSentRate"]
			rateOut, hasRateOut = n.Metadata["tcpSentRateOut"]
			if (hasRate && rate.(float64) > 0) || (hasRateOut && rateOut.(float64) > 0) {
				continue
			}
			// a node w/o a valid workload is a versionless app node and can't be dead
			if n.Workload == "" || n.Workload == graph.UnknownWorkload {
				continue
			}

			// Remove if backing deployment is not defined, flag if there are no pods
			// Note that in the future a workload could feasibly be back by something
			// other than a deployment; we may need to query the workload name againts
			// various possibly entities.
			workload, err := wkSvc.GetWorkload(n.Namespace, n.Workload, false)
			if err != nil || workload == nil {
				delete(trafficMap, id)
				numRemoved++
			} else {
				if len(workload.Pods) == 0 {
					n.Metadata["isDead"] = true
				}
			}
		}
	}

	// If we removed any nodes we need to remove any edges to them as well...
	if numRemoved == 0 {
		return
	}

	for _, s := range trafficMap {
		goodEdges := []*graph.Edge{}
		for _, e := range s.Edges {
			if _, found := trafficMap[e.Dest.ID]; found {
				goodEdges = append(goodEdges, e)
			}
		}
		s.Edges = goodEdges
	}
}
