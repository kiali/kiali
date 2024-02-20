package appender

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const ExtensionsAppenderName = "extensions"

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

type Extension struct {
	Name                  string // extension name: "skupper"
	Source_node_app       string // app name for request source node: "skupper-router"
	Source_node_cluster   string // cluster name for request source node: "Kubernetes"
	Source_node_namespace string //  namespace name for request souce node: "mongoskupperns"
}

// AppendGraph implements Appender
func (a ExtensionsAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	log.Info("In Extensions")
	if globalInfo.PromClient == nil {
		var err error
		globalInfo.PromClient, err = prometheus.NewClient()
		graph.CheckError(err)
	}

	// Run through configured extensions
	// extensions := config.Get().ExternalServices.Extensions // TBD, some config to define extensions
	extensions := []Extension{{
		Name:                  "skupper",
		Source_node_app:       "skupper-router",
		Source_node_cluster:   "Kubernetes",
		Source_node_namespace: "mongoskupperns",
	}}

	// Process the extensions defined in the config
	for _, extension := range extensions {
		switch extension.Name {
		case "skupper":
			log.Info("Found Skupper Extension")
			a.appendSkupperTraffic(trafficMap, extension, globalInfo.PromClient)

		default:
			log.Warningf("Extension appender encountered unknown extension [%s]", extension.Name)
		}
	}
}

func (a ExtensionsAppender) appendSkupperTraffic(trafficMap graph.TrafficMap, ext Extension, client *prometheus.Client) {
	// Look for the extenstion source node (aka the skupper-router for the defined site).  If found, use
	// it as the source node for request traffic to the defined address (i.e. requested service)
	sourceID, _, _ := graph.Id(ext.Source_node_cluster, "", "", ext.Source_node_namespace, ext.Source_node_app, ext.Source_node_app, "", a.GraphType)
	sourceNode, found := trafficMap[sourceID]
	if !found {
		// TODO: Debug
		log.Infof("Skupper Extension did not find source node in traffic map [%+v]", ext)
		return
	}
	log.Infof("Skupper Extension found source node [%+v]", sourceNode)

	// query skupper metrics looking for request traffic
	metric := "flows_total"
	groupBy := "address, destSite, protocol"
	idleCondition := "> 0"
	if a.IncludeIdleEdges {
		idleCondition = ""
	}

	// 0) Incoming: query source telemetry to capture unserviced namespace services' incoming traffic
	query := fmt.Sprintf(`sum(rate(%s{direction="incoming",sourceSite=~"^%s@.*$"} [%vs])) by (%s) %s`,
		metric,
		ext.Source_node_namespace,
		int(a.Duration.Seconds()), // range duration for the query
		groupBy,
		idleCondition)
	log.Infof("Skupper Extension query [%s]", query)
	vector := promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
	a.appendTrafficMap(trafficMap, sourceNode, ext, &vector)
}

func (a ExtensionsAppender) appendTrafficMap(trafficMap graph.TrafficMap, sourceNode *graph.Node, ext Extension, vector *model.Vector) {
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
}
