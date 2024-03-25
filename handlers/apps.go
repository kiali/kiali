package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"golang.org/x/exp/slices"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/models"
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
	p.ClusterName = clusterNameFromQuery(query)
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

// ClustersApps is the API handler to fetch all the apps to be displayed, related to a single cluster
func ClustersApps(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	namespaces := query.Get("namespaces") // csl of namespaces
	p := appParams{}
	p.extract(r)

	// Get business layer
	businessLayer, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Apps initialization error: "+err.Error())
		return
	}

	nss := []string{}
	namespaceQueryParams := strings.Split(namespaces, ",")
	loadedNamespaces, _ := businessLayer.Namespace.GetClusterNamespaces(r.Context(), p.ClusterName)
	for _, ns := range loadedNamespaces {
		if len(namespaces) > 0 {
			if slices.Contains(namespaceQueryParams, ns.Name) {
				nss = append(nss, ns.Name)
			}
		} else {
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

// AppDetails is the API handler to fetch all details to be displayed, related to a single app
func AppDetails(w http.ResponseWriter, r *http.Request) {
	p := appParams{}
	p.extract(r)

	criteria := business.AppCriteria{
		Namespace: p.Namespace, AppName: p.AppName, IncludeIstioResources: true, IncludeHealth: p.IncludeHealth,
		RateInterval: p.RateInterval, QueryTime: p.QueryTime, Cluster: p.ClusterName,
	}

	// Get business layer
	business, err := getBusiness(r)
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
