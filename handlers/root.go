package handlers

import (
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/status"
)

// Healthz is a trivial endpoint that simply returns a 200 status code with no response body.
// This is to simply confirm the readiness of the server.
// You can use this for readiness and liveness probes.
func Healthz(w http.ResponseWriter, r *http.Request) {
	RespondWithCode(w, http.StatusOK)
}

// Root provides basic status of the server.
func Root(conf *config.Config, clientFactory kubernetes.ClientFactory, cache cache.KialiCache, grafana *grafana.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		RespondWithJSONIndent(w, http.StatusOK, status.Get(r.Context(), conf, clientFactory, cache, grafana))
	}
}
