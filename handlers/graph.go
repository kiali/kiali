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
	"time"

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
		code, graphConfig, _ := api.GraphNamespaces(ctx, business, prom, o)
		return code, graphConfig
	}

	sessionID := o.SessionID
	if sessionID == "" {
		log.Tracef("No session ID found in options (unexpected), using non-cached graph generation")
		code, graphConfig, _ := api.GraphNamespaces(ctx, business, prom, o)
		return code, graphConfig
	}

	// Check if client provided queryTime (historical query - bypass cache)
	if o.QueryTimeProvided {
		log.Tracef("Client requested historical graph for session [%s] (queryTime provided), bypassing cache", sessionID)
		// Generate fresh graph without caching (leave existing cache/job intact)
		code, graphConfig, _ := api.GraphNamespaces(ctx, business, prom, o)
		return code, graphConfig
	}

	// Check if client requested cache bypass (refreshInterval <= 0)
	if o.RefreshInterval <= 0 {
		log.Infof("Client requested graph cache bypass for session [%s] (refreshInterval <= 0), clearing cache and stopping refresh job", sessionID)
		// Stop any existing refresh job
		refreshJobManager.StopJob(sessionID)
		// Clear cached graph for this session
		graphCache.Evict(sessionID)
		// Generate fresh graph without caching
		code, graphConfig, _ := api.GraphNamespaces(ctx, business, prom, o)
		return code, graphConfig
	}

	// Check cache for existing graph
	if cached, found := graphCache.GetSessionGraph(sessionID); found {
		// Verify that the cached graph matches the requested options
		if graphOptionsMatch(cached.Options, o) {
			log.Infof("Hit graph cache for session [%s] (options match)", sessionID)
			graph.IncrementCacheHit()

			// Check if refresh interval changed - update the job if needed
			requestedInterval := o.RefreshInterval
			if requestedInterval != cached.RefreshInterval {
				log.Infof("Changed graph cache refresh interval for session [%s] (from %v to %v), updating job",
					sessionID, cached.RefreshInterval, requestedInterval)
				if job := refreshJobManager.GetJob(sessionID); job != nil {
					job.UpdateInterval(requestedInterval)
					cached.RefreshInterval = requestedInterval
					if err := graphCache.SetSessionGraph(sessionID, cached); err != nil {
						log.Errorf("Failed to update graph cache refresh interval in cache for session [%s]: %v", sessionID, err)
					}
				}
			}

			// Always return cached graph immediately for fast response
			// Background refresh ensures data is never older than interval/2
			code, graphConfig := generateGraphFromTrafficMap(ctx, cached.TrafficMap, o)
			return code, graphConfig
		}

		// Options changed - invalidate cache and refresh job
		log.Infof("Invalidated graph cache for session [%s] (options changed)", sessionID)
		graphCache.Evict(sessionID)
		refreshJobManager.StopJob(sessionID)
	}

	// Cache miss (or invalidated) - generate new graph
	log.Infof("Missed graph cache for session [%s], generating new graph", sessionID)
	graph.IncrementCacheMiss()

	// Generate graph (returns both vendor config and TrafficMap)
	code, graphConfig, trafficMap := api.GraphNamespaces(ctx, business, prom, o)

	if code != http.StatusOK {
		return code, graphConfig
	}

	// Cache the TrafficMap
	refreshInterval := graphCache.Config().RefreshInterval
	cached := &graph.CachedGraph{
		LastAccessed:    time.Now(),
		Options:         o,
		RefreshInterval: o.RefreshInterval,
		Timestamp:       time.Now(),
		TrafficMap:      trafficMap,
	}

	if err := graphCache.SetSessionGraph(sessionID, cached); err != nil {
		log.Errorf("Failed to add to graph cache for session [%s]: %v", sessionID, err)
		// Continue anyway - we can still return the graph
	}

	// Set up graph generator for background refresh (one time setup)
	generator := createGraphGenerator(business, prom)
	if graphCache.GetGraphGenerator() == nil {
		graphCache.SetGraphGenerator(generator)
	}

	// Start background refresh job for this session
	// Note: RefreshJob needs the concrete cache implementation for internal methods
	// This is safe because NewGraphCache always returns *GraphCacheImpl
	cacheImpl := graphCache.(*graph.GraphCacheImpl)
	refreshJobManager.StartJob(sessionID, o, cacheImpl, generator, refreshInterval)

	return code, graphConfig
}

// graphOptionsMatch determines if two graph options are equivalent for caching purposes.
// It compares the key fields that affect graph generation, ignoring QueryTime differences
// within the refresh interval (since background refresh handles time progression).
func graphOptionsMatch(cached, requested graph.Options) bool {
	// Compare namespaces (critical - different namespaces = different graph)
	if len(cached.Namespaces) != len(requested.Namespaces) {
		return false
	}
	for ns := range requested.Namespaces {
		if _, exists := cached.Namespaces[ns]; !exists {
			return false
		}
	}

	// Compare duration (different time range = different graph)
	if cached.TelemetryOptions.Duration != requested.TelemetryOptions.Duration {
		return false
	}

	// Compare graph type (app vs workload vs service)
	if cached.TelemetryOptions.GraphType != requested.TelemetryOptions.GraphType {
		return false
	}

	// Compare inject service nodes flag
	if cached.InjectServiceNodes != requested.InjectServiceNodes {
		return false
	}

	// Compare include idle edges flag
	if cached.IncludeIdleEdges != requested.IncludeIdleEdges {
		return false
	}

	// Compare appenders (different appenders = different graph decoration)
	if len(cached.Appenders.AppenderNames) != len(requested.Appenders.AppenderNames) {
		return false
	}
	for i, name := range cached.Appenders.AppenderNames {
		if name != requested.Appenders.AppenderNames[i] {
			return false
		}
	}

	// Compare rates (different rate calculations = different graph metrics)
	if cached.Rates.Ambient != requested.Rates.Ambient {
		return false
	}
	if cached.Rates.Grpc != requested.Rates.Grpc {
		return false
	}
	if cached.Rates.Http != requested.Rates.Http {
		return false
	}
	if cached.Rates.Tcp != requested.Rates.Tcp {
		return false
	}

	// Note: We intentionally do NOT compare QueryTime here
	// The background refresh job handles moving the time window forward
	// Users expect cached graphs to update over time automatically

	return true
}

// createGraphGenerator creates a GraphGenerator function for background refresh
func createGraphGenerator(business *business.Layer, prom prometheus.ClientInterface) graph.GraphGenerator {
	return func(ctx context.Context, options graph.Options) (graph.TrafficMap, error) {
		// Call GraphNamespaces and extract just the TrafficMap
		_, _, trafficMap := api.GraphNamespaces(ctx, business, prom, options)
		return trafficMap, nil
	}
}

// generateGraphFromTrafficMap converts a cached TrafficMap to vendor config
// This is used when serving from cache
func generateGraphFromTrafficMap(ctx context.Context, trafficMap graph.TrafficMap, o graph.Options) (int, interface{}) {
	// Convert the TrafficMap to vendor-specific config format
	return api.GenerateGraph(ctx, trafficMap, o)
}
