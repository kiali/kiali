package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/ai"
	"github.com/kiali/kiali/business/ai/tools"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
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

		businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "AI initialization error: "+err.Error())
			return
		}

		provider, err := business.NewAIProvider(conf, modelName)
		if err != nil {
			log.Errorf("failed to create AI provider for model %s: %s", modelName, err.Error())
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		toolHandlers := []tools.ToolHandler{
			tools.NewNamespacesTool(&businessLayer.Namespace),
		}

		resp, err := provider.SendChat(r.Context(), req, toolHandlers)
		if err != nil {
			log.Errorf("failed to send chat to model %s: %s", modelName, err.Error())
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Errorf("failed to encode AI response: %s", err.Error())
			http.Error(w, "failed to encode response", http.StatusInternalServerError)
			return
		}
	}
}