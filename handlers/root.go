package handlers

import (
	"net/http"

	"github.com/kiali/kiali/status"
)

func Root(w http.ResponseWriter, r *http.Request) {
	getStatus(w, r)
}

func getStatus(w http.ResponseWriter, r *http.Request) {

	tokenContext := r.Context().Value("token")
	if tokenContext != nil {
		if token, ok := tokenContext.(string); ok {
			RespondWithJSONIndent(w, http.StatusOK, status.Get(token))
		} else {
			RespondWithJSONIndent(w, http.StatusInternalServerError, "Token is not of type string")
		}
	} else {
		RespondWithJSONIndent(w, http.StatusInternalServerError, "Token missing in request context")
	}
}
