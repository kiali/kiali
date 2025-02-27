package handlers

import (
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
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
	WorkloadGVK schema.GroupVersionKind `json:"workloadGVK"`
	// Optional
	ClusterName           string `json:"clusterName,omitempty"`
	IncludeHealth         bool   `json:"health"`
	IncludeIstioResources bool   `json:"istioResources"`
}

func (p *workloadParams) extract(r *http.Request) error {
	vars := mux.Vars(r)
	query := r.URL.Query()
	p.baseExtract(r, vars)
	p.Namespace = vars["namespace"]
	p.WorkloadName = vars["workload"]
	p.ClusterName = clusterNameFromQuery(query)

	var err error
	p.IncludeHealth, err = strconv.ParseBool(query.Get("health"))
	if err != nil {
		p.IncludeHealth = true
	}
	p.IncludeIstioResources, err = strconv.ParseBool(query.Get("istioResources"))
	if err != nil {
		p.IncludeIstioResources = true
	}

	p.WorkloadGVK, err = util.StringToGVK(query.Get("workloadGVK"))
	if err != nil {
		return err
	}
	return nil
}

// ClustersWorkloads is the API handler to fetch all the workloads to be displayed, related to a single namespace
func ClustersWorkloads(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	namespacesQueryParam := query.Get("namespaces") // csl of namespaces
	p := workloadParams{}
	errParse := p.extract(r)
	if errParse != nil {
		RespondWithError(w, http.StatusInternalServerError, "Request parsing error: "+errParse.Error())
		return
	}

	// Get business layer
	businessLayer, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Workloads initialization error: "+err.Error())
		return
	}

	nss := []string{}
	namespacesFromQueryParams := strings.Split(namespacesQueryParam, ",")
	loadedNamespaces, _ := businessLayer.Namespace.GetClusterNamespaces(r.Context(), p.ClusterName)
	for _, ns := range loadedNamespaces {
		// If namespaces have been provided in the query, further filter the results to only include those namespaces.
		if len(namespacesQueryParam) > 0 {
			if slices.Contains(namespacesFromQueryParams, ns.Name) {
				nss = append(nss, ns.Name)
			}
		} else {
			// Otherwise no namespaces have been provided in the query params, so include all namespaces the user has access to.
			nss = append(nss, ns.Name)
		}
	}

	clusterWorkloadsList := &models.ClusterWorkloads{
		Cluster:     p.ClusterName,
		Workloads:   []models.WorkloadListItem{},
		Validations: models.IstioValidations{},
	}

	for _, ns := range nss {
		criteria := business.WorkloadCriteria{
			Cluster: p.ClusterName, Namespace: ns, IncludeHealth: p.IncludeHealth,
			IncludeIstioResources: p.IncludeIstioResources, RateInterval: p.RateInterval, QueryTime: p.QueryTime,
		}

		if p.IncludeHealth {
			rateInterval, err := adjustRateInterval(r.Context(), businessLayer, ns, p.RateInterval, p.QueryTime, p.ClusterName)
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
		clusterWorkloadsList.Workloads = append(clusterWorkloadsList.Workloads, workloadList.Workloads...)
		clusterWorkloadsList.Validations = clusterWorkloadsList.Validations.MergeValidations(workloadList.Validations)
	}

	RespondWithJSON(w, http.StatusOK, clusterWorkloadsList)
}

