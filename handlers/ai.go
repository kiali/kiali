package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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
	"github.com/kiali/kiali/handlers/queryparams"
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

		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "category"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		category := query.Get("category")
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
		recordChatAIUsage(aiStore, userID, usageProviderName, usageModelName, usage)
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

func recordChatAIUsage(aiStore aiTypes.AIStore, userID string, provider string, model string, usage aiTypes.TokenUsage) {
	if aiStore == nil || !aiStore.Enabled() || !usage.HasTokens() {
		return
	}
	if userID == "" {
		userID = "unknown"
	}
	if err := aiStore.RecordUsage(userID, provider, model, usage); err != nil {
		log.Errorf("[Chat AI] Failed to record usage for user [%s], provider [%s], model [%s]: %v", userID, provider, model, err)
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

func DeleteConversations(conf *config.Config, aiStore aiTypes.AIStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if aiStore == nil || !aiStore.Enabled() {
			RespondWithJSON(w, http.StatusOK, map[string]string{"message": "AI store is not enabled"})
			return
		}

		query := r.URL.Query()
		if err := queryparams.RejectUnknown(query, "conversationIDs"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		idsParam := query.Get("conversationIDs")
		if idsParam == "" {
			RespondWithQueryParamError(w, "Missing required query parameter: conversationIDs")
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
			RespondWithQueryParamError(w, "No valid conversation IDs provided")
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
