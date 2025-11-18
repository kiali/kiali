package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	config_common "github.com/kiali/kiali/graph/config/common"
	"github.com/kiali/kiali/graph/telemetry/istio"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// GraphOptionsMatch is a passthrough to the proper vendr-specific impl of TelemetryVendor interface.
// It returns true if there is any difference in the options that would result in a fundamental change
// to the resulting traffic map (and therefore would invalidate any cached graph)
func GraphOptionsMatch(a, b graph.Options) bool {
	if a.TelemetryVendor != b.TelemetryVendor {
		return false
	}

	switch a.TelemetryVendor {
	case graph.VendorIstio:
		return istio.GraphOptionsMatch(a.TelemetryOptions, b.TelemetryOptions)
	default:
		// skip
	}

	return true
}

// GraphNamespaces generates a namespaces graph using the provided options.
// Returns the HTTP status code, the vendor-specific graph config, and the TrafficMap (for caching).
func GraphNamespaces(ctx context.Context, business *business.Layer, prom prometheus.ClientInterface, o graph.Options) (code int, graphConfig interface{}, trafficMap graph.TrafficMap) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(
		ctx,
		"GraphNamespaces",
		observability.Attribute("package", "api"),
	)
	defer end()
	// time how long it takes to generate this graph
	promtimer := internalmetrics.GetGraphGenerationTimePrometheusTimer(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes)
	defer internalmetrics.ObserveDurationAndLogResults(
		ctx,
		config.Get(),
		promtimer,
		"GraphGenerationTime",
		map[string]string{
			"graph-kind":           o.GetGraphKind(),
			"graph-type":           o.TelemetryOptions.GraphType,
			"inject-service-nodes": strconv.FormatBool(o.InjectServiceNodes),
		},
		"Namespace graph generation time")

	switch o.TelemetryVendor {
	case graph.VendorIstio:
		code, graphConfig, trafficMap = graphNamespacesIstio(ctx, business, prom, o)
	default:
		graph.Error(fmt.Sprintf("TelemetryVendor [%s] not supported", o.TelemetryVendor))
	}

	// update metrics
	if _, ok := graphConfig.(config_common.Config); ok {
		numNodes := len(graphConfig.(config_common.Config).Elements.Nodes)
		internalmetrics.SetGraphNodes(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes, numNodes)
	}

	return code, graphConfig, trafficMap
}

// graphNamespacesIstio provides a test hook that accepts mock clients
func graphNamespacesIstio(ctx context.Context, business *business.Layer, prom prometheus.ClientInterface, o graph.Options) (code int, graphConfig interface{}, trafficMap graph.TrafficMap) {
	clusters := business.Mesh.Clusters()
	// Create a 'global' object to store the business. Global only to the request.
	globalInfo := graph.NewGlobalInfo(business, prom, config.Get(), clusters, appender.NewGlobalIstioInfo())

	trafficMap = istio.BuildNamespacesTrafficMap(ctx, o.TelemetryOptions, globalInfo)

	code, graphConfig = generateGraph(ctx, trafficMap, o)

	return code, graphConfig, trafficMap
}

// GraphNode generates a node graph using the provided options
func GraphNode(ctx context.Context, business *business.Layer, prom prometheus.ClientInterface, o graph.Options) (code int, graphConfig interface{}) {
	if len(o.Namespaces) != 1 {
		graph.Error("Node graph does not support the 'namespaces' query parameter or the 'all' namespace")
	}

	// time how long it takes to generate this graph
	promtimer := internalmetrics.GetGraphGenerationTimePrometheusTimer(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes)
	defer internalmetrics.ObserveDurationAndLogResults(
		ctx,
		config.Get(),
		promtimer,
		"GraphGenerationTime",
		map[string]string{
			"graph-kind":           o.GetGraphKind(),
			"graph-type":           o.TelemetryOptions.GraphType,
			"inject-service-nodes": strconv.FormatBool(o.InjectServiceNodes),
		},
		"Node graph generation time")

	switch o.TelemetryVendor {
	case graph.VendorIstio:
		code, graphConfig = graphNodeIstio(ctx, business, prom, o)
	default:
		graph.Error(fmt.Sprintf("TelemetryVendor [%s] not supported", o.TelemetryVendor))
	}

	// update metrics
	if _, ok := graphConfig.(config_common.Config); ok {
		numNodes := len(graphConfig.(config_common.Config).Elements.Nodes)
		internalmetrics.SetGraphNodes(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes, numNodes)
	}

	return code, graphConfig
}

// graphNodeIstio provides a test hook that accepts mock clients
func graphNodeIstio(ctx context.Context, business *business.Layer, prom prometheus.ClientInterface, o graph.Options) (code int, graphConfig interface{}) {
	// Create a 'global' object to store the business. Global only to the request.
	clusters := business.Mesh.Clusters()
	globalInfo := graph.NewGlobalInfo(business, prom, config.Get(), clusters, appender.NewGlobalIstioInfo())
	globalInfo.Business = business
	globalInfo.PromClient = prom

	trafficMap, _ := istio.BuildNodeTrafficMap(ctx, o.TelemetryOptions, globalInfo)
	code, graphConfig = generateGraph(ctx, trafficMap, o)

	return code, graphConfig
}

func generateGraph(ctx context.Context, trafficMap graph.TrafficMap, o graph.Options) (int, interface{}) {
	zl := log.FromContext(ctx)

	zl.Trace().Msgf("Generating config for [%s] graph...", o.ConfigVendor)

	promtimer := internalmetrics.GetGraphMarshalTimePrometheusTimer(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes)
	defer internalmetrics.ObserveDurationAndLogResults(
		ctx,
		config.Get(),
		promtimer,
		"GraphMarshalTime",
		map[string]string{
			"graph-kind":           o.GetGraphKind(),
			"graph-type":           o.TelemetryOptions.GraphType,
			"inject-service-nodes": strconv.FormatBool(o.InjectServiceNodes),
		},
		"Graph marshal time")

	var vendorConfig interface{}
	switch o.ConfigVendor {
	case graph.VendorCommon:
		vendorConfig = config_common.NewConfig(trafficMap, o.ConfigOptions)
	default:
		vendorConfig = config_common.NewConfig(trafficMap, o.ConfigOptions)
		zl.Debug().Msgf("ConfigVendor [%s] not supported, defaulting to [Common]", o.ConfigVendor)
	}

	zl.Trace().Msgf("Done generating config for [%s] graph", o.ConfigVendor)
	return http.StatusOK, vendorConfig
}

// GenerateGraph converts a TrafficMap to vendor-specific graph config (exported for caching)
func GenerateGraph(ctx context.Context, trafficMap graph.TrafficMap, o graph.Options) (int, interface{}) {
	return generateGraph(ctx, trafficMap, o)
}
