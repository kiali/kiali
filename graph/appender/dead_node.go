package appender

import (
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
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
type DeadNodeAppender struct {
	AccessibleNamespaces map[string]time.Time
}

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

	a.applyDeadNodes(trafficMap, globalInfo, namespaceInfo)
}

func (a DeadNodeAppender) applyDeadNodes(trafficMap graph.TrafficMap, globalInfo *GlobalInfo, namespaceInfo *NamespaceInfo) {
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

			// A service node with no outgoing edges may be an egress.
			// If so flag it, don't discard it (kiali-1526, see also kiali-2014).
			// The flag will be passed to the UI to inhibit links to non-existent detail pages.
			if a.isExternalService(n.Service, namespaceInfo, globalInfo) {
				n.Metadata["isEgress"] = true
				continue
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

// isExternalService queries the cluster API to resolve egress services
// by using ServiceEntries resources across all namespaces in the cluster.
// All ServiceEntries are needed because Istio does not distinguish where the
// ServiceEntries are created when routing egress traffic (i.e. a ServiceEntry
// can be in any namespace and it will still work).
// However, an egress service will have its namespace set to "default" in the telemetry.
func (a DeadNodeAppender) isExternalService(service string, namespaceInfo *NamespaceInfo, globalInfo *GlobalInfo) bool {
	if globalInfo.ExternalServices == nil {
		globalInfo.ExternalServices = make(map[string]bool)

		for ns := range a.AccessibleNamespaces {
			istioCfg, err := globalInfo.Business.IstioConfig.GetIstioConfigList(business.IstioConfigCriteria{
				IncludeServiceEntries: true,
				Namespace:             ns,
			})
			checkError(err)

			for _, entry := range istioCfg.ServiceEntries {
				if entry.Spec.Hosts != nil && entry.Spec.Location == "MESH_EXTERNAL" {
					for _, host := range entry.Spec.Hosts.([]interface{}) {
						globalInfo.ExternalServices[host.(string)] = true
					}
				}
			}
		}
		log.Tracef("Found [%v] egress service entries", len(globalInfo.ExternalServices))
	}

	return globalInfo.ExternalServices[service]
}
