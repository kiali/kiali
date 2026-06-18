package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/ai"
	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/prompts"
	aiTypes "github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/tracing"
)

func GetKialiInterface(
	r *http.Request,
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	cpm business.ControlPlaneMonitor,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	perses *perses.Service,
	discovery *istio.Discovery,
) (*mcputil.KialiInterface, error) {
	businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
	if err != nil {
		return nil, err
	}
	return &mcputil.KialiInterface{
		Request:       r,
		BusinessLayer: businessLayer,
		Prom:          prom,
		ClientFactory: clientFactory,
		KialiCache:    kialiCache,
		Conf:          conf,
		Graphana:      grafana,
		Perses:        perses,
		Discovery:     discovery,
	}, nil
}

func ChatMCP(
	conf *config.Config,
	kialiCache cache.KialiCache,
	aiStore aiTypes.AIStore,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	perses *perses.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)
		toolName := params["tool_name"]
		if err := mcp.LoadTools(); err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}
		var args map[string]interface{}
		if r.Body != nil && r.ContentLength != 0 {
			if err := json.NewDecoder(r.Body).Decode(&args); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}
		}
		if args == nil {
			args = map[string]interface{}{}
		}
		handlers := mcp.MCPToolHandlers
		if _, ok := args["mcp_mode"]; !ok {
			args["mcp_mode"] = "true"
		}
		if r.Header.Get(mcp.HeaderKialiUI) != "" {
			args["mcp_mode"] = "false"
			handlers = mcp.DefaultToolHandlers
		}
		tool, ok := handlers[toolName]
		if !ok {
			RespondWithError(w, http.StatusNotFound, fmt.Sprintf("Tool '%s' not found", toolName))
			return
		}
		if !conf.ExternalServices.Tracing.Enabled && mcp.IsTraceTool(toolName) {
			RespondWithError(w, http.StatusNotFound, fmt.Sprintf("Tool '%s' is not available when tracing is disabled", toolName))
			return
		}
		// 404 mirrors the tracing gate convention above
		if !conf.ExternalServices.Prometheus.Enabled && mcp.IsMetricTool(toolName) {
			RespondWithError(w, http.StatusNotFound, "metrics are unavailable because Prometheus is disabled")
			return
		}
		// Gate Ambient-specific tools before building the full interface, matching the tracing/metrics pattern above.
		if mcp.IsAmbientTool(toolName) {
			if !kialiCache.IsAmbientEnabledInAnyCluster(accessibleClusterNames(clientFactory)) {
				RespondWithError(w, http.StatusNotFound,
					fmt.Sprintf("Tool '%s' is not available when Ambient Mesh is not enabled in any cluster", toolName))
				return
			}
		}
		kialiInterface, err := GetKialiInterface(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, perses, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}
		mcpResult, code := tool.Call(kialiInterface, args)
		if code != http.StatusOK {
			RespondWithError(w, code, fmt.Sprintf("Tool %s returned error: %v", toolName, mcpResult))
			return
		}
		RespondWithJSON(w, code, mcpResult)
	}
}

// accessibleClusterNames returns cluster names reachable via the client factory's service-account clients.
func accessibleClusterNames(clientFactory kubernetes.ClientFactory) []string {
	saClients := clientFactory.GetSAClients()
	names := make([]string, 0, len(saClients))
	for clusterName := range saClients {
		names = append(names, clusterName)
	}
	return names
}

func ChatPrompts(conf *config.Config, kialiCache cache.KialiCache, clientFactory kubernetes.ClientFactory) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.ChatAI.Enabled {
			RespondWithError(w, http.StatusServiceUnavailable, "ChatAI is not enabled")
			return
		}

		ambientEnabled := kialiCache.IsAmbientEnabledInAnyCluster(accessibleClusterNames(clientFactory))

		category := r.URL.Query().Get("category")
		catalog := prompts.Catalog()
		filtered := make([]prompts.Prompt, 0, len(catalog))
		for _, p := range catalog {
			if p.IsAmbient && !ambientEnabled {
				continue
			}
			if category != "" && p.Category != category {
				continue
			}
			filtered = append(filtered, p)
		}
		RespondWithJSON(w, http.StatusOK, filtered)
	}
}

