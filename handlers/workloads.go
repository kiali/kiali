package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/prometheus"
)

// WorkloadList is the API handler to fetch all the workloads to be displayed, related to a single namespace
func WorkloadList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Workloads initialization error: "+err.Error())
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

// WorkloadDetails is the API handler to fetch all details to be displayed, related to a single workload
func WorkloadDetails(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Workloads initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]
	workload := params["workload"]

	// Fetch and build workload
	workloadDetails, err := business.Workload.GetWorkload(namespace, workload, true)
	if err != nil {
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	RespondWithJSON(w, http.StatusOK, workloadDetails)
}

// WorkloadMetrics is the API handler to fetch metrics to be displayed, related to a single workload
func WorkloadMetrics(w http.ResponseWriter, r *http.Request) {
	getWorkloadMetrics(w, r, defaultPromClientSupplier)
}

// getWorkloadMetrics (mock-friendly version)
func getWorkloadMetrics(w http.ResponseWriter, r *http.Request, promSupplier promClientSupplier) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	workload := vars["workload"]

	prom, namespaceInfo := initClientsForMetrics(w, r, promSupplier, namespace)
	if prom == nil {
		// any returned value nil means error & response already written
		return
	}

	params := prometheus.IstioMetricsQuery{Namespace: namespace, Workload: workload}
	err := extractIstioMetricsQueryParams(r, &params, namespaceInfo)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	metrics := prom.GetMetrics(&params)
	RespondWithJSON(w, http.StatusOK, metrics)
}

// WorkloadDashboard is the API handler to fetch Istio dashboard, related to a single workload
func WorkloadDashboard(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	workload := vars["workload"]

	prom, namespaceInfo := initClientsForMetrics(w, r, defaultPromClientSupplier, namespace)
	if prom == nil {
		// any returned value nil means error & response already written
		return
	}

	params := prometheus.IstioMetricsQuery{Namespace: namespace, Workload: workload}
	err := extractIstioMetricsQueryParams(r, &params, namespaceInfo)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	svc := business.NewDashboardsService(nil, prom)
	dashboard, err := svc.GetIstioDashboard(params)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, dashboard)
}

// PodDetails is the API handler to fetch all details to be displayed, related to a single pod
func PodDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Pods initialization error: "+err.Error())
		return
	}
	namespace := vars["namespace"]
	pod := vars["pod"]

	// Fetch and build pod
	podDetails, err := business.Workload.GetPod(namespace, pod)
	if err != nil {
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	RespondWithJSON(w, http.StatusOK, podDetails)
}

// PodLogs is the API handler to fetch logs for a single pod container
func PodLogs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	queryParams := r.URL.Query()

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Pod Logs initialization error: "+err.Error())
		return
	}
	namespace := vars["namespace"]
	pod := vars["pod"]

	// Get log options
	podLogOptions := core_v1.PodLogOptions{Timestamps: true}
	if container := queryParams.Get("container"); container != "" {
		podLogOptions.Container = container
	}
	if sinceTime := queryParams.Get("sinceTime"); sinceTime != "" {
		if numTime, err := strconv.ParseInt(sinceTime, 10, 64); err == nil {
			podLogOptions.SinceTime = &meta_v1.Time{Time: time.Unix(numTime, 0)}
		} else {
			RespondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Invalid sinceTime [%s]: %v", sinceTime, err))
			return
		}
	}
	if tailLines := queryParams.Get("tailLines"); tailLines != "" {
		if numLines, err := strconv.ParseInt(tailLines, 10, 64); err == nil {
			if numLines > 0 {
				podLogOptions.TailLines = &numLines
			}
		} else {
			RespondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Invalid tailLines [%s]: %v", tailLines, err))
			return
		}
	}

	// Fetch pod logs
	podLogs, err := business.Workload.GetPodLogs(namespace, pod, &podLogOptions)
	if err != nil {
		if errors.IsNotFound(err) {
			RespondWithError(w, http.StatusNotFound, err.Error())
		} else {
			RespondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	RespondWithJSON(w, http.StatusOK, podLogs)
}
