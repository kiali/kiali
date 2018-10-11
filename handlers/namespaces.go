package handlers

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/kubernetes"
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
	getNamespaceMetrics(w, r, prometheus.NewClient, func() (kubernetes.IstioClientInterface, error) {
		return kubernetes.NewClient()
	})
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
		RespondWithError(w, http.StatusInternalServerError, "Error checking istio object consistency: "+err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, istioValidations)
}

// getServiceMetrics (mock-friendly version)
func getNamespaceMetrics(w http.ResponseWriter, r *http.Request, promClientSupplier func() (*prometheus.Client, error), k8sClientSupplier func() (kubernetes.IstioClientInterface, error)) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]

	k8s, err := k8sClientSupplier()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusServiceUnavailable, "Kubernetes client error: "+err.Error())
		return
	}

	params := prometheus.MetricsQuery{Namespace: namespace}
	err = extractMetricsQueryParams(r, &params, k8s)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	prometheusClient, err := promClientSupplier()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusServiceUnavailable, "Prometheus client error: "+err.Error())
		return
	}
	metrics := prometheusClient.GetMetrics(&params)
	RespondWithJSON(w, http.StatusOK, metrics)
}