func ChatAI(
	conf *config.Config,
	kialiCache cache.KialiCache,
	aiStore aiTypes.AIStore,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	perses *perses.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)
		providerName := params["provider"]
		modelName := params["model"]

		if !conf.ChatAI.Enabled {
			RespondWithError(w, http.StatusInternalServerError, "ChatAI is not enabled")
			return
		}
		var req aiTypes.AIRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			RespondWithError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
		fallbackUserID := ""
		if conf.Auth.Strategy != config.AuthStrategyAnonymous {
			authInfo, err := getAuthInfo(r)
			if err != nil {
				RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
				return
			}
			clusterAuth, ok := authInfo[conf.KubernetesConfig.ClusterName]
			if !ok || clusterAuth == nil {
				RespondWithError(w, http.StatusInternalServerError, fmt.Sprintf("AI initialization error: auth info not found for cluster %q", conf.KubernetesConfig.ClusterName))
				return
			}
			fallbackUserID = clusterAuth.Username
		} else {
			fallbackUserID = "anonymous"
		}
		userID := resolveChatAIUsageUserID(r, conf, fallbackUserID)

		provider, err := ai.NewAIProvider(conf, providerName, modelName)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}
		usageProviderName := providerName
		usageModelName := modelName
		if usageMetadata, err := ai.ResolveUsageMetadata(conf, providerName, modelName); err == nil && usageMetadata != nil {
			if usageMetadata.Provider != "" {
				usageProviderName = usageMetadata.Provider
			}
			if usageMetadata.Model != "" {
				usageModelName = usageMetadata.Model
			}
		}

		requestTimer := internalmetrics.GetAIRequestDurationPrometheusTimer(providerName, modelName)
		defer requestTimer.ObserveDuration()
		kialiInterface, err := GetKialiInterface(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, perses, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}
		internalmetrics.GetAIRequestsTotalMetric(providerName, modelName).Inc()
		// Add headers to prevent any buffering along the way
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache, no-transform")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		// Disable gzip for this specific endpoint to ensure real-time streaming
		w.Header().Set("Content-Encoding", "identity")
		flusher, ok := w.(http.Flusher)
		if !ok {
			RespondWithError(w, http.StatusInternalServerError, "Streaming unsupported")
			return
		}

		// Explicitly send the headers right now so proxies stop buffering
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		// Also try to flush using ResponseController if available
		rc := http.NewResponseController(w)
		_ = rc.Flush()

		if unwrapper, ok := w.(interface{ Unwrap() http.ResponseWriter }); ok {
			if f, ok := unwrapper.Unwrap().(http.Flusher); ok {
				f.Flush()
			}
		}

		onChunk := func(chunk string) {
			fmt.Fprintf(w, "data: %s\n\n", chunk)
			flusher.Flush()

			// Try to flush ResponseController if available
			rc := http.NewResponseController(w)
			_ = rc.Flush()

			// Try to unwrap and flush if it's a wrapped writer
			if unwrapper, ok := w.(interface{ Unwrap() http.ResponseWriter }); ok {
				if f, ok := unwrapper.Unwrap().(http.Flusher); ok {
					f.Flush()
				}
			}
		}
		usage := provider.SendChat(onChunk, r, req, kialiInterface, aiStore)
		recordChatAIUsage(conf, aiStore, userID, usageProviderName, usageModelName, usage)
	}
}

func resolveChatAIUsageUserID(r *http.Request, conf *config.Config, fallbackUserID string) string {
	sessionID := authentication.GetSessionIDContext(r.Context())
	if sessionID != "" {
		return sessionID
	}
	if fallbackUserID != "" {
		return fallbackUserID
	}
	if conf != nil && conf.Auth.Strategy == config.AuthStrategyAnonymous {
		return "anonymous"
	}

	authInfo, err := getAuthInfo(r)
	if err != nil {
		return ""
	}
	clusterAuth, ok := authInfo[conf.KubernetesConfig.ClusterName]
	if !ok || clusterAuth == nil {
		return ""
	}
	return clusterAuth.Username
}

