package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/business"
)

// ServiceList is the API handler to fetch the list of services in a given namespace
func ServiceList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]

	// Fetch and build services
	serviceList, err := business.Svc.GetServiceList(namespace)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, serviceList)
}

// ServiceMetrics is the API handler to fetch metrics to be displayed, related to a single service
func ServiceMetrics(w http.ResponseWriter, r *http.Request) {
	getServiceMetrics(w, r, prometheus.NewClient)
}

// getServiceMetrics (mock-friendly version)
func getServiceMetrics(w http.ResponseWriter, r *http.Request, promClientSupplier func() (*prometheus.Client, error)) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	apps, err := business.Svc.GetApps(namespace, service)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not get apps: "+err.Error())
		return
	}

	params := prometheus.MetricsQuery{Namespace: namespace, Apps: apps}
	err = extractMetricsQueryParams(r, &params)
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

// ServiceIstioValidations is the API handler to get istio validations of a single service that returns
// an IstioValidation object which contains for each object type
// one validation per each detected object in the current cluster that have an error/warning in its configuration.
func ServiceIstioValidations(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]

	istioValidations, err := business.Validations.GetServiceValidations(namespace, service)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Error checking istio object consistency: "+err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, istioValidations)
}

// ServiceDetails is the API handler to fetch full details of an specific service
func ServiceDetails(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	// Rate interval is needed to fetch request rates based health
	rateInterval := defaultHealthRateInterval
	queryParams := r.URL.Query()
	if rateIntervals, ok := queryParams["rateInterval"]; ok && len(rateIntervals) > 0 {
		rateInterval = rateIntervals[0]
	}

	params := mux.Vars(r)
	service, err := business.Svc.GetService(params["namespace"], params["service"], rateInterval)
	if err != nil {
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else if statusError, isStatus := err.(*errors.StatusError); isStatus {
			RespondWithError(w, http.StatusInternalServerError, statusError.ErrStatus.Message)
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	RespondWithJSON(w, http.StatusOK, service)
}
