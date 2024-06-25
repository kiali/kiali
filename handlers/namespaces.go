package handlers

import (
	"io"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/istio"
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

func NamespaceInfo(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	cluster := clusterNameFromQuery(query)

	business, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	namespaceInfo, err := business.Namespace.GetClusterNamespace(r.Context(), namespace, cluster)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, namespaceInfo)
}

// NamespaceValidationSummary is the API handler to fetch validations summary to be displayed.
// It is related to all the Istio Objects within the namespace
func NamespaceValidationSummary(discovery *istio.Discovery) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		vars := mux.Vars(r)
		namespace := vars["namespace"]

		cluster := clusterNameFromQuery(query)

		business, err := getBusiness(r)
		if err != nil {
			log.Error(err)
			RespondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		var validationSummary models.IstioValidationSummary
		istioConfigValidationResults := models.IstioValidations{}
		var errValidations error

		// If cluster is not set, is because we need a unified validations view (E.g. in the Summary graph)
		clusters, _ := discovery.Clusters()
		if len(clusters) == 1 {
			istioConfigValidationResults, errValidations = business.Validations.GetValidations(r.Context(), cluster, namespace, "", "")
		} else {
			for _, cl := range clusters {
				_, errNs := business.Namespace.GetClusterNamespace(r.Context(), namespace, cl.Name)
				if errNs == nil {
					clusterIstioConfigValidationResults, _ := business.Validations.GetValidations(r.Context(), cl.Name, namespace, "", "")
					istioConfigValidationResults = istioConfigValidationResults.MergeValidations(clusterIstioConfigValidationResults)
				}
			}
		}

		if errValidations != nil {
			log.Error(errValidations)
			RespondWithError(w, http.StatusInternalServerError, errValidations.Error())
		} else {
			validationSummary = *istioConfigValidationResults.SummarizeValidation(namespace, cluster)
		}

		RespondWithJSON(w, http.StatusOK, validationSummary)
	}
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
	cluster := clusterNameFromQuery(params)

	business, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(nss) == 0 {
		loadedNamespaces, _ := business.Namespace.GetClusterNamespaces(r.Context(), cluster)
		for _, ns := range loadedNamespaces {
			nss = append(nss, ns.Name)
		}
	}

	istioConfigValidationResults, errValidations := business.Validations.GetValidations(r.Context(), cluster, "", "", "")
	if errValidations != nil {
		log.Error(errValidations)
		RespondWithError(w, http.StatusInternalServerError, errValidations.Error())
		return
	}

	validationSummaries := []models.IstioValidationSummary{}
	for _, ns := range nss {
		validationSummaries = append(validationSummaries, *istioConfigValidationResults.SummarizeValidation(ns, cluster))
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

	query := r.URL.Query()
	cluster := clusterNameFromQuery(query)

	ns, err := business.Namespace.UpdateNamespace(r.Context(), namespace, jsonPatch, cluster)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	audit(r, "UPDATE on Namespace: "+namespace+" Patch: "+jsonPatch)
	RespondWithJSON(w, http.StatusOK, ns)
}
