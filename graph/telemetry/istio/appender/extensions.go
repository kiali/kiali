package appender

import (
	"crypto/sha256"
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
	urlAnnotation          string            = "extension.kiali.io/ui-url"
	urlNotFound            string            = "_urlnotfound_"
)

// ExtensionsAppender looks for configured extensions and adds extension traffic to the graph, as needed.  This is
// a Finalizer appender, designed to be run after the full Istio graph is generated.
// Name: extensions
type ExtensionsAppender struct {
	Duration         time.Duration
	globalInfo       *graph.GlobalInfo
	GraphType        string
	IncludeIdleEdges bool
	QueryTime        int64 // unix time in seconds
	Rates            graph.RequestedRates
	ShowUnrooted     bool
	urls             map[string]string // map rootNode id to link url
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
func (a ExtensionsAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.GlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	cfg := config.Get()
	if len(cfg.Extensions) == 0 {
		return
	}

	if globalInfo.PromClient == nil {
		var err error
		globalInfo.PromClient, err = prometheus.NewClient()
		graph.CheckError(err)
	}

	a.globalInfo = globalInfo
	a.urls = map[string]string{}

	// Process the extensions defined in the config
	for _, extension := range cfg.Extensions {
		if !extension.Enabled {
			continue
		}
		a.appendGraph(extension, trafficMap)
	}
}

func (a ExtensionsAppender) appendGraph(ext config.ExtensionConfig, trafficMap graph.TrafficMap) {
	client := a.globalInfo.PromClient

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
		groupBy := "dest_cluster, dest_namespace, dest_name, flags, protocol, secure, source_cluster, source_is_root, source_namespace, source_name, status_code"
		metric := "kiali_ext_requests_total"

		query := fmt.Sprintf(`sum(rate(%s{extension="%s"} [%vs])) by (%s) %s`,
			metric,
			ext.Name,
			int(a.Duration.Seconds()), // range duration for the query
			groupBy,
			idleCondition)
		log.Tracef("Extension [%s] requests query [%s]", ext.Name, query)
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
			groupBy := "dest_cluster, dest_namespace, dest_name, flags, secure, source_cluster, source_is_root, source_namespace, source_name"

			query := fmt.Sprintf(`sum(rate(%s{extension="%s"} [%vs])) by (%s) %s`,
				metric,
				ext.Name,
				int(a.Duration.Seconds()), // range duration for the query
				groupBy,
				idleCondition)
			log.Tracef("Extension [%s] tcp query [%s]", ext.Name, query)
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

	skipRequestsGrpc := !isRequests || a.Rates.Grpc != graph.RateRequests
	skipRequestsHttp := !isRequests || a.Rates.Http != graph.RateRequests

	for _, s := range *vector {
		val := float64(s.Value)

		m := s.Metric
		lSourceCluster, sourceClusterOk := m["source_cluster"]
		lSourceIsRoot, sourceIsRootOk := m["source_is_root"]
		lSourceNs, sourceNsOk := m["source_namespace"]
		lSourceName, sourceNameOk := m["source_name"]
		lDestCluster, destClusterOk := m["dest_cluster"]
		lDestNs, destNsOk := m["dest_namespace"]
		lDestName, destNameOk := m["dest_name"]

		if !sourceClusterOk || !sourceIsRootOk || !sourceNsOk || !sourceNameOk || !destClusterOk || !destNsOk || !destNameOk {
			log.Warningf("Extension [%s] skipping %s, missing expected source TS labels", ext.Name, m.String())
			continue
		}

		sourceCluster := string(lSourceCluster)
		sourceIsRoot := string(lSourceIsRoot)
		sourceNs := string(lSourceNs)
		sourceName := string(lSourceName)
		destCluster := string(lDestCluster)
		destNs := string(lDestNs)
		destName := string(lDestName)

		// "flags" is optional in the TS, if not supplied just leave it empty
		flags := ""
		if isRequests || protocol == graph.TCP.Name {
			lFlags, flagsOk := m["flags"]
			if flagsOk {
				flags = string(lFlags)
			}
		}

		// "secure" is optional in the TS, if not supplied just assume false
		secure := "false"
		lSecure, secureOk := m["secure"]
		if secureOk {
			secure = string(lSecure)
		}

		var code string
		if isRequests {
			lProtocol, protocolOk := m["protocol"]
			lCode, codeOk := m["status_code"]

			if !protocolOk || !codeOk {
				log.Warningf("Extension [%s] skipping %s, missing expected request TS labels", ext.Name, m.String())
				continue
			}

			protocol = string(lProtocol)
			code = string(lCode)

			if skipRequestsGrpc && protocol == graph.GRPC.Name || skipRequestsHttp && protocol == graph.HTTP.Name {
				continue
			}
		}

		a.addTraffic(ext, trafficMap, metric, val, protocol, code, flags, secure, sourceCluster, sourceIsRoot, sourceNs, sourceName, destCluster, destNs, destName)
	}
}

func (a ExtensionsAppender) addTraffic(ext config.ExtensionConfig, trafficMap graph.TrafficMap, metric string, val float64, protocol, code, flags, secure, sourceCluster, sourceIsRoot, sourceNs, sourceName, destCluster, destNs, destName string) {
	isRoot := sourceIsRoot == "true"
	source, _, err := a.addNode(ext, trafficMap, isRoot, sourceCluster, sourceNs, sourceName, a.GraphType)
	if err != nil {
		log.Warningf("Extension [%s] skipping extension addTraffic (source) in extension, %s", ext.Name, err)
		return
	}
	dest, _, err := a.addNode(ext, trafficMap, false, destCluster, destNs, destName, a.GraphType)
	if err != nil {
		log.Warningf("Extension [%s] skipping extension addTraffic (dest), %s", ext.Name, err)
		return
	}

	if isRoot {
		url := a.getUrl(ext, source)
		if url != urlNotFound {
			source.Metadata[graph.IsExtension] = &graph.ExtInfo{
				URL:  url,
				Name: ext.Name,
			}
			dest.Metadata[graph.IsExtension] = &graph.ExtInfo{
				URL:  url,
				Name: ext.Name,
			}
		}
	}

	// Extensions may generate duplicate metrics by reporting from both the source and destination. To avoid
	// processing the same information twice we keep track of the time series applied to a particular edge. The
	// edgeTSHash incorporates information about the time series' source, destination and metric information,
	// and uses that unique TS has to protect against applying the same information twice.
	edgeTSHash := fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s", metric, source.Metadata[tsHash], dest.Metadata[tsHash], code, flags, destName))))

	a.addEdgeTraffic(val, protocol, code, flags, secure, destName, source, dest, edgeTSHash)
}

func (a ExtensionsAppender) addNode(ext config.ExtensionConfig, trafficMap graph.TrafficMap, isRoot bool, cluster, namespace, name, graphType string) (*graph.Node, bool, error) {
	id, nodeType, err := graph.Id(cluster, namespace, name, "", "", "", "", graphType)
	if err != nil {
		return nil, false, err
	}
	node, found := trafficMap[id]
	if !found {
		if isRoot {
			// The supplied source information did not exactly match a node in the graph, see if we can make a good "guess"
			node, found = a.findRootNode(trafficMap, cluster, namespace, name)
			if !found && !a.ShowUnrooted {
				return nil, false, fmt.Errorf("extension [%s] no root node found matching source_is_root=true, id=%s", ext.Name, id)
			}
		}
		if !found {
			namespace := namespace
			newNode := graph.NewNodeExplicit(id, cluster, namespace, "", "", "", name, nodeType, a.GraphType)
			node = newNode
			trafficMap[id] = node
		}
	}
	node.Metadata[graph.IsExtension] = &graph.ExtInfo{
		Name: ext.Name,
	}
	node.Metadata["tsHash"] = timeSeriesHash(cluster, namespace, name, "", "", "", "")
	return node, found, nil
}

// findRootNode tries to match a root node flagged in the metrics to an actual "leaf" node in the traffic graph.
// TODO: This needs work or maybe just needs to go away.  It should maybe somehow involve version.
func (a ExtensionsAppender) findRootNode(trafficMap graph.TrafficMap, cluster, namespace, name string) (*graph.Node, bool) {
	roots := sliceutil.Filter(maps.Values(trafficMap), func(n *graph.Node) bool {
		return n.Cluster == cluster && n.Namespace == namespace && (n.Service == name || n.App == name || n.Workload == name)
	})
	if len(roots) > 0 {
		return roots[0], true
	}

	roots = sliceutil.Filter(maps.Values(trafficMap), func(n *graph.Node) bool {
		return n.Namespace == namespace && (n.Service == name || n.App == name || n.Workload == name)
	})
	if len(roots) > 0 {
		return roots[0], true
	}

	return nil, false
}

func (a ExtensionsAppender) getUrl(ext config.ExtensionConfig, source *graph.Node) string {
	name := source.Service
	if name == "" {
		name = source.App
	}

	// first, try and autodiscover an existing route on the root service, or if that fails a service named the same as the extension itself
	for _, svcName := range []string{name, ext.Name} {
		routeUrl := a.globalInfo.Business.Svc.GetServiceRouteURL(a.globalInfo.Context, source.Cluster, source.Namespace, svcName)
		if routeUrl != "" {
			return routeUrl
		}
		log.Debugf("Extension [%s] no route found for extension service [%s][%s][%s]", ext.Name, source.Cluster, source.Namespace, svcName)
	}

	// otherwise, look for the annotation on the source service, or if that fails, a service named after the extension
	for _, svcName := range []string{name, ext.Name} {
		svc, err := a.globalInfo.Business.Svc.GetService(a.globalInfo.Context, source.Cluster, source.Namespace, svcName)
		if err != nil {
			log.Debugf("Extension [%s] no extension root node service found [%s][%s][%s]", ext.Name, source.Cluster, source.Namespace, svcName)
			continue
		}
		if url, found := svc.Annotations[urlAnnotation]; found {
			return url
		}
		log.Debugf("Extension [%s] no url annotation found for extension root node service [%s][%s][%s]", ext.Name, source.Cluster, source.Namespace, svcName)
	}

	return urlNotFound
}

// addEdgeTraffic uses edgeTSHash that the metric information has not been applied to the edge. Returns true
// if the the metric information is applied, false if it determined to be a duplicate.
func (a ExtensionsAppender) addEdgeTraffic(val float64, protocol, code, flags, secure, host string, source, dest *graph.Node, edgeTSHash string) bool {
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
		if secure == "true" {
			edge.Metadata[graph.IsMTLS] = 100.0 // for extensions, just assume 0 or 100% secure
		}

	}

	if _, ok := edge.Metadata[tsHashMap].(map[string]bool)[edgeTSHash]; !ok {
		edge.Metadata[tsHashMap].(map[string]bool)[edgeTSHash] = true
		graph.AddToMetadata(protocol, val, code, flags, host, source.Metadata, dest.Metadata, edge.Metadata)
		return true
	}

	return false
}

func timeSeriesHash(cluster, serviceNs, service, workloadNs, workload, app, version string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s", cluster, serviceNs, service, workloadNs, workload, app, version))))
}
