package handlers

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/business"
	"github.com/kiali/kiali/services/models"
)

func NamespaceList(w http.ResponseWriter, r *http.Request) {
	namespaces, err := models.GetNamespaces()
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
	getNamespaceMetrics(w, r, prometheus.NewClient)
}

// NamespaceHealth is the API handler to get health of every services in the given namespace
func NamespaceHealth(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	vars := mux.Vars(r)
	namespace := vars["namespace"]

	// Rate interval is needed to fetch request rates based health
	rateInterval := defaultHealthRateInterval
	queryParams := r.URL.Query()
	if rateIntervals, ok := queryParams["rateInterval"]; ok && len(rateIntervals) > 0 {
		rateInterval = rateIntervals[0]
	}

	health, err := business.Health.GetNamespaceHealth(namespace, rateInterval)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Error while fetching health: "+err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, health)
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
func getNamespaceMetrics(w http.ResponseWriter, r *http.Request, promClientSupplier func() (*prometheus.Client, error)) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	params, err := extractNamespaceMetricsQuery(r, namespace, "")
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
	metrics := prometheusClient.GetNamespaceMetrics(params)
	RespondWithJSON(w, http.StatusOK, metrics)
}
