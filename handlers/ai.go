package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/ai"
	aiTypes "github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/tracing"
)

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
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if conf.Auth.Strategy != config.AuthStrategyAnonymous {
			authInfo, err := getAuthInfo(r)
			if err != nil {
				RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
				return
			}
			req.Username = authInfo[conf.KubernetesConfig.ClusterName].Username
		} else {
			req.Username = "anonymous"
		}
		businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}

		provider, err := ai.NewAIProvider(conf, providerName, modelName)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}

		internalmetrics.GetAIRequestsTotalMetric(providerName, modelName).Inc()
		requestTimer := internalmetrics.GetAIRequestDurationPrometheusTimer(providerName, modelName)
		defer requestTimer.ObserveDuration()
		// Add headers to prevent any buffering along the way
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		// Disable gzip for this specific endpoint to ensure real-time streaming
		w.Header().Set("Content-Encoding", "identity")

		flusher, ok := w.(http.Flusher)
		if !ok {
			RespondWithError(w, http.StatusInternalServerError, "Streaming unsupported")
			return
		}

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
		provider.SendChat(onChunk, r, req, businessLayer, prom, clientFactory, kialiCache, aiStore, conf, grafana, perses, discovery)
	}
}

func ChatConversations(
	conf *config.Config,
	aiStore aiTypes.AIStore,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.ChatAI.Enabled {
			RespondWithError(w, http.StatusInternalServerError, "ChatAI is not enabled")
			return
		}
		sessionID := authentication.GetSessionIDContext(r.Context())
		RespondWithJSON(w, http.StatusOK, aiStore.GetConversationIDs(sessionID))
	}
}

func DeleteChatConversations(
	conf *config.Config,
	aiStore aiTypes.AIStore,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.ChatAI.Enabled {
			RespondWithError(w, http.StatusInternalServerError, "ChatAI is not enabled")
			return
		}
		sessionID := authentication.GetSessionIDContext(r.Context())
		conversationIDsParam := r.URL.Query().Get("conversationIDs")
		if conversationIDsParam == "" {
			RespondWithError(w, http.StatusBadRequest, "conversationIDs query parameter is required")
			return
		}
		// Split comma-separated conversation IDs
		conversationIDs := strings.Split(conversationIDsParam, ",")
		err := aiStore.DeleteConversations(sessionID, conversationIDs)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Failed to delete conversations: "+err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, "Conversations deleted successfully")
	}
}
