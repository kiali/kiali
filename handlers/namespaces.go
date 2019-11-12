package handlers

import (
	"github.com/kiali/kiali/models"
	"net/http"
	"sync"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

func NamespaceList(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)

	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	namespaces, err := business.Namespace.GetNamespaces()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, namespaces)
}

// NamespaceMetrics is the API handler to fetch metrics to be displayed, related to all
// services in the namespace
func NamespaceMetrics(w http.ResponseWriter, r *http.Request) {
	getNamespaceMetrics(w, r, defaultPromClientSupplier)
}

// getServiceMetrics (mock-friendly version)
func getNamespaceMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]

	prom, namespaceInfo := initClientsForMetrics(w, r, promSupplier, namespace)
	if prom == nil {
		// any returned value nil means error & response already written
		return
	}

	params := prometheus.IstioMetricsQuery{Namespace: namespace}
	err := extractIstioMetricsQueryParams(r, &params, namespaceInfo)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	metrics := prom.GetMetrics(&params)
	RespondWithJSON(w, http.StatusOK, metrics)
}

//NamespaceValidations the API handler to fetch validations to be displayed.
// It is related to all the Istio Objects within the namespace
func NamespaceValidations(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]

	business, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var validationSummary models.IstioValidationSummary

	wg := sync.WaitGroup{}
	wg.Add(1)
	go func(namespace string, validationSummary *models.IstioValidationSummary, err *error) {
		defer wg.Done()
		istioConfigValidationResults, errValidations := business.Validations.GetValidations(namespace, "")
		if errValidations != nil && *err == nil {
			*err = errValidations
		} else {
			*validationSummary = istioConfigValidationResults.SummarizeValidation()
		}
	}(namespace, &validationSummary, &err)

	wg.Wait()
	RespondWithJSON(w, http.StatusOK, validationSummary)
}