func recordChatAIUsage(conf *config.Config, aiStore aiTypes.AIStore, userID string, provider string, model string, usage aiTypes.TokenUsage) {
	metricsEnabled := conf.ChatAI.Metrics.Enabled
	usernameIncluded := conf.ChatAI.Metrics.IncludeUsername
	if !usage.HasTokens() {
		return
	}
	if userID == "" {
		userID = "unknown"
	}
	if aiStore != nil && aiStore.Enabled() {
		if err := aiStore.RecordUsage(userID, provider, model, usage); err != nil {
			log.Errorf("[Chat AI] Failed to record usage for user [%s], provider [%s], model [%s]: %v", userID, provider, model, err)
		}
	}
	if metricsEnabled {
		if !usernameIncluded {
			userID = ""
		}
		internalmetrics.RecordAITokens(userID, provider, model, usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens)
	}
}

func ChatSessionUsage(
	conf *config.Config,
	aiStore aiTypes.AIStore,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.ChatAI.Enabled {
			RespondWithError(w, http.StatusInternalServerError, "ChatAI is not enabled")
			return
		}

		userID := resolveChatAIUsageUserID(r, conf, "")
		if userID == "" {
			RespondWithError(w, http.StatusBadRequest, "Unable to determine session usage scope")
			return
		}

		RespondWithJSON(w, http.StatusOK, aiStore.GetUsageMetrics(userID))
	}
}

// ---- ChatUsage response types -----------------------------------------------

type aiUsageResponse struct {
	Summary    aiUsageSummary    `json:"summary"`
	TimeSeries aiUsageTimeSeries `json:"timeSeries"`
}

type aiUsageSummary struct {
	ByModel    []aiTokenRow `json:"byModel"`
	ByProvider []aiTokenRow `json:"byProvider"`
}

// aiTokenRow is one row in an aggregated token table.
// Fields that do not apply to a given aggregation level are omitted from JSON.
type aiTokenRow struct {
	CompletionTokens int64  `json:"completionTokens"`
	Model            string `json:"model,omitempty"`
	PromptTokens     int64  `json:"promptTokens"`
	Provider         string `json:"provider,omitempty"`
	// TimeSeries is only populated for byProvider rows (including the synthetic
	// "total" row). It holds bucketed points suitable for rendering a sparkline.
	TimeSeries  []aiTimeSeriesPoint `json:"timeSeries,omitempty"`
	TotalTokens int64               `json:"totalTokens"`
}

type aiUsageTimeSeries struct {
	Series []aiTimeSeriesEntry `json:"series"`
	Step   string              `json:"step"`
	Window string              `json:"window"`
}

type aiTimeSeriesEntry struct {
	Model    string              `json:"model"`
	Points   []aiTimeSeriesPoint `json:"points"`
	Provider string              `json:"provider"`
}

type aiTimeSeriesPoint struct {
	CompletionTokens int64     `json:"completionTokens"`
	PromptTokens     int64     `json:"promptTokens"`
	Timestamp        time.Time `json:"timestamp"`
	TotalTokens      int64     `json:"totalTokens"`
}

// ---- ChatUsage handler ------------------------------------------------------

