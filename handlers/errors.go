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
	} else if statusError, isStatus := err.(*errors.StatusError); isStatus {
		errorMsg = statusError.ErrStatus.Message
		RespondWithError(w, http.StatusInternalServerError, errorMsg)
	} else {
		RespondWithError(w, http.StatusInternalServerError, errorMsg)
	}
}
