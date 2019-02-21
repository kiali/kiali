package handlers

import (
	"net/http"

	"github.com/kiali/kiali/business"
)

// Config is a REST http.HandlerFunc serving up the Kiali configuration made public to clients.
func Config(w http.ResponseWriter, r *http.Request) {
	defer handlePanic(w)

	// Note that determine the Prometheus config at request time because it is not
	// guaranteed to remain the same during the Kiali lifespan.
	publicConfig := business.GetPublicConfig()

	RespondWithJSONIndent(w, http.StatusOK, publicConfig)
}
