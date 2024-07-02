package appender

import (
	"crypto/md5"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"golang.org/x/exp/maps"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util/sliceutil"
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
	ShowUnrooted     bool
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
		log.Infof("Extension %s", extension) // todo: remove
		if !extension.Enabled {
			continue
		}
		log.Infof("Running Extension %s", extension) // todo: remove
		a.appendGraph(extension, trafficMap, globalInfo.PromClient)
	}
}

func (a ExtensionsAppender) appendGraph(ext config.ExtensionConfig, trafficMap graph.TrafficMap, client *prometheus.Client) {
	/*
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
	*/
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
		groupBy := "dest_cluster, dest_namespace, dest_name, flags, protocol, security, source_cluster, source_is_root, source_namespace, source_name, status_code"
		metric := "kiali_ext_requests_total"

		query := fmt.Sprintf(`sum(rate(%s{extension="%s"} [%vs])) by (%s) %s`,
			metric,
			ext.Name,
			int(a.Duration.Seconds()), // range duration for the query
			groupBy,
			idleCondition)
		log.Infof("Extension requests query [%s]", query)
		vector := promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
		a.appendTrafficMap(ext, trafficMap, &vector, metric)
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
			groupBy := "dest_cluster, dest_namespace, dest_name, flags, security, source_cluster, source_is_root, source_namespace, source_name"

			query := fmt.Sprintf(`sum(rate(%s{extension="%s"} [%vs])) by (%s) %s`,
				metric,
				ext.Name,
				int(a.Duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			log.Infof("Extension tcp query [%s]", query)
			vector := promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
			a.appendTrafficMap(ext, trafficMap, &vector, metric)
		}
	}
}

func (a ExtensionsAppender) appendTrafficMap(ext config.ExtensionConfig, trafficMap graph.TrafficMap, vector *model.Vector, metric string) {
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
		log.Infof("Processing TS %s", m.String()) // todo: remove
		lSourceCluster, sourceClusterOk := m["source_cluster"]
		lSourceIsRoot, sourceIsRootOk := m["source_is_root"]
		lSourceNs, sourceNsOk := m["source_namespace"]
		lSourceName, sourceNameOk := m["source_name"]
		lDestCluster, destClusterOk := m["dest_cluster"]
		lDestNs, destNsOk := m["dest_namespace"]
		lDestName, destNameOk := m["dest_name"]

		if !sourceClusterOk || !sourceIsRootOk || !sourceNsOk || !sourceNameOk || !destClusterOk || !destNsOk || !destNameOk {
			log.Warningf("Skipping %s, missing expected TS labels", m.String())
			continue
		}

		sourceCluster := string(lSourceCluster)
		sourceIsRoot := string(lSourceIsRoot)
		sourceNs := string(lSourceNs)
		sourceName := string(lSourceName)
		destCluster := string(lDestCluster)
		destNs := string(lDestNs)
		destName := string(lDestName)

		flags := ""
		if isRequests || protocol == graph.TCP.Name {
			lFlags, flagsOk := m["flags"]
			// "flags" is optional in the TS, if not supplied just leave it empty
			if flagsOk {
				flags = string(lFlags)
			}
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

		a.addTraffic(ext, trafficMap, metric, val, protocol, code, flags, sourceCluster, sourceIsRoot, sourceNs, sourceName, destCluster, destNs, destName)
	}
}

