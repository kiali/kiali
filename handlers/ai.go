package handlers

import (
	"net/http"

	"encoding/json"
	"github.com/gorilla/mux"
	"github.com/kiali/kiali/ai"
	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

func ChatAI(
	conf *config.Config,
	kialiCache cache.KialiCache,
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
		modelName := params["modelName"]

		var req ai.AIRequest
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

		provider, err := ai.NewAIProvider(conf, modelName)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}

		toolHandlers := []mcp.ToolHandler{
			mcp.NewMeshGraphTool(),
			mcp.NewResourceDetailTool(),
			mcp.NewManageIstioConfigTool(),
		}

		resp, code := provider.SendChat(r.Context(), req, toolHandlers, businessLayer, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)

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
