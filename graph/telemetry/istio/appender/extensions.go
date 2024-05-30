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
	Rates            graph.RequestedRates
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
	log.Info("In Extensions") // todo: remove

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
	rootNode, found := a.findRootNode(trafficMap, ext)
	if !found {
		// todo: debug level
		log.Infof("Extension [%s] did not find root node in traffic map [%s:%s:%s]", ext.Name, ext.RootCluster, ext.RootNamespace, ext.RootName)
		return
	}
	log.Infof("Extension [%s] found root node [%+v]", ext.Name, rootNode)

	idleCondition := "> 0"
	if a.IncludeIdleEdges {
		idleCondition = ""
	}

	//
	// Request Traffic (HTTP, gRPC)
	//
	if a.Rates.Http == graph.RateRequests || a.Rates.Grpc == graph.RateRequests {
		// Grab all of the extension traffic for the time period, regardless of reporters or namespaces, in one shot.  This is a departure
		// from the usual approach, but until it proves too heavy, let's give it a try...
		groupBy := "dest_cluster, dest_namespace, dest_service, dest_version, flags, protocol, security, source_cluster, source_namespace, source_service, source_version, status_code"
		metric := "kiali_ext_requests_total"

		query := fmt.Sprintf(`sum(rate(%s{extension="%s"} [%vs])) by (%s) %s`,
			metric,
			ext.Name,
			int(a.Duration.Seconds()), // range duration for the query
			groupBy,
			idleCondition)
		log.Infof("Extension requests query [%s]", query)
		vector := promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
		a.appendTrafficMap(trafficMap, &vector, metric)
	}

	//
	// TCP Traffic
	//
	if a.Rates.Tcp != graph.RateNone {
		var metrics []string

		switch a.Rates.Tcp {
		case graph.RateReceived:
			metrics = []string{"kiali_ext_tcp_received_total"}
		case graph.RateSent:
			metrics = []string{"kiali_ext_tcp_sent_total"}
		case graph.RateTotal:
			metrics = []string{"kiali_ext_tcp_received_total", "kiali_ext_tcp_sent_total"}
		default:
			metrics = []string{}
		}

		for _, metric := range metrics {

			// Grab all of the extension traffic for the time period, regardless of reporters or namespaces, in one shot.  This is a departure
			// from the usual approach, but until it proves too heavy, let's give it a try...
			groupBy := "dest_cluster, dest_namespace, dest_service, dest_version, flags, security, source_cluster, source_namespace, source_service, source_version"

			query := fmt.Sprintf(`sum(rate(%s{extension="%s"} [%vs])) by (%s) %s`,
				metric,
				ext.Name,
				int(a.Duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			log.Infof("Extension tcp query [%s]", query)
			vector := promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
			a.appendTrafficMap(trafficMap, &vector, metric)
		}
	}
}

func (a ExtensionsAppender) appendTrafficMap(trafficMap graph.TrafficMap, vector *model.Vector, metric string) {
	isRequests := true
	protocol := ""
	if strings.HasPrefix(metric, "kiali_ext_tcp") {
		isRequests = false
		protocol = graph.TCP.Name
	}

	skipRequestsGrpc := isRequests && a.Rates.Grpc != graph.RateRequests
	skipRequestsHttp := isRequests && a.Rates.Http != graph.RateRequests

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

			if skipRequestsGrpc && protocol == graph.GRPC.Name || skipRequestsHttp && protocol == graph.HTTP.Name {
				continue
			}
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

	// Extensions may generate duplicate metrics by reporting from both the source and destination. To avoid
	// processing the same information twice we keep track of the time series applied to a particular edge. The
	// edgeTSHash incorporates information about the time series' source, destination and metric information,
	// and uses that unique TS has to protect against applying the same intomation twice.
	edgeTSHash := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s", metric, source.Metadata[tsHash], dest.Metadata[tsHash], code, flags, destSvc))))

	a.addEdgeTraffic(val, protocol, code, flags, destSvc, source, dest, edgeTSHash)
}

// addEdgeTraffic uses edgeTSHash that the metric information has not been applied to the edge. Returns true
// if the the metric information is applied, false if it determined to be a duplicate.
func (a ExtensionsAppender) addEdgeTraffic(val float64, protocol, code, flags, host string, source, dest *graph.Node, edgeTSHash string) bool {
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

// findRootNode tries to match the a configured root node to an actual node in the traffic graph.  Because
// the node type can vary, it tries to match name in this order:
//
//	"workload" in order to match on a workload or versionedApp node
//	"app"      in order to match on an app node
//	"service"  in order to match on a service or service entry node
func (a ExtensionsAppender) findRootNode(trafficMap graph.TrafficMap, ext config.ExtensionConfig) (*graph.Node, bool) {
	// workload name
	rootID, _, _ := graph.Id(ext.RootCluster, "", "", ext.RootNamespace, ext.RootName, "", "", a.GraphType)
	if rootNode, found := trafficMap[rootID]; found {
		return rootNode, found
	}
	// app name
	rootID, _, _ = graph.Id(ext.RootCluster, "", "", ext.RootNamespace, "", ext.RootName, "", a.GraphType)
	if rootNode, found := trafficMap[rootID]; found {
		return rootNode, found
	}
	// service name
	rootID, _, _ = graph.Id(ext.RootCluster, ext.RootNamespace, ext.RootName, "", "", "", "", a.GraphType)
	if rootNode, found := trafficMap[rootID]; found {
		return rootNode, found
	}

	return nil, false
}

func timeSeriesHash(cluster, serviceNs, service, workloadNs, workload, app, version string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s", cluster, serviceNs, service, workloadNs, workload, app, version))))
}
