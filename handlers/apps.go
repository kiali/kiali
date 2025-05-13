package handlers

import (
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// appParams holds the path and query parameters for appList and appDetails
//
// swagger:parameters appList AppDetails
type appParams struct {
	baseHealthParams
	// The target workload
	//
	// in: path
	Namespace   string `json:"namespace"`
	ClusterName string `json:"clusterName"`
	AppName     string `json:"app"`
	// Optional
	IncludeHealth         bool `json:"health"`
	IncludeIstioResources bool `json:"istioResources"`
}

func (p *appParams) extract(r *http.Request) {
	vars := mux.Vars(r)
	query := r.URL.Query()
	p.baseExtract(r, vars)
	p.Namespace = vars["namespace"]
	p.ClusterName = clusterNameFromQuery(config.Get(), query)
	p.AppName = vars["app"]
	var err error
	p.IncludeHealth, err = strconv.ParseBool(query.Get("health"))
	if err != nil {
		p.IncludeHealth = true
	}
	p.IncludeIstioResources, err = strconv.ParseBool(query.Get("istioResources"))
	if err != nil {
		p.IncludeIstioResources = true
	}
}

// ClusterApps is the API handler to fetch all the apps to be displayed, related to a single cluster
func ClusterApps(
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
		log.FromRequest(r).Debug().Msg("Fetching all apps in single cluster")
		query := r.URL.Query()
		namespacesQueryParam := query.Get("namespaces") // csl of namespaces
		p := appParams{}
		p.extract(r)

		businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Apps initialization error: "+err.Error())
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

		clusterAppsList := &models.ClusterApps{
			Apps:    []models.AppListItem{},
			Cluster: p.ClusterName,
		}

		for _, ns := range nss {
			criteria := business.AppCriteria{
				Cluster: p.ClusterName, Namespace: ns, IncludeIstioResources: p.IncludeIstioResources,
				IncludeHealth: p.IncludeHealth, RateInterval: p.RateInterval, QueryTime: p.QueryTime,
			}

			if p.IncludeHealth {
				rateInterval, err := adjustRateInterval(r.Context(), businessLayer, ns, p.RateInterval, p.QueryTime, p.ClusterName)
				if err != nil {
					handleErrorResponse(w, err, "Adjust rate interval error: "+err.Error())
					return
				}
				criteria.RateInterval = rateInterval
			}

			// Fetch and build apps
			appList, err := businessLayer.App.GetClusterAppList(r.Context(), criteria)
			if err != nil {
				handleErrorResponse(w, err)
				return
			}
			clusterAppsList.Apps = append(clusterAppsList.Apps, appList.Apps...)
		}

		RespondWithJSON(w, http.StatusOK, clusterAppsList)
	}
}

// AppDetails is the API handler to fetch all details to be displayed, related to a single app
func AppDetails(
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
		p := appParams{}
		p.extract(r)

		criteria := business.AppCriteria{
			Namespace: p.Namespace, AppName: p.AppName, IncludeIstioResources: true, IncludeHealth: p.IncludeHealth,
			RateInterval: p.RateInterval, QueryTime: p.QueryTime, Cluster: p.ClusterName,
		}

		// Get business layer
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		// Fetch and build app
		appDetails, err := business.App.GetAppDetails(r.Context(), criteria)
		if err != nil {
			handleErrorResponse(w, err)
			return
		}

		RespondWithJSON(w, http.StatusOK, appDetails)
	}
}
