package handlers

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// AppMetrics is the API handler to fetch metrics to be displayed, related to an app-label grouping
func AppMetrics(w http.ResponseWriter, r *http.Request) {
	getAppMetrics(w, r, prometheus.NewClient)
}

// getAppMetrics (mock-friendly version)
func getAppMetrics(w http.ResponseWriter, r *http.Request, promClientSupplier func() (*prometheus.Client, error)) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	app := vars["app"]

	params := prometheus.MetricsQuery{Namespace: namespace, Apps: []string{app}}
	err := extractMetricsQueryParams(r, &params)
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
