package appender

import (
	"crypto/md5"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const (
	ExtensionsAppenderName string            = "extensions"
	tsHash                 graph.MetadataKey = "tsHash"
	tsHashMap              graph.MetadataKey = "tsHashMap"
)

// ExtensionsAppender looks for configured extensions and adds extension traffic to the graph, as needed.  This is
// a Finalizer appender, designed to be run after the full Istio graph is generated.
// Name: extensions
type ExtensionsAppender struct {
	Duration         time.Duration
	GraphType        string
	IncludeIdleEdges bool
	QueryTime        int64 // unix time in seconds
}

// Name implements Appender
func (a ExtensionsAppender) Name() string {
	return ExtensionsAppenderName
}

// IsFinalizer implements Appender
func (a ExtensionsAppender) IsFinalizer() bool {
	return true
}

// AppendGraph implements Appender
func (a ExtensionsAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	log.Info("In Extensions")

	cfg := config.Get()
	if len(cfg.Extensions) == 0 {
		return
	}

	if globalInfo.PromClient == nil {
		var err error
		globalInfo.PromClient, err = prometheus.NewClient()
		graph.CheckError(err)
	}

	// Process the extensions defined in the config
	for _, extension := range cfg.Extensions {
		if !extension.Enabled {
			continue
		}
		a.appendGraph(trafficMap, extension, globalInfo.PromClient)
	}
}

func (a ExtensionsAppender) appendGraph(trafficMap graph.TrafficMap, ext config.ExtensionConfig, client *prometheus.Client) {
	// Look for the extension's root node in the current traffic map (eg the skupper-router for the defined site).  If found, then we
	// will query the extension metrics for extension traffic from the root.  Otherwise, skip extenstion traffic because this
	// graph has no traffic to the root. (maybe a todo option: to always show extension traffic, based on an appender option)
	rootID, _, _ := graph.Id(ext.RootCluster, ext.RootNamespace, ext.RootService, "", "", "", ext.RootVersion, a.GraphType)
	rootNode, found := trafficMap[rootID]
	if !found {
		log.Infof("Extension [%s] did not find root node in traffic map [%s:%s:%s]", ext.Name, ext.RootCluster, ext.RootNamespace, ext.RootService)
		return
	}
	log.Infof("Extension [%s] found root node [%+v]", ext.Name, rootNode)

	//
	// Request Traffic (HTTP, gRPC)
	//

	// Grab all of the extension traffic for the time period, regardless of reporters or namespaces, in one shot.  This is a departure
	// from the usual approach, but until it proves too heavy, let's give it a try...
	groupBy := "dest_cluster, dest_namespace, dest_service, dest_version, flags, protocol, security, source_cluster, source_namespace, source_service, source_version, status_code"
	idleCondition := "> 0"
	if a.IncludeIdleEdges {
		idleCondition = ""
	}
	metric := "kiali_ext_requests_total"

	query := fmt.Sprintf(`sum(rate(%s{extension="%s"} [%vs])) by (%s) %s`,
		metric,
		ext.Name,
		int(a.Duration.Seconds()), // range duration for the query
		groupBy,
		idleCondition)
	log.Infof("Extension requests query [%s]", query)
	vector := promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
	a.appendTrafficMap(trafficMap, ext, &vector, metric)

	//
	// TCP Traffic
	//

	// Grab all of the extension traffic for the time period, regardless of reporters or namespaces, in one shot.  This is a departure
	// from the usual approach, but until it proves too heavy, let's give it a try...
	groupBy = "dest_cluster, dest_namespace, dest_service, dest_version, flags, security, source_cluster, source_namespace, source_service, source_version"
	metric = "kiali_ext_tcp_sent_total"

	query = fmt.Sprintf(`sum(rate(%s{extension="%s"} [%vs])) by (%s) %s`,
		metric,
		ext.Name,
		int(a.Duration.Seconds()), // range duration for the query
		groupBy,
		idleCondition)
	log.Infof("Extension tcp query [%s]", query)
	vector = promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
	a.appendTrafficMap(trafficMap, ext, &vector, metric)
}

func (a ExtensionsAppender) appendTrafficMap(trafficMap graph.TrafficMap, ext config.ExtensionConfig, vector *model.Vector, metric string) {
	isRequests := true
	protocol := ""
	if strings.HasPrefix(metric, "kiali_ext_tcp") {
		isRequests = false
		protocol = graph.TCP.Name
	}

	for _, s := range *vector {
		val := float64(s.Value)

		m := s.Metric
		lSourceCluster, sourceClusterOk := m["source_cluster"]
		lSourceNs, sourceNsOk := m["source_namespace"]
		lSourceSvc, sourceSvcOk := m["source_service"]
		lSourceVer, sourceVerOk := m["source_version"]
		lDestCluster, destClusterOk := m["dest_cluster"]
		lDestNs, destNsOk := m["dest_namespace"]
		lDestSvc, destSvcOk := m["dest_service"]
		lDestVer, destVerOk := m["dest_version"]

		if !sourceClusterOk || !sourceNsOk || !sourceSvcOk || !sourceVerOk || !destClusterOk || !destNsOk || !destSvcOk || !destVerOk {
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
			continue
		}

		sourceCluster := string(lSourceCluster)
		sourceNs := string(lSourceNs)
		sourceSvc := string(lSourceSvc)
		sourceVer := string(lSourceVer)
		destCluster := string(lDestCluster)
		destNs := string(lDestNs)
		destSvc := string(lDestSvc)
		destVer := string(lDestVer)

		flags := ""
		if isRequests || protocol == graph.TCP.Name {
			lFlags, flagsOk := m["flags"]
			if !flagsOk {
				log.Warningf("Skipping %s, missing expected TS labels", m.String())
				continue
			}
			flags = string(lFlags)
		}

		var code string
		if isRequests {
			lProtocol, protocolOk := m["protocol"]
			lCode, codeOk := m["status_code"]

			if !protocolOk || !codeOk {
				log.Warningf("Skipping %s, missing expected request TS labels", m.String())
				continue
			}

			protocol = string(lProtocol)
			code = string(lCode)
		}

		a.addTraffic(trafficMap, metric, val, protocol, code, flags, sourceCluster, sourceNs, sourceSvc, sourceVer, destCluster, destNs, destSvc, destVer)
	}
}

func (a ExtensionsAppender) addTraffic(trafficMap graph.TrafficMap, metric string, val float64, protocol, code, flags, sourceCluster, sourceNs, sourceSvc, sourceVer, destCluster, destNs, destSvc, destVer string) {
	source, _, err := a.addNode(trafficMap, sourceCluster, sourceNs, sourceSvc, sourceVer, a.GraphType)
	if err != nil {
		log.Warningf("Skipping extension addTraffic (source) in extension, %s", err)
		return
	}
	dest, _, err := a.addNode(trafficMap, destCluster, destNs, destSvc, destVer, a.GraphType)
	if err != nil {
		log.Warningf("Skipping extension addTraffic (dest), %s", err)
		return
	}

	// Extensions maygenerate duplicate metrics by reporting from both the source and destination. To avoid
	// processing the same information twice we keep track of the time series applied to a particular edge. The
	// edgeTSHash incorporates information about the time series' source, destination and metric information,
	// and uses that unique TS has to protect against applying the same intomation twice.
	edgeTSHash := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s", metric, source.Metadata[tsHash], dest.Metadata[tsHash], code, flags, destSvc))))

	a.addEdgeTraffic(trafficMap, val, protocol, code, flags, destSvc, source, dest, edgeTSHash)
}

// addEdgeTraffic uses edgeTSHash that the metric information has not been applied to the edge. Returns true
// if the the metric information is applied, false if it determined to be a duplicate.
func (a ExtensionsAppender) addEdgeTraffic(trafficMap graph.TrafficMap, val float64, protocol, code, flags, host string, source, dest *graph.Node, edgeTSHash string) bool {
	var edge *graph.Edge
	for _, e := range source.Edges {
		if dest.ID == e.Dest.ID && e.Metadata[graph.ProtocolKey] == protocol {
			edge = e
			break
		}
	}
	if nil == edge {
		edge = source.AddEdge(dest)
		edge.Metadata[graph.ProtocolKey] = protocol
		edge.Metadata[tsHashMap] = make(map[string]bool)
	}

	if _, ok := edge.Metadata[tsHashMap].(map[string]bool)[edgeTSHash]; !ok {
		edge.Metadata[tsHashMap].(map[string]bool)[edgeTSHash] = true
		graph.AddToMetadata(protocol, val, code, flags, host, source.Metadata, dest.Metadata, edge.Metadata)
		return true
	}

	return false
}

func (a ExtensionsAppender) addNode(trafficMap graph.TrafficMap, cluster, serviceNs, service, version, graphType string) (*graph.Node, bool, error) {
	id, nodeType, err := graph.Id(cluster, serviceNs, service, "", "", "", version, graphType)
	if err != nil {
		return nil, false, err
	}
	node, found := trafficMap[id]
	if !found {
		namespace := serviceNs
		newNode := graph.NewNodeExplicit(id, cluster, namespace, "", "", version, service, nodeType, a.GraphType)
		node = newNode
		trafficMap[id] = node
	}
	node.Metadata["tsHash"] = timeSeriesHash(cluster, serviceNs, service, "", "", "", version)
	return node, found, nil
}

func timeSeriesHash(cluster, serviceNs, service, workloadNs, workload, app, version string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s", cluster, serviceNs, service, workloadNs, workload, app, version))))
}

/*
	for _, s := range *vector {
		m := s.Metric
		lAddress, addressOk := m["address"]
		lDestSite, destSiteOk := m["destSite"]
		lProtocol, protocolOk := m["protocol"]

		log.Info("Found Flow %s", m.String)
		if !addressOk || !destSiteOk || !protocolOk {
			log.Warningf("Extensions appender appendTrafficMap: Skipping %s, missing expected labels", m.String())
			continue
		}

		val := float64(s.Value)

		// Should not happen but if NaN for any reason, Just skip it
		if math.IsNaN(val) {
			continue
		}

		address := string(lAddress)
		destSite := string(lDestSite)
		protocol := string(lProtocol)

		destSvc := strings.Split(address, `:`)[0]
		destSvcNamespace := strings.Split(destSite, `@`)[0]

		destNodeID, destNodeType, _ := graph.Id(ext.Source_node_cluster, destSvcNamespace, destSvc, "", "", "", "", a.GraphType)
		destNode, found := trafficMap[destNodeID]
		if !found {
			log.Info("Added Dest Node %s", destNodeID)
			destNode = graph.NewNodeExplicit(destNodeID, ext.Source_node_cluster, destSvcNamespace, "", "", "", destSvc, destNodeType, a.GraphType)
			trafficMap[destNodeID] = destNode
		}
		edge := sourceNode.AddEdge(destNode)
		edge.Metadata[graph.ProtocolKey] = protocol
		graph.AddToMetadata(protocol, val, "", "", "skupper", sourceNode.Metadata, destNode.Metadata, edge.Metadata)
	}
*/