// WorkloadDetails is the API handler to fetch all details to be displayed, related to a single workload
func WorkloadDetails(w http.ResponseWriter, r *http.Request) {
	p := workloadParams{}
	errParse := p.extract(r)
	if errParse != nil {
		RespondWithError(w, http.StatusInternalServerError, "Request parsing error: "+errParse.Error())
		return
	}

	criteria := business.WorkloadCriteria{
		Namespace: p.Namespace, WorkloadName: p.WorkloadName,
		WorkloadGVK: p.WorkloadGVK, IncludeIstioResources: true, IncludeServices: true, IncludeHealth: p.IncludeHealth, RateInterval: p.RateInterval,
		QueryTime: p.QueryTime, Cluster: p.ClusterName,
	}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Workloads initialization error: "+err.Error())
		return
	}

	includeValidations := false
	if p.IncludeIstioResources {
		includeValidations = true
	}

	istioConfigValidations := models.IstioValidations{}
	health := models.WorkloadHealth{}
	var errValidations error
	var errHealth error

	// Fetch and build workload
	workloadDetails, err := business.Workload.GetWorkload(r.Context(), criteria)

	wg := sync.WaitGroup{}
	if includeValidations {
		wg.Add(1)
		go func() {
			defer wg.Done()
			istioConfigValidations, errValidations = business.Validations.GetValidationsForWorkload(r.Context(), criteria.Cluster, criteria.Namespace, criteria.WorkloadName)
		}()
	}

	if criteria.IncludeHealth {
		wg.Add(1)
		go func() {
			defer wg.Done()
			health, errHealth = business.Health.GetWorkloadHealth(r.Context(), criteria.Namespace, criteria.Cluster, criteria.WorkloadName, criteria.RateInterval, criteria.QueryTime, workloadDetails)
		}()
	}

	wg.Wait()

	if includeValidations && err == nil {
		workloadDetails.Validations = istioConfigValidations
		err = errValidations
	}

	if criteria.IncludeHealth && err == nil {
		workloadDetails.Health = health
		err = errHealth
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

	patchType := query.Get("patchType")
	if patchType == "" {
		patchType = defaultPatchType
	}

	namespace := params["namespace"]
	workload := params["workload"]
	workloadGVK, errGVK := util.StringToGVK(query.Get("workloadGVK"))
	if errGVK != nil {
		RespondWithError(w, http.StatusBadRequest, "Update request with bad workloadGVK param: "+errGVK.Error())
	}

	cluster := clusterNameFromQuery(query)
	log.Debugf("Cluster: %s", cluster)

	includeValidations := false
	if _, found := query["validate"]; found {
		includeValidations = true
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
	}
	jsonPatch := string(body)

	istioConfigValidations := models.IstioValidations{}
	var errValidations error

	wg := sync.WaitGroup{}
	if includeValidations {
		wg.Add(1)
		go func() {
			defer wg.Done()
			istioConfigValidations, errValidations = business.Validations.GetValidationsForWorkload(r.Context(), cluster, namespace, workload)
		}()
	}

	workloadDetails, err := business.Workload.UpdateWorkload(r.Context(), cluster, namespace, workload, workloadGVK, true, jsonPatch, patchType)
	if includeValidations && err == nil {
		wg.Wait()
		workloadDetails.Validations = istioConfigValidations
		err = errValidations
	}
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
	auditMsg := fmt.Sprintf("UPDATE on Cluster: [%s] Namespace: [%s] Workload name: [%s] Type: [%s] Patch: [%s]", cluster, namespace, workload, workloadGVK, jsonPatch)
	audit(r, auditMsg)
	RespondWithJSON(w, http.StatusOK, workloadDetails)
}

// PodDetails is the API handler to fetch all details to be displayed, related to a single pod
func PodDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	query := r.URL.Query()

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Pods initialization error: "+err.Error())
		return
	}
	cluster := clusterNameFromQuery(query)
	namespace := vars["namespace"]
	pod := vars["pod"]

	// Fetch and build pod
	podDetails, err := business.Workload.GetPod(cluster, namespace, pod)
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
	cluster := clusterNameFromQuery(queryParams)
	namespace := vars["namespace"]
	pod := vars["pod"]

	// Get log options
	opts, err := business.Workload.BuildLogOptionsCriteria(
		queryParams.Get("container"),
		queryParams.Get("duration"),
		models.LogType(queryParams.Get("logType")),
		queryParams.Get("sinceTime"),
		queryParams.Get("maxLines"))
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	// Fetch pod logs
	err = business.Workload.StreamPodLogs(r.Context(), cluster, namespace, queryParams.Get("workload"), queryParams.Get("service"), pod, opts, w)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}
}

func ConfigDumpZtunnel(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	cluster := clusterNameFromQuery(r.URL.Query())
	namespace := params["namespace"]
	pod := params["pod"]

	dump := business.Workload.GetZtunnelConfig(cluster, namespace, pod)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, dump)
}
