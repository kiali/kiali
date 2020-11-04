package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
)

// IstioStatus returns a list of istio components and its status
func IstioStatus(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	istioStatus, err := business.IstioStatus.GetStatus()
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, istioStatus)
}

func ConfigDump(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	namespace := params["namespace"]
	pod := params["pod"]

	dump, err := business.ProxyStatus.GetConfigDump(pod, namespace)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, dump)
}
