package appender

import (
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
)

const DeadNodeAppenderName = "deadNode"

// DeadNodeAppender is responsible for removing from the graph unwanted nodes:
// - nodes for which there is no traffic reported and the related schema is missing
//   (presumably removed from K8S). (kiali-621)
// - service nodes for which there is no incoming error traffic and no outgoing
//   edges (kiali-1326). Kiali-1526 adds an exclusion to this rule. Egress is a special
//   terminal service node and we want to show it even if it has no incoming traffic
//   for the time period.
// Name: deadNode
type DeadNodeAppender struct{}

// Name implements Appender
func (a DeadNodeAppender) Name() string {
	return DeadNodeAppenderName
}

// AppendGraph implements Appender
func (a DeadNodeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *NamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	var err error
	if globalInfo.Business == nil {
		globalInfo.Business, err = business.Get()
		checkError(err)
	}
	if namespaceInfo.WorkloadList == nil {
		workloadList, err := globalInfo.Business.Workload.GetWorkloadList(namespaceInfo.Namespace)
		checkError(err)
		namespaceInfo.WorkloadList = &workloadList
	}

	applyDeadNodes(trafficMap, globalInfo, namespaceInfo)
}

func applyDeadNodes(trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *NamespaceInfo) {
	numRemoved := 0
	for id, n := range trafficMap {
		switch n.NodeType {
		case graph.NodeTypeUnknown:
			continue
		case graph.NodeTypeService:
			// a service node with outgoing edges is never considered dead (or egress)
			if len(n.Edges) > 0 {
				continue
			}

			// a service node with no outgoing edges may be an egress. if so flag it, don't discard it
			// (kiali-1526). The flag will be passed to the UI to inhibit links to non-existent detail
			// pages. An egress service should have a service entry in the current namespace.
			if n.Namespace == namespaceInfo.Namespace {
				isEgress, ok := namespaceInfo.ExternalServices[n.Service]
				if !ok {
					isEgress = isExternalService(n.Service, namespaceInfo, globalInfo)
				}
				if isEgress {
					n.Metadata["isEgress"] = true
					continue
				}
			}

			// a service node with no incoming error traffic and no outgoing edges, is dead.
			// Incoming non-error traffic can not raise the dead because it is caused by an
			// edge case (pod life-cycle change) that we don't want to see.
			rate4xx, hasRate4xx := n.Metadata["rate4xx"]
			rate5xx, hasRate5xx := n.Metadata["rate5xx"]
			if (!hasRate4xx || rate4xx.(float64) == 0) && (!hasRate5xx || rate5xx.(float64) == 0) {
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

			// Remove if backing workload is not defined, flag if there are no pods
			if workload, found := getWorkload(n.Workload, namespaceInfo.WorkloadList); !found {
				delete(trafficMap, id)
				numRemoved++
			} else {
				if workload.PodCount == 0 {
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

// resolveExternalServices queries the cluster API to resolve egress services
// by using ServiceEntries resources across all namespaces in the cluster.
// All ServiceEntries are needed, because Istio does not distinguish where the
// ServiceEntries are created when routing egress traffic.
func isExternalService(service string, namespaceInfo *NamespaceInfo, globalInfo *GlobalInfo) bool {
	if namespaceInfo.ExternalServices == nil {
		namespaceInfo.ExternalServices = make(map[string]bool)

		// Currently no other appenders use ServiceEntries, so they are not cached in NamespaceInfo
		istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigList(business.IstioConfigCriteria{
			IncludeServiceEntries: true,
			Namespace:             namespaceInfo.Namespace,
		})
		checkError(err)

		for _, entry := range istioCfg.ServiceEntries {
			if entry.Spec.Hosts != nil && entry.Spec.Location == "MESH_EXTERNAL" {
				for _, host := range entry.Spec.Hosts.([]interface{}) {
					namespaceInfo.ExternalServices[host.(string)] = true
				}
			}
		}
	}

	return namespaceInfo.ExternalServices[service]
}
