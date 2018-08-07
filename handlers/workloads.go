package handlers

import (
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/business"
)

func WorkloadList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := business.Get()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]

	// Fetch and build workloads
	workloadList, err := business.Workload.GetWorkloadList(namespace)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, workloadList)
}

// WorkloadMetrics is the API handler to fetch metrics to be displayed, related to a single workload
func WorkloadMetrics(w http.ResponseWriter, r *http.Request) {
	getWorkloadMetrics(w, r, prometheus.NewClient)
}

// getWorkloadMetrics (mock-friendly version)
func getWorkloadMetrics(w http.ResponseWriter, r *http.Request, promClientSupplier func() (*prometheus.Client, error)) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	workload := vars["workload"]

	params := prometheus.MetricsQuery{Namespace: namespace, Workload: workload}
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
