package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

// serviceListParams holds the path and query parameters for ServiceList
//
// swagger:parameters serviceList
type serviceListParams struct {
	baseHealthParams
	// The target workload
	//
	// in: path
	Namespace string `json:"namespace"`
	// Optional
	IncludeHealth          bool `json:"health"`
	IncludeIstioResources  bool `json:"istioResources"`
	IncludeOnlyDefinitions bool `json:"onlyDefinitions"`
}

func (p *serviceListParams) extract(r *http.Request) {
	vars := mux.Vars(r)
	query := r.URL.Query()
	p.baseExtract(r, vars)
	p.Namespace = vars["namespace"]
	var err error
	p.IncludeHealth, err = strconv.ParseBool(query.Get("health"))
	if err != nil {
		p.IncludeHealth = true
	}
	p.IncludeIstioResources, err = strconv.ParseBool(query.Get("istioResources"))
	if err != nil {
		p.IncludeIstioResources = true
	}
	p.IncludeOnlyDefinitions, err = strconv.ParseBool(query.Get("onlyDefinitions"))
	if err != nil {
		p.IncludeOnlyDefinitions = true
	}
}

// ServiceList is the API handler to fetch the list of services in a given namespace
func ServiceList(w http.ResponseWriter, r *http.Request) {
	p := serviceListParams{}
	p.extract(r)

	criteria := business.ServiceCriteria{
		// Purposefully leaving cluster out of Criteria because the frontend doesn't
		// yet send the cluster param and the business service will iterate over all
		// clusters if a cluster criteria is not provided which is what we want.
		Namespace:              p.Namespace,
		IncludeHealth:          p.IncludeHealth,
		IncludeIstioResources:  p.IncludeIstioResources,
		IncludeOnlyDefinitions: p.IncludeOnlyDefinitions,
		RateInterval:           "",
		QueryTime:              p.QueryTime,
	}

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	if criteria.IncludeHealth {
		// When the cluster is not specified, we need to get it. If there are more than one,
		// get the one for which the namespace creation time is oldest
		namespaces, _ := business.Namespace.GetNamespaceClusters(r.Context(), p.Namespace)
		if len(namespaces) == 0 {
			err = fmt.Errorf("No clusters found for namespace  [%s]", p.Namespace)
			handleErrorResponse(w, err, "Error looking for cluster: "+err.Error())
			return
		}
		ns := GetOldestNamespace(namespaces)
		rateInterval, err := adjustRateInterval(r.Context(), business, p.Namespace, p.RateInterval, p.QueryTime, ns.Cluster)
		if err != nil {
			handleErrorResponse(w, err, "Adjust rate interval error: "+err.Error())
			return
		}
		criteria.RateInterval = rateInterval
	}

	// Fetch and build services
	serviceList, err := business.Svc.GetServiceList(r.Context(), criteria)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, serviceList)
}

// ServiceDetails is the API handler to fetch full details of an specific service
func ServiceDetails(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	// Rate interval is needed to fetch request rates based health
	queryParams := r.URL.Query()
	rateInterval := queryParams.Get("rateInterval")
	if rateInterval == "" {
		rateInterval = defaultHealthRateInterval
	}

	includeValidations := false
	if _, found := queryParams["validate"]; found {
		includeValidations = true
	}

	params := mux.Vars(r)
	cluster := clusterNameFromQuery(queryParams)

	namespace := params["namespace"]
	service := params["service"]
	queryTime := util.Clock.Now()
	rateInterval, err = adjustRateInterval(r.Context(), business, namespace, rateInterval, queryTime, cluster)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	istioConfigValidations := models.IstioValidations{}
	var errValidations error

	wg := sync.WaitGroup{}
	if includeValidations {
		wg.Add(1)
		go func() {
			defer wg.Done()
			istioConfigValidations, errValidations = business.Validations.GetValidationsForService(r.Context(), cluster, namespace, service)
		}()
	}

	serviceDetails, err := business.Svc.GetServiceDetails(r.Context(), cluster, namespace, service, rateInterval, queryTime)
	if includeValidations && err == nil {
		wg.Wait()
		serviceDetails.Validations = istioConfigValidations
		err = errValidations
	}

	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, serviceDetails)
}

func ServiceUpdate(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	// Rate interval is needed to fetch request rates based health
	queryParams := r.URL.Query()
	rateInterval := queryParams.Get("rateInterval")
	if rateInterval == "" {
		rateInterval = defaultHealthRateInterval
	}

	patchType := queryParams.Get("patchType")
	if patchType == "" {
		patchType = defaultPatchType
	}
	includeValidations := false
	if _, found := queryParams["validate"]; found {
		includeValidations = true
	}

	params := mux.Vars(r)
	cluster := clusterNameFromQuery(queryParams)

	namespace := params["namespace"]
	service := params["service"]
	queryTime := util.Clock.Now()
	rateInterval, err = adjustRateInterval(r.Context(), business, namespace, rateInterval, queryTime, cluster)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Adjust rate interval error: "+err.Error())
		return
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
			istioConfigValidations, errValidations = business.Validations.GetValidationsForService(r.Context(), cluster, namespace, service)
		}()
	}

	serviceDetails, err := business.Svc.UpdateService(r.Context(), cluster, namespace, service, rateInterval, queryTime, jsonPatch, patchType)

	if includeValidations && err == nil {
		wg.Wait()
		serviceDetails.Validations = istioConfigValidations
		err = errValidations
	}

	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	audit(r, "UPDATE on Namespace: "+namespace+" Service name: "+service+" Patch: "+jsonPatch)
	RespondWithJSON(w, http.StatusOK, serviceDetails)
}
