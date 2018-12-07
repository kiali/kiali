package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

func NamespaceList(w http.ResponseWriter, r *http.Request) {

	business, err := business.Get()
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
	getNamespaceMetrics(w, r, defaultPromClientSupplier, defaultK8SClientSupplier)
}

// NamespaceIstioValidations is the API handler to get istio validations of a given namespace
func NamespaceIstioValidations(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	vars := mux.Vars(r)
	namespace := vars["namespace"]

	istioValidations, err := business.Validations.GetNamespaceValidations(namespace)
	if err != nil {
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, "Error checking istio object consistency: "+err.Error())
		}
		return
	}
	RespondWithJSON(w, http.StatusOK, istioValidations)
}

// getServiceMetrics (mock-friendly version)
func getNamespaceMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier, k8sSupplier k8sClientSupplier) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]

	prom, _, namespaceInfo := initClientsForMetrics(w, promSupplier, k8sSupplier, namespace)
	if prom == nil {
		// any returned value nil means error & response already written
		return
	}

	params := prometheus.MetricsQuery{Namespace: namespace}
	err := extractMetricsQueryParams(r, &params, namespaceInfo)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	metrics := prom.GetMetrics(&params)
	RespondWithJSON(w, http.StatusOK, metrics)
}
