package handlers

import (
	"net/http"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
)

// GetPersesInfo provides the Perses URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Perses service in Istio installation namespace
func GetPersesInfo(conf *config.Config, persesService *perses.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// There may be side effects to this call and that's why it's being called here
		// even though the auth info is not being used directly.
		if _, err := getAuthInfo(r); err != nil {
			RespondWithError(w, http.StatusInternalServerError, "authInfo initialization error: "+err.Error())
			return
		}

		info, code, err := persesService.Info(r.Context(), perses.DashboardSupplier)
		if err != nil {
			log.Error(err)
			RespondWithError(w, code, err.Error())
			return
		}
		RespondWithJSON(w, code, info)
	}
}
