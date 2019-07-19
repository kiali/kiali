package handlers
  
import (
        "net/http"

        "github.com/gorilla/mux"
        "k8s.io/apimachinery/pkg/api/errors"
)

// ServiceApiDocumentation is the API handler to get api documentation of a single service
func ServiceApiDocumentation(w http.ResponseWriter, r *http.Request) {
        business, err := getBusiness(r)
        if err != nil {
                RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
                return
        }
        vars := mux.Vars(r)
        apidoc, err := business.Svc.GetServiceApiDocumentation(vars["namespace"], vars["service"])
        handleApiDocumentationResponse(w, apidoc, err)
}

func handleApiDocumentationResponse(w http.ResponseWriter, apidoc string, err error) {
        if err != nil {
                if errors.IsNotFound(err) {
                        RespondWithError(w, http.StatusNotFound, err.Error())
                } else if statusError, isStatus := err.(*errors.StatusError); isStatus {
                        RespondWithError(w, int(statusError.ErrStatus.Code), statusError.ErrStatus.Message)
                } else {
                        RespondWithError(w, http.StatusInternalServerError, err.Error())
                }
        } else {
                w.WriteHeader(http.StatusOK)
                w.Write([]byte(apidoc))
        }
}
