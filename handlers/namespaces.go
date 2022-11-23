package handlers

import (
	"io"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

func NamespaceList(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	namespaces, err := business.Namespace.GetNamespaces(r.Context())
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, namespaces)
}

// NamespaceValidationSummary is the API handler to fetch validations summary to be displayed.
// It is related to all the Istio Objects within the namespace
func NamespaceValidationSummary(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]

	business, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var validationSummary models.IstioValidationSummary
	istioConfigValidationResults, errValidations := business.Validations.GetValidations(r.Context(), namespace, "", "")
	if errValidations != nil {
		log.Error(errValidations)
		RespondWithError(w, http.StatusInternalServerError, errValidations.Error())
	} else {
		validationSummary = *istioConfigValidationResults.SummarizeValidation(namespace)
	}

	RespondWithJSON(w, http.StatusOK, validationSummary)
}

// ConfigValidationSummary is the API handler to fetch validations summary to be displayed.
// It is related to all the Istio Objects within given namespaces
func ConfigValidationSummary(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	namespaces := params.Get("namespaces") // csl of namespaces
	nss := []string{}
	if len(namespaces) > 0 {
		nss = strings.Split(namespaces, ",")
	}
	business, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	validationSummaries := models.ValidationSummaries{}
	istioConfigValidationResults, errValidations := business.Validations.GetValidations(r.Context(), "", "", "")
	if errValidations != nil {
		log.Error(errValidations)
		RespondWithError(w, http.StatusInternalServerError, errValidations.Error())
	} else {
		for _, ns := range nss {
			validationSummaries[ns] = istioConfigValidationResults.SummarizeValidation(ns)
		}
	}

	RespondWithJSON(w, http.StatusOK, validationSummaries)
}

// NamespaceUpdate is the API to perform a patch on a Namespace configuration
func NamespaceUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Namespace initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]
	body, err := io.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
	}
	jsonPatch := string(body)

	ns, err := business.Namespace.UpdateNamespace(r.Context(), namespace, jsonPatch)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	audit(r, "UPDATE on Namespace: "+namespace+" Patch: "+jsonPatch)
	RespondWithJSON(w, http.StatusOK, ns)
}
