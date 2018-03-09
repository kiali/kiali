package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/kiali/swscore/kubernetes"
	"github.com/kiali/swscore/log"
	"github.com/kiali/swscore/models"
	"github.com/kiali/swscore/prometheus"

	"k8s.io/apimachinery/pkg/api/errors"
)

const (
	metricsDefaultRateInterval = "1m"
	metricsDefaultStepSec      = 15
	metricsDefaultDurationMin  = 30
)

// ServiceList is the API handler to fetch the list of services in a given namespace
func ServiceList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := models.Namespace{Name: params["namespace"]}

	services, err := models.GetServicesByNamespace(namespace.Name)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, models.ServiceList{Namespace: namespace, Service: services})
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
	queryParams := r.URL.Query()
	rateInterval := metricsDefaultRateInterval
	if rateIntervals, ok := queryParams["rateInterval"]; ok && len(rateIntervals) > 0 {
		// Only first is taken into consideration
		rateInterval = rateIntervals[0]
	}
	duration := metricsDefaultDurationMin * time.Minute
	if durations, ok := queryParams["duration"]; ok && len(durations) > 0 {
		if num, err := strconv.Atoi(durations[0]); err == nil {
			duration = time.Duration(num) * time.Second
		} else {
			// Bad request
			RespondWithError(w, http.StatusBadRequest, "Bad request, cannot parse query parameter 'duration'")
			return
		}
	}
	step := metricsDefaultStepSec * time.Second
	if steps, ok := queryParams["step"]; ok && len(steps) > 0 {
		if num, err := strconv.Atoi(steps[0]); err == nil {
			step = time.Duration(num) * time.Second
		} else {
			// Bad request
			RespondWithError(w, http.StatusBadRequest, "Bad request, cannot parse query parameter 'step'")
			return
		}
	}
	var byLabelsIn []string
	var byLabelsOut []string
	if lblsin, ok := queryParams["byLabelsIn[]"]; ok && len(lblsin) > 0 {
		byLabelsIn = lblsin
	}
	if lblsout, ok := queryParams["byLabelsOut[]"]; ok && len(lblsout) > 0 {
		byLabelsOut = lblsout
	}
	prometheusClient, err := promClientSupplier()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusServiceUnavailable, "Prometheus client error: "+err.Error())
		return
	}
	metrics := prometheusClient.GetServiceMetrics(namespace, service, duration, step, rateInterval, byLabelsIn, byLabelsOut)
	RespondWithJSON(w, http.StatusOK, metrics)
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
