package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

// ServiceList is the API handler to fetch the list of services in a given namespace
func ServiceList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Create clients
	client, err := kubernetes.NewClient()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Kubernetes client error: "+err.Error())
		return
	}
	prometheusClient, err := prometheus.NewClient()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Prometheus client error: "+err.Error())
		return
	}

	// Create response object
	serviceList := models.ServiceList{}
	serviceList.Namespace = models.Namespace{Name: params["namespace"]}

	// Fetch services list
	kubernetesServices, err := client.GetServices(serviceList.Namespace.Name)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Fetch services requests counters
	queryParams := r.URL.Query()
	ratesInterval := "1m"
	if rateIntervals, ok := queryParams["rateInterval"]; ok && len(rateIntervals) > 0 {
		ratesInterval = rateIntervals[0]
	}
	requestCounters := prometheusClient.GetNamespaceServicesRequestCounters(params["namespace"], ratesInterval)

	// Build response
	serviceList.SetServiceList(kubernetesServices)
	serviceList.ProcessRequestCounters(requestCounters)
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

	params, err := extractServiceMetricsQuery(r, namespace, service)
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
	metrics := prometheusClient.GetServiceMetrics(params)
	RespondWithJSON(w, http.StatusOK, metrics)
}

// ServiceHealth is the API handler to get health of a single service
func ServiceHealth(w http.ResponseWriter, r *http.Request) {
	getServiceHealth(w, r, prometheus.NewClient)
}

// getServiceHealth (mock-friendly version)
func getServiceHealth(w http.ResponseWriter, r *http.Request, promClientSupplier func() (*prometheus.Client, error)) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	service := vars["service"]
	prometheusClient, err := promClientSupplier()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusServiceUnavailable, "Prometheus client error: "+err.Error())
		return
	}

	health := prometheusClient.GetServiceHealth(namespace, service)
	RespondWithJSON(w, http.StatusOK, health)
}

// ServiceDetails is the API handler to fetch full details of an specific service
func ServiceDetails(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	service := models.Service{}
	service.Name = params["service"]
	service.Namespace = models.Namespace{params["namespace"]}

	client, err := kubernetes.NewClient()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	prometheusClient, err := prometheus.NewClient()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	serviceDetails, err := client.GetServiceDetails(service.Namespace.Name, service.Name)
	if errors.IsNotFound(err) {
		RespondWithError(w, http.StatusNotFound, err.Error())
		return
	} else if statusError, isStatus := err.(*errors.StatusError); isStatus {
		RespondWithError(w, http.StatusInternalServerError, statusError.ErrStatus.Message)
		return
	} else if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	istioDetails, err := client.GetIstioDetails(service.Namespace.Name, service.Name)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	incomeServices, err := prometheusClient.GetSourceServices(service.Namespace.Name, service.Name)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	service.SetServiceDetails(serviceDetails, istioDetails, incomeServices)
	RespondWithJSON(w, http.StatusOK, service)
}
