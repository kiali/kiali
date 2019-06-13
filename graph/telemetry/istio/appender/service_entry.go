package appender

import (
	"strings"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
)

const ServiceEntryAppenderName = "serviceEntry"

// ServiceEntryAppender is responsible for identifying service nodes that are Istio Service Entries.
// Name: serviceEntry
// Doc Links
// - https://istio.io/docs/reference/config/networking/v1alpha3/service-entry/#ServiceEntry
// - https://istio.io/docs/examples/advanced-gateways/wildcard-egress-hosts/
//
// A note about wildcard hosts. External service entries allow for prefix wildcarding such that
// many different service requests may be handled by the same service entry definition.  For example,
// host = *.wikipedia.com would match requests for en.wikipedia.com and de.wikipedia.com. The Istio
// telemetry will produce separate service nodes for each distinct address. Nothing in the
// graph code, including this appender, will aggregate the service nodes into one service entry node,
// although each will be flagged as a serviceEntry due to the wildcard matching. On the plus side,
// users can track request traffic to each distinct url. On the negative side, many distinct urls
// will generate many distinct serviceEntry nodes in the graph.  Unless we get negative community
// feedback on the current behavior we will stick with the current, simpler, approach.
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
func (a ServiceEntryAppender) getServiceEntry(serviceName string, globalInfo *graph.AppenderGlobalInfo) (string, bool) {
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
							location: location,
							host:     host.(string),
						})
					}
				}
			}
		}
		globalInfo.Vendor[serviceEntryHostsKey] = serviceEntryHosts
	}

	for _, serviceEntryHost := range serviceEntryHosts {
		// handle exact match
		if serviceEntryHost.host == serviceName {
			return serviceEntryHost.location, true
		}
		// handle serviceName prefix (e.g. host = serviceName.namespace.svc.cluster.local)
		if serviceEntryHost.location == "MESH_INTERNAL" {
			if strings.Split(serviceEntryHost.host, ".")[0] == serviceName {
				return serviceEntryHost.location, true
			}
		}
		// handle wildcard
		if serviceEntryHost.location == "MESH_EXTERNAL" && strings.HasPrefix(serviceEntryHost.host, "*.") {
			domain := strings.TrimPrefix(serviceEntryHost.host, "*.")
			if strings.HasSuffix(serviceName, domain) {
				return serviceEntryHost.location, true
			}
		}
	}

	return "", false
}
