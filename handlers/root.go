package handlers

import (
	"net/http"

	"github.com/kiali/kiali/status"
)

// Healthz is a trivial endpoint that simply returns a 200 status code with no response body.
// This is to simply confirm the readiness of the server.
// You can use this for readiness and liveness probes.
func Healthz(w http.ResponseWriter, r *http.Request) {
	RespondWithCode(w, http.StatusOK)
}

// Root provides basic status of the server.
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
