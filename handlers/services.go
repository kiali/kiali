package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/models"
	"github.com/swift-sunshine/swscore/prometheus"
)

const (
	defaultMetricsRange = "5m"
	namespaceParam      = "namespace"
	serviceParam        = "service"
	rangeParam          = "range"
)

// ServiceList is the API handler to fetch the list of services in a given namespace
func ServiceList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	namespace := models.Namespace{Name: params[namespaceParam]}

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
	vars := mux.Vars(r)
	namespace := vars[namespaceParam]
	service := vars[serviceParam]
	rangeV := defaultMetricsRange
	if ranges, ok := r.URL.Query()[rangeParam]; ok && len(ranges) > 0 {
		// Only first is taken into consideration
		rangeV = ranges[0]
	}
	prometheusClient, err := prometheus.NewClient()
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusServiceUnavailable, "Prometheus client error: "+err.Error())
		return
	}
	metrics, err := prometheusClient.GetServiceMetrics(namespace, service, rangeV)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusServiceUnavailable, "Prometheus client error: "+err.Error())
		return
	}
	if len(metrics) == 0 {
		// Every service should have metrics, so most probably it's because the service doesn't exist.
		RespondWithError(w, http.StatusNotFound, "Metrics not found")
		return
	}
	RespondWithJSON(w, http.StatusOK, metrics)
}
