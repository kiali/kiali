package handlers

import "net/http"

// IstioCerts returns information about internal certificates used by Istio
func IstioCerts(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	certs, _ := business.IstioCerts.GetCertsInfo()
	RespondWithJSON(w, http.StatusOK, certs)
}
