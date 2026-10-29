package handlers

import (
	"net/http"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
)

// Helper method to adjust error code in the handler's response
// It helps for business methods that can respond AccessibleError and NotFound cases
// Some handlers can use a direct response
func handleErrorResponse(w http.ResponseWriter, err error, extraMesg ...string) {
	errorMsg := err.Error()
	if len(extraMesg) > 0 {
		errorMsg = strings.Join(extraMesg, ";")
	}
	log.Error(errorMsg)
	if business.IsAccessibleError(err) {
		RespondWithError(w, http.StatusForbidden, errorMsg)
	} else if errors.IsNotFound(err) {
		RespondWithError(w, http.StatusNotFound, errorMsg)
	} else if errors.IsServiceUnavailable(err) {
		RespondWithError(w, http.StatusServiceUnavailable, errorMsg)
	} else if errors.IsForbidden(err) {
		// A Forbidden from the API server means the user's own credentials
		// were rejected for the resource fetch (e.g. pods/log); surface it as
		// the authorization failure it is rather than a server error.
		// Note: k8s Unauthorized deliberately stays 500 — the frontend's
		// global axios interceptor ends the session on any 401, and k8s
		// Unauthorized can come from a remote-cluster credential rather
		// than the user's session. 401 is reserved for Kiali's own
		// authentication middleware.
		RespondWithError(w, http.StatusForbidden, errorMsg)
	} else if statusError, isStatus := err.(*errors.StatusError); isStatus {
		errorMsg = statusError.ErrStatus.Message
		RespondWithError(w, http.StatusInternalServerError, errorMsg)
	} else {
		RespondWithError(w, http.StatusInternalServerError, errorMsg)
	}
}
