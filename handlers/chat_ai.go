package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

func ChatAI(conf *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)
		modelName := params["modelName"]

		var req business.AIRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		provider, err := business.NewAIProvider(conf, modelName)
		if err != nil {
			log.Errorf("failed to create AI provider for model %s: %s", modelName, err.Error())
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		resp, err := provider.SendChat(r.Context(), req)
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