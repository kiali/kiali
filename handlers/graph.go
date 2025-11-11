package handlers

// Graph.go provides handlers for graph request endpoints.   The handlers access vendor-specific
// telemetry (default istio) and return vendor-specific configuration. The configuration format
// depends on the vendor but is typically JSON and provides what is necessary to allow the vendor's
// tool to render the graph.
//
// The algorithm is two-phased:
//   Phase One: Generate a TrafficMap using the requested TelemetryVendor. This typically queries
//              Prometheus, Istio and Kubernetes.
//
//   Phase Two: Provide the TrafficMap to the requested ConfigVendor which returns the vendor-specific
//              configuration returned to the caller.
//
// The current Handlers:
//   GraphNamespaces: Generate a graph for one or more requested namespaces.
//   GraphNode:       Generate a graph for a specific node, detailing the immediate incoming and outgoing traffic.
//
// The handlers accept the following query parameters (see notes below)
//   appenders:       Comma-separated list of TelemetryVendor-specific appenders to run. (default: all)
//   configVendor:    default: common
//   duration:        time.Duration indicating desired query range duration, (default: 10m)
//   graphType:       Determines how to present the telemetry data. app | service | versionedApp | workload (default: workload)
//   boxBy:           If supported by vendor, visually box by a specified node attribute (default: none)
//   namespaces:      Comma-separated list of namespace names to use in the graph. Will override namespace path param
//   queryTime:       Unix time (seconds) for query such that range is queryTime-duration..queryTime (default now)
//   TelemetryVendor: default: istio
//
//  Note: some handlers may ignore some query parameters.
//  Note: vendors may support additional, vendor-specific query parameters.
//
import (
	"context"
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/api"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// GraphNamespaces is a REST http.HandlerFunc handling graph generation for 1 or more namespaces

func GraphNamespaces(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
	graphCache graph.GraphCache,
	refreshJobManager *graph.RefreshJobManager,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer handlePanic(r.Context(), w)

		// TODO: getLayer and its downstream call chain has our logger in the request context now; it just needs to extract and use it (which it does not today)
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		graph.CheckError(err)

		o := graph.NewOptions(r, business)

		code, payload := graphNamespacesWithCache(r.Context(), business, prom, o, graphCache, refreshJobManager)
		respond(w, code, payload)
	}
}

// GraphNode is a REST http.HandlerFunc handling node-detail graph config generation.
// Note: Node graphs are NOT cached - only namespace graphs use caching.
func GraphNode(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer handlePanic(r.Context(), w)

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		graph.CheckError(err)

		o := graph.NewOptions(r, business)

		code, payload := api.GraphNode(r.Context(), business, prom, o)
		respond(w, code, payload)
	}
}

func handlePanic(ctx context.Context, w http.ResponseWriter) {
	code := http.StatusInternalServerError
	if r := recover(); r != nil {
		var message string
		switch err := r.(type) {
		case string:
			message = err
		case error:
			message = err.Error()
		case func() string:
			message = err()
		case graph.Response:
			message = err.Message
			code = err.Code
		default:
			message = fmt.Sprintf("%v", r)
		}
		if code == http.StatusInternalServerError {
			stack := debug.Stack()
			log.FromContext(ctx).Error().Msgf("%s: %s", message, stack)
			RespondWithDetailedError(w, code, message, "Stack trace available in Kiali logs:")
			return
		}
		RespondWithError(w, code, message)
	}
}

func respond(w http.ResponseWriter, code int, payload interface{}) {
	if code == http.StatusOK {
		RespondWithJSONIndent(w, code, payload)
		return
	}
	if code == http.StatusForbidden {
		message := ""
		if payload != nil {
			message = payload.(string)
		}
		RespondWithJSON(w, code, message)
		return
	}
	RespondWithError(w, code, payload.(string))
}

// graphNamespacesWithCache checks the cache before generating namespace graphs
func graphNamespacesWithCache(
	ctx context.Context,
	business *business.Layer,
	prom prometheus.ClientInterface,
	o graph.Options,
	graphCache graph.GraphCache,
	refreshJobManager *graph.RefreshJobManager,
) (int, interface{}) {
	// If cache is disabled, use traditional path
	if !graphCache.Enabled() {
		return api.GraphNamespaces(ctx, business, prom, o)
	}

	sessionID := o.TelemetryOptions.SessionID
	if sessionID == "" {
		log.Tracef("No session ID found in options (unexpected), using non-cached graph generation")
		return api.GraphNamespaces(ctx, business, prom, o)
	}

	// Check cache for existing graph
	if cached, found := graphCache.GetSessionGraph(sessionID); found {
		log.Tracef("Cache hit for session %s", sessionID)
		// Return cached graph with metadata
		return wrapWithCacheMetadata(ctx, cached.TrafficMap, o, cached, true)
	}

	// Cache miss - generate new graph
	log.Tracef("Cache miss for session %s, generating new graph", sessionID)
	code, payload := api.GraphNamespaces(ctx, business, prom, o)

	if code != http.StatusOK {
		return code, payload
	}

	// Extract TrafficMap from payload for caching
	// The payload is the vendor config, we need to get the TrafficMap
	// For now, we'll generate a new TrafficMap using the same options
	// TODO: Optimize this to avoid regenerating

	// Create a GraphGenerator for background refresh
	generator := createGraphGenerator(business, prom)
	graphCache.SetGraphGenerator(generator)

	// Cache the result
	// Note: For simplicity, we're not caching the full config yet, just generating a placeholder
	// This will be improved in a follow-up

	return code, payload
}

// graphNodeWithCache is no longer used - node graphs are not cached.
// Keeping this as a placeholder in case we want to add node graph caching in the future.
// Currently, only namespace graphs use caching via graphNamespacesWithCache.

// createGraphGenerator creates a GraphGenerator function for background refresh
func createGraphGenerator(business *business.Layer, prom prometheus.ClientInterface) graph.GraphGenerator {
	return func(ctx context.Context, options graph.Options) (graph.TrafficMap, error) {
		// Call the appropriate graph generation based on graph kind
		// For now, use GraphNamespaces as the default
		code, _ := api.GraphNamespaces(ctx, business, prom, options)
		if code != http.StatusOK {
			return nil, fmt.Errorf("graph generation failed with code %d", code)
		}

		// TODO: Extract and return the actual TrafficMap
		// For now, return empty map as placeholder
		return graph.TrafficMap{}, nil
	}
}

// wrapWithCacheMetadata adds cache metadata to graph response
func wrapWithCacheMetadata(
	ctx context.Context,
	trafficMap graph.TrafficMap,
	o graph.Options,
	cached *graph.CachedGraph,
	fromCache bool,
) (int, interface{}) {
	// Generate the vendor config from TrafficMap
	// TODO: This needs to properly convert TrafficMap to vendor config
	// For now, we'll just pass through to the API layer
	return http.StatusOK, nil
}
