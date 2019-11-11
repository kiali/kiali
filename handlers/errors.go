package handlers

import (
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
)

// Helper method to adjust error code in the handler's response
// It helps for business methods that can respond AccessibleError and NotFound cases
// Some handlers can use a direct response
func handleErrorResponse(w http.ResponseWriter, err error) {
	log.Error(err)
	if business.IsAccessibleError(err) {
		RespondWithError(w, http.StatusForbidden, err.Error())
	} else if errors.IsNotFound(err) {
		RespondWithError(w, http.StatusNotFound, err.Error())
	} else if statusError, isStatus := err.(*errors.StatusError); isStatus {
		RespondWithError(w, http.StatusInternalServerError, statusError.ErrStatus.Message)
	} else {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
	}
}