// ChatUsage returns AI token consumption statistics derived from the Prometheus
// in-memory counters.  It provides:
//
//   - summary.byProvider  – total tokens aggregated per provider
//   - summary.byModel     – total tokens aggregated per (provider, model)
//   - summary.byUser      – total tokens aggregated per username
//   - timeSeries          – per-(provider, model) token counts bucketed in time
//
// Query parameters:
//
//	window  look-back window in seconds (default 86400 = 24 h; e.g. 3600=1h, 21600=6h, 604800=7d)
//	step    time-series bucket width in seconds (default 3600 = 1 h; e.g. 300=5m, 900=15m)
func ChatUsage(conf *config.Config, _ aiTypes.AIStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.ChatAI.Enabled {
			RespondWithError(w, http.StatusServiceUnavailable, "ChatAI is not enabled")
			return
		}
		if !conf.ChatAI.Metrics.Enabled {
			RespondWithError(w, http.StatusServiceUnavailable, "ChatAI metrics are not enabled")
			return
		}

		windowStr := r.URL.Query().Get("window")
		if windowStr == "" {
			windowStr = "86400" // 24 h
		}
		stepStr := r.URL.Query().Get("step")
		if stepStr == "" {
			stepStr = "3600" // 1 h
		}

		window, err := parseUsageDuration(windowStr)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "invalid window: "+err.Error())
			return
		}
		step, err := parseUsageDuration(stepStr)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "invalid step: "+err.Error())
			return
		}
		if step <= 0 || step > window {
			RespondWithError(w, http.StatusBadRequest, "step must be positive and not greater than window")
			return
		}

		// Block until the Prometheus seeding goroutine has finished so the first
		// response always contains the full historical dataset. The wait is
		// bounded to avoid holding the connection open indefinitely when
		// Prometheus is slow or unreachable.
		internalmetrics.WaitForAITokensSeedingComplete(r.Context(), 30*time.Second)

		// Load events once for the requested window.
		// Both the summary aggregations and the time series are derived from the
		// same slice so that summary totals always match the sum of time series
		// points for the same window.
		now := time.Now()
		since := now.Add(-window)
		events := internalmetrics.GetAITokenEvents(since)

		// --- summary aggregations (window-scoped) ---------------------------------
		byProviderMap := map[string]*aiTokenRow{}
		byModelMap := map[string]*aiTokenRow{}

		for _, ev := range events {
			addToRow(byProviderMap, ev.Provider, func(row *aiTokenRow) {
				row.Provider = ev.Provider
			}, ev.PromptTokens, ev.CompletionTokens, ev.TotalTokens)

			modelKey := ev.Provider + "\x00" + ev.Model
			addToRow(byModelMap, modelKey, func(row *aiTokenRow) {
				row.Model = ev.Model
				row.Provider = ev.Provider
			}, ev.PromptTokens, ev.CompletionTokens, ev.TotalTokens)
		}

		byProvider := mapToSortedRows(byProviderMap, func(r aiTokenRow) string { return r.Provider })
		byModel := mapToSortedRows(byModelMap, func(r aiTokenRow) string { return r.Provider + r.Model })

		// --- time-series ---------------------------------------------------------

		numBuckets := int(window/step) + 1

		type seriesKey struct{ provider, model string }
		type bucketAccum struct {
			completionTokens int64
			promptTokens     int64
			totalTokens      int64
		}

		seriesBuckets := map[seriesKey][]bucketAccum{}  // per (provider, model)
		providerBuckets := map[string][]bucketAccum{}   // per provider — for sparklines
		totalBuckets := make([]bucketAccum, numBuckets) // grand total — for the total sparkline

		for _, ev := range events {
			idx := int(ev.Timestamp.Sub(since) / step)
			if idx < 0 {
				idx = 0
			}
			if idx >= numBuckets {
				idx = numBuckets - 1
			}

			// (provider, model) buckets — existing line-chart data.
			sk := seriesKey{provider: ev.Provider, model: ev.Model}
			if _, ok := seriesBuckets[sk]; !ok {
				seriesBuckets[sk] = make([]bucketAccum, numBuckets)
			}
			b := &seriesBuckets[sk][idx]
			b.completionTokens += ev.CompletionTokens
			b.promptTokens += ev.PromptTokens
			b.totalTokens += ev.TotalTokens

			// Provider-level buckets for sparklines.
			if _, ok := providerBuckets[ev.Provider]; !ok {
				providerBuckets[ev.Provider] = make([]bucketAccum, numBuckets)
			}
			pb := &providerBuckets[ev.Provider][idx]
			pb.completionTokens += ev.CompletionTokens
			pb.promptTokens += ev.PromptTokens
			pb.totalTokens += ev.TotalTokens

			// Grand-total buckets.
			totalBuckets[idx].completionTokens += ev.CompletionTokens
			totalBuckets[idx].promptTokens += ev.PromptTokens
			totalBuckets[idx].totalTokens += ev.TotalTokens
		}

		// bucketsToPoints converts a bucket slice to a sparse point list (zeros skipped).
		bucketsToPoints := func(buckets []bucketAccum) []aiTimeSeriesPoint {
			var pts []aiTimeSeriesPoint
			for i, bk := range buckets {
				if bk.totalTokens == 0 {
					continue
				}
				pts = append(pts, aiTimeSeriesPoint{
					CompletionTokens: bk.completionTokens,
					PromptTokens:     bk.promptTokens,
					Timestamp:        since.Add(time.Duration(i) * step),
					TotalTokens:      bk.totalTokens,
				})
			}
			return pts
		}

		// Attach per-provider sparkline time series to each byProvider row.
		for i := range byProvider {
			if bk, ok := providerBuckets[byProvider[i].Provider]; ok {
				byProvider[i].TimeSeries = bucketsToPoints(bk)
			}
		}

		// Append the synthetic "total" row that aggregates across all providers.
		var totalRow aiTokenRow
		totalRow.Provider = "total"
		for _, r := range byProvider {
			totalRow.CompletionTokens += r.CompletionTokens
			totalRow.PromptTokens += r.PromptTokens
			totalRow.TotalTokens += r.TotalTokens
		}
		totalRow.TimeSeries = bucketsToPoints(totalBuckets)
		byProvider = append(byProvider, totalRow)

		// Sort series keys for deterministic output.
		sortedKeys := make([]seriesKey, 0, len(seriesBuckets))
		for k := range seriesBuckets {
			sortedKeys = append(sortedKeys, k)
		}
		sort.Slice(sortedKeys, func(i, j int) bool {
			if sortedKeys[i].provider != sortedKeys[j].provider {
				return sortedKeys[i].provider < sortedKeys[j].provider
			}
			return sortedKeys[i].model < sortedKeys[j].model
		})

		series := make([]aiTimeSeriesEntry, 0, len(sortedKeys))
		for _, sk := range sortedKeys {
			pts := bucketsToPoints(seriesBuckets[sk])
			if len(pts) == 0 {
				continue // skip series with no activity in this window
			}
			series = append(series, aiTimeSeriesEntry{
				Model:    sk.model,
				Points:   pts,
				Provider: sk.provider,
			})
		}

		RespondWithJSON(w, http.StatusOK, aiUsageResponse{
			Summary: aiUsageSummary{
				ByModel:    byModel,
				ByProvider: byProvider,
			},
			TimeSeries: aiUsageTimeSeries{
				Series: series,
				Step:   stepStr,
				Window: windowStr,
			},
		})
	}
}

