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
	RespondWithJSONIndent(w, http.StatusOK, status.Get())
}
