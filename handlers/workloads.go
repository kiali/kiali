package handlers

import (
	"io"
	"net/http"
	"sync"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

// workloadParams holds the path and query parameters for WorkloadList and WorkloadDetails
//
// swagger:parameters workloadParams
type workloadParams struct {
	baseHealthParams
	// The target workload
	//
	// in: path
	Namespace    string `json:"namespace"`
	WorkloadName string `json:"workload"`
	// in: query
	WorkloadType string `json:"type"`
	// Optional
	IncludeHealth bool `json:"health"`
	Validate      bool `json:"validate"`
}

func (p *workloadParams) extract(r *http.Request) {
	vars := mux.Vars(r)
	query := r.URL.Query()
	p.baseExtract(r, vars)
	p.Namespace = vars["namespace"]
	p.WorkloadName = vars["workload"]
	p.WorkloadType = query.Get("type")
	p.IncludeHealth = query.Get("health") != ""
	p.Validate = query.Get("validate") != ""
}

// WorkloadList is the API handler to fetch all the workloads to be displayed, related to a single namespace
func WorkloadList(w http.ResponseWriter, r *http.Request) {
	p := workloadParams{}
	p.extract(r)

	criteria := business.WorkloadCriteria{Namespace: p.Namespace, IncludeIstioResources: true, IncludeHealth: p.IncludeHealth, RateInterval: p.RateInterval, QueryTime: p.QueryTime}

	// Get business layer
	businessLayer, err := getBusiness(r)

	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Workloads initialization error: "+err.Error())
		return
	}

	if criteria.IncludeHealth {
		rateInterval, err := adjustRateInterval(r.Context(), businessLayer, p.Namespace, p.RateInterval, p.QueryTime)
		if err != nil {
			handleErrorResponse(w, err, "Adjust rate interval error: "+err.Error())
			return
		}
		criteria.RateInterval = rateInterval
	}

	// Fetch and build workloads
	workloadList, err := businessLayer.Workload.GetWorkloadList(r.Context(), criteria)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, workloadList)
}

// WorkloadDetails is the API handler to fetch all details to be displayed, related to a single workload
func WorkloadDetails(w http.ResponseWriter, r *http.Request) {
	p := workloadParams{}
	p.extract(r)

	criteria := business.WorkloadCriteria{Namespace: p.Namespace, WorkloadName: p.WorkloadName, WorkloadType: p.WorkloadType, IncludeIstioResources: true, IncludeServices: true, IncludeHealth: p.IncludeHealth, RateInterval: p.RateInterval, QueryTime: p.QueryTime}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Workloads initialization error: "+err.Error())
		return
	}

	includeValidations := false
	if p.Validate {
		includeValidations = true
	}

	var istioConfigValidations = models.IstioValidations{}
	var errValidations error

	wg := sync.WaitGroup{}
	if includeValidations {
		wg.Add(1)
		go func() {
			defer wg.Done()
			istioConfigValidations, errValidations = business.Validations.GetValidations(r.Context(), criteria.Namespace, "", criteria.WorkloadName)
		}()
	}

	// Fetch and build workload
	workloadDetails, err := business.Workload.GetWorkload(r.Context(), criteria)
	if includeValidations && err == nil {
		wg.Wait()
		workloadDetails.Validations = istioConfigValidations
		err = errValidations
	}

	if criteria.IncludeHealth && err == nil {
		workloadDetails.Health, err = business.Health.GetWorkloadHealth(r.Context(), criteria.Namespace, criteria.WorkloadName, criteria.RateInterval, criteria.QueryTime, workloadDetails)
		if err != nil {
			handleErrorResponse(w, err)
		}
	}

	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, workloadDetails)
}

// WorkloadUpdate is the API to perform a patch on a Workload configuration
func WorkloadUpdate(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	query := r.URL.Query()

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Workloads initialization error: "+err.Error())
		return
	}

	namespace := params["namespace"]
	workload := params["workload"]
	workloadType := query.Get("type")

	includeValidations := false
	if _, found := query["validate"]; found {
		includeValidations = true
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
	}
	jsonPatch := string(body)

	var istioConfigValidations = models.IstioValidations{}
	var errValidations error

	wg := sync.WaitGroup{}
	if includeValidations {
		wg.Add(1)
		go func() {
			defer wg.Done()
			istioConfigValidations, errValidations = business.Validations.GetValidations(r.Context(), namespace, "", workload)
		}()
	}

	workloadDetails, err := business.Workload.UpdateWorkload(r.Context(), namespace, workload, workloadType, true, jsonPatch)
	if includeValidations && err == nil {
		wg.Wait()
		workloadDetails.Validations = istioConfigValidations
		err = errValidations
	}
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	audit(r, "UPDATE on Namespace: "+namespace+" Workload name: "+workload+" Type: "+workloadType+" Patch: "+jsonPatch)
	RespondWithJSON(w, http.StatusOK, workloadDetails)
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
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, podDetails)
}

// PodLogs is the API handler to fetch logs for a single pod container
func PodLogs(w http.ResponseWriter, r *http.Request) {
	if config.IsFeatureDisabled(config.FeatureLogView) {
		RespondWithError(w, http.StatusForbidden, "Pod Logs access is disabled")
		return
	}
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
	opts, err := business.Workload.BuildLogOptionsCriteria(
		queryParams.Get("container"),
		queryParams.Get("duration"),
		queryParams.Get("isProxy"),
		queryParams.Get("sinceTime"),
		queryParams.Get("maxLines"))

	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	// Fetch pod logs
	err = business.Workload.StreamPodLogs(namespace, pod, opts, w)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
}