// parseUsageDuration parses a plain integer string as a number of seconds.
// e.g. "60" → 1 minute, "3600" → 1 hour, "86400" → 1 day.
func parseUsageDuration(s string) (time.Duration, error) {
	secs, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("expected an integer number of seconds, got %q: %w", s, err)
	}
	if secs <= 0 {
		return 0, fmt.Errorf("duration must be a positive number of seconds, got %d", secs)
	}
	return time.Duration(secs) * time.Second, nil
}

// addToRow upserts a row in the map, applying initFn on first insert, then adds token counts.
func addToRow(m map[string]*aiTokenRow, key string, initFn func(*aiTokenRow), prompt, completion, total int64) {
	row, ok := m[key]
	if !ok {
		row = &aiTokenRow{}
		initFn(row)
		m[key] = row
	}
	row.CompletionTokens += completion
	row.PromptTokens += prompt
	row.TotalTokens += total
}

// mapToSortedRows converts a map of *aiTokenRow values into a sorted slice.
func mapToSortedRows(m map[string]*aiTokenRow, sortKey func(aiTokenRow) string) []aiTokenRow {
	rows := make([]aiTokenRow, 0, len(m))
	for _, r := range m {
		rows = append(rows, *r)
	}
	sort.Slice(rows, func(i, j int) bool {
		return sortKey(rows[i]) < sortKey(rows[j])
	})
	return rows
}
func DeleteConversations(conf *config.Config, aiStore aiTypes.AIStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if aiStore == nil || !aiStore.Enabled() {
			RespondWithJSON(w, http.StatusOK, map[string]string{"message": "AI store is not enabled"})
			return
		}

		idsParam := r.URL.Query().Get("conversationIDs")
		if idsParam == "" {
			RespondWithError(w, http.StatusBadRequest, "Missing required query parameter: conversationIDs")
			return
		}

		var ids []string
		for _, id := range strings.Split(idsParam, ",") {
			trimmed := strings.TrimSpace(id)
			if trimmed != "" {
				ids = append(ids, trimmed)
			}
		}
		if len(ids) == 0 {
			RespondWithError(w, http.StatusBadRequest, "No valid conversation IDs provided")
			return
		}

		sessionID := authentication.GetSessionIDContext(r.Context())
		if err := aiStore.DeleteConversations(sessionID, ids); err != nil {
			RespondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to delete conversations: %v", err))
			return
		}

		RespondWithJSON(w, http.StatusOK, map[string]string{"message": "Conversations deleted"})
	}
}
