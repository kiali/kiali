package api

import (
	"fmt"
	"net/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/generator/cytoscape"
	"github.com/kiali/kiali/graph/telemetry/istio"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

func GraphNamespaces(business *business.Layer, client *prometheus.Client, o graph.Options) (int, interface{}) {
	// time how long it takes to generate this graph
	promtimer := internalmetrics.GetGraphGenerationTimePrometheusTimer(o.GetGraphKind(), o.GraphType, o.InjectServiceNodes)
	defer promtimer.ObserveDuration()

	// Create a 'global' object to store the business. Global only to the request.
	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = business

	// TODO: Mechanism for invoking different telemetry vendors
	trafficMap := istio.BuildNamespacesTrafficMap(o, client, globalInfo)
	code, json := generateGraph(trafficMap, o)

	// update metrics
	internalmetrics.SetGraphNodes(o.GetGraphKind(), o.GraphType, o.InjectServiceNodes, len(trafficMap))

	return code, json
}

// graphNode provides a testing hook that can supply a mock client
func GraphNode(business *business.Layer, client *prometheus.Client, o graph.Options) (int, interface{}) {
	if len(o.Namespaces) != 1 {
		graph.Error(fmt.Sprintf("Node graph does not support the 'namespaces' query parameter or the 'all' namespace"))
	}

	// time how long it takes to generate this graph
	promtimer := internalmetrics.GetGraphGenerationTimePrometheusTimer(o.GetGraphKind(), o.GraphType, o.InjectServiceNodes)
	defer promtimer.ObserveDuration()

	// Create a 'global' object to store the business. Global only to the request.
	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = business

	trafficMap := istio.BuildNodeTrafficMap(o, client, globalInfo)
	code, json := generateGraph(trafficMap, o)

	// update metrics
	internalmetrics.SetGraphNodes(o.GetGraphKind(), o.GraphType, o.InjectServiceNodes, len(trafficMap))

	return code, json
}

func generateGraph(trafficMap graph.TrafficMap, o graph.Options) (int, interface{}) {
	log.Tracef("Generating config for [%s] graph...", o.Vendor)

	promtimer := internalmetrics.GetGraphMarshalTimePrometheusTimer(o.GetGraphKind(), o.GraphType, o.InjectServiceNodes)
	defer promtimer.ObserveDuration()

	var vendorConfig interface{}
	switch o.Vendor {
	case "cytoscape":
		vendorConfig = cytoscape.NewConfig(trafficMap, o.VendorOptions)
	default:
		graph.Error(fmt.Sprintf("Vendor [%s] not supported", o.Vendor))
	}

	log.Tracef("Done generating config for [%s] graph", o.Vendor)
	return http.StatusOK, vendorConfig
}