func (a ExtensionsAppender) addTraffic(ext config.ExtensionConfig, trafficMap graph.TrafficMap, metric string, val float64, protocol, code, flags, sourceCluster, sourceIsRoot, sourceNs, sourceName, destCluster, destNs, destName string) {
	source, _, err := a.addNode(ext, trafficMap, sourceIsRoot == "true", sourceCluster, sourceNs, sourceName, a.GraphType)
	if err != nil {
		log.Warningf("Skipping extension addTraffic (source) in extension, %s", err)
		return
	}
	dest, _, err := a.addNode(ext, trafficMap, false, destCluster, destNs, destName, a.GraphType)
	if err != nil {
		log.Warningf("Skipping extension addTraffic (dest), %s", err)
		return
	}

	// Extensions may generate duplicate metrics by reporting from both the source and destination. To avoid
	// processing the same information twice we keep track of the time series applied to a particular edge. The
	// edgeTSHash incorporates information about the time series' source, destination and metric information,
	// and uses that unique TS has to protect against applying the same intomation twice.
	edgeTSHash := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s", metric, source.Metadata[tsHash], dest.Metadata[tsHash], code, flags, destName))))

	a.addEdgeTraffic(val, protocol, code, flags, destName, source, dest, edgeTSHash)
}

func (a ExtensionsAppender) addNode(ext config.ExtensionConfig, trafficMap graph.TrafficMap, isRoot bool, cluster, namespace, name, graphType string) (*graph.Node, bool, error) {
	id, nodeType, err := graph.Id(cluster, namespace, name, "", "", "", "", graphType)
	if err != nil {
		return nil, false, err
	}
	log.Infof("addNode id=%s, nodeType=%s", id, nodeType) // todo: remove
	node, found := trafficMap[id]
	if !found {
		log.Infof("not found") // todo: remove
		if isRoot {
			log.Infof("is root") // todo: remove
			// The supplied source information did not exactly match a node in the graph, see if we can make a good "guess"
			node, found = a.findRootNode(trafficMap, cluster, namespace, name)
			if found {
				log.Infof("findRootNode found root!") // todo: remove
			} else {
				log.Infof("findRootNode found no root") // todo: remove
				if a.ShowUnrooted {
					log.Infof("add unrooted node") // todo: remove
				} else {
					return nil, false, fmt.Errorf("no root node found matching is_source_root=true, id=%s", id)
				}
			}
		}
		if !found {
			log.Infof("adding node...") // todo: remove
			namespace := namespace
			newNode := graph.NewNodeExplicit(id, cluster, namespace, "", "", "", name, nodeType, a.GraphType)
			node = newNode
			trafficMap[id] = node
		}
	}
	log.Infof("added node...") // todo: remove
	node.Metadata[graph.IsExtension] = ext.Name
	node.Metadata["tsHash"] = timeSeriesHash(cluster, namespace, name, "", "", "", "")
	return node, found, nil
}

// findRootNode tries to match a root node flagged in the metrics to an actual "leaf" node in the traffic graph.
// TODO: This needs work or maybe just needs to go away.  It should maybe somehow involve version.
func (a ExtensionsAppender) findRootNode(trafficMap graph.TrafficMap, cluster, namespace, name string) (*graph.Node, bool) {
	roots := sliceutil.Filter(maps.Values(trafficMap), func(n *graph.Node) bool {
		match := n.Cluster == cluster && n.Namespace == namespace && (n.Service == name || n.App == name || n.Workload == name)
		log.Infof("match1 n.Cluster == %s && n.Namespace == %s && (n.Service == %s || n.App == %s || n.Workload == %s) = %s", cluster, namespace, name, name, name, match) // todo: remove
		return n.Cluster == cluster && n.Namespace == namespace && (n.Service == name || n.App == name || n.Workload == name)
	})
	if len(roots) > 0 {
		return roots[0], true
	}

	roots = sliceutil.Filter(maps.Values(trafficMap), func(n *graph.Node) bool {
		match := n.Namespace == namespace && (n.Service == name || n.App == name || n.Workload == name)
		log.Infof("match2 n.Namespace == %s && (n.Service == %s || n.App == %s || n.Workload == %s) = %s", namespace, name, name, name, match) // todo: remove
		return n.Namespace == namespace && (n.Service == name || n.App == name || n.Workload == name)
	})
	if len(roots) > 0 {
		return roots[0], true
	}

	return nil, false
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

func timeSeriesHash(cluster, serviceNs, service, workloadNs, workload, app, version string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s", cluster, serviceNs, service, workloadNs, workload, app, version))))
}
