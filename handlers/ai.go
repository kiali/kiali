package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/ai"
	"github.com/kiali/kiali/ai/mcp"
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

		toolHandlers := []mcp.ToolHandler{
			mcp.NewMeshGraphTool(),
			mcp.NewResourceDetailTool(),
			mcp.NewManageIstioConfigTool(),
			mcp.NewActionUITool(),
			mcp.NewCitationsTool(),
		}

		resp, code := provider.SendChat(r, req, toolHandlers, businessLayer, prom, clientFactory, kialiCache, aiStore, conf, grafana, perses, discovery)

		if resp == nil {
			RespondWithError(w, http.StatusInternalServerError, "AI response is empty")
			return
		}
		if code != http.StatusOK && resp.Error != "" {
			RespondWithError(w, code, resp.Error)
			return
		}
		RespondWithJSONIndent(w, code, resp)
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
