package handlers

import (
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
)

// serviceListParams holds the path and query parameters for ServiceList
//
// swagger:parameters serviceList
type serviceListParams struct {
	baseHealthParams
	// Optional
	IncludeHealth          bool `json:"health"`
	IncludeIstioResources  bool `json:"istioResources"`
	IncludeOnlyDefinitions bool `json:"onlyDefinitions"`
}

func (p *serviceListParams) extract(conf *config.Config, r *http.Request) {
	vars := mux.Vars(r)
	query := r.URL.Query()
	p.baseExtract(conf, r, vars)
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

// ClustersServices is the API handler to fetch the list of services from a given cluster
func ClustersServices(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		namespacesQueryParam := query.Get("namespaces") // csl of namespaces
		p := serviceListParams{}
		p.extract(conf, r)

		businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
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

		clusterServicesList := &models.ClusterServices{
			Cluster:     p.ClusterName,
			Services:    []models.ServiceOverview{},
			Validations: models.IstioValidations{},
		}

		for _, ns := range nss {
			criteria := business.ServiceCriteria{
				Cluster:                p.ClusterName,
				Namespace:              ns,
				IncludeHealth:          p.IncludeHealth,
				IncludeIstioResources:  p.IncludeIstioResources,
				IncludeOnlyDefinitions: p.IncludeOnlyDefinitions,
				RateInterval:           "",
				QueryTime:              p.QueryTime,
			}

			if criteria.IncludeHealth {
				rateInterval, err := adjustRateInterval(r.Context(), businessLayer, ns, p.RateInterval, p.QueryTime, p.ClusterName)
				if err != nil {
					handleErrorResponse(w, err, "Adjust rate interval error: "+err.Error())
					return
				}
				criteria.RateInterval = rateInterval
			}

			// Fetch and build services
			serviceList, err := businessLayer.Svc.GetServiceList(r.Context(), criteria)
			if err != nil {
				handleErrorResponse(w, err)
				return
			}
			clusterServicesList.Services = append(clusterServicesList.Services, serviceList.Services...)
			clusterServicesList.Validations = clusterServicesList.Validations.MergeValidations(serviceList.Validations)
		}

		RespondWithJSON(w, http.StatusOK, clusterServicesList)
	}
}

// ServiceDetails is the API handler to fetch full details of an specific service
func ServiceDetails(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
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
		cluster := clusterNameFromQuery(conf, queryParams)

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

		serviceDetails, err := business.Svc.GetServiceDetails(r.Context(), cluster, namespace, service, rateInterval, queryTime, includeValidations)
		if includeValidations && err == nil {
			wg.Wait()
			serviceDetails.Validations = istioConfigValidations.MergeValidations(serviceDetails.Validations)
			err = errValidations
		}

		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		RespondWithJSON(w, http.StatusOK, serviceDetails)
	}
}

func ServiceUpdate(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
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
		cluster := clusterNameFromQuery(conf, queryParams)

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

		audit(r, "UPDATE", namespace, "n/a", "Service Update. Name: ["+service+"], Patch: "+jsonPatch)
		RespondWithJSON(w, http.StatusOK, serviceDetails)
	}
}
