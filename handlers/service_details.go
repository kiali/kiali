package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/prometheus"
)

const (
	defaultMetricsRange = "5m"
	namespaceParam      = "namespace"
	serviceParam        = "service"
	rangeParam          = "range"
)

// GetServiceMetrics is the API handler to fetch metrics to be displayed, related to a single service
func GetServiceMetrics(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	metrics, err := prometheusClient.GetServiceMetrics(namespace, service, rangeV)
	if err != nil {
		log.Error(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if len(metrics) == 0 {
		http.Error(w, "Metrics not found", http.StatusNotFound)
		return
	}
	js, err := json.Marshal(metrics)
	if err != nil {
		log.Error(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(js)
}
