package handlers

import (
	"net/http"
)

// IstioStatus returns a list of istio components and its status
func IstioStatus(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	istioStatus, err := business.IstioStatus.GetStatus(r.Context())
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, istioStatus)
}
