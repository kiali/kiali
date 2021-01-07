package handlers

import (
	"net/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
)

// GetGrafanaInfo provides the Grafana URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in Istio installation namespace
func GetGrafanaInfo(w http.ResponseWriter, r *http.Request) {
	requestAuthInfo, err := getAuthInfo(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "authInfo initialization error: "+err.Error())
		return
	}

	info, code, err := business.GetGrafanaInfo(requestAuthInfo, business.GrafanaDashboardSupplier)

	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, info)
}
