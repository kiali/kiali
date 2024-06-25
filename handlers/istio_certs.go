package handlers

import "net/http"

// IstioCerts returns information about internal certificates used by Istio
func IstioCerts(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	certs, err := business.IstioCerts.GetCertsInfo(r.Context())
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	RespondWithJSON(w, http.StatusOK, certs)
}
