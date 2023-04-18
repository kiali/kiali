package handlers

import (
	"net/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
)

// GetGrafanaInfo provides the Grafana URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in Istio installation namespace
func GetGrafanaInfo(w http.ResponseWriter, r *http.Request) {
	// There may be side effects to this call and that's why it's being called here
	// even though the auth info is not being used directly.
	if _, err := getAuthInfo(r); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "authInfo initialization error: "+err.Error())
		return
	}

	info, code, err := business.GetGrafanaInfo(business.GrafanaDashboardSupplier)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, info)
}
