package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	khttp "github.com/kiali/k-charted/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/models"
)

// AppList is the API handler to fetch all the apps to be displayed, related to a single namespace
func AppList(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Apps initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]

	// Fetch and build apps
	appList, err := business.App.GetAppList(namespace)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, appList)
}

// AppDetails is the API handler to fetch all details to be displayed, related to a single app
func AppDetails(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	// Get business layer
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	namespace := params["namespace"]
	app := params["app"]

	// Fetch and build app
	appDetails, err := business.App.GetApp(namespace, app)
	if err != nil {
		handleErrorResponse(w, err)
		return
	}

	RespondWithJSON(w, http.StatusOK, appDetails)
}

// CustomDashboard is the API handler to fetch runtime metrics to be displayed, related to a single app
func CustomDashboard(w http.ResponseWriter, r *http.Request) {
	cfg, log, enabled := business.DashboardsConfig()
	if !enabled {
		RespondWithError(w, http.StatusServiceUnavailable, "Custom dashboards are disabled in config")
		return
	}
	khttp.DashboardHandler(r.URL.Query(), mux.Vars(r), w, cfg, log)
}

// AppDashboard is the API handler to fetch Istio dashboard, related to a single app
func AppDashboard(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	app := vars["app"]

	metricsService, namespaceInfo := createMetricsServiceForNamespace(w, r, defaultPromClientSupplier, namespace)
	if metricsService == nil {
		// any returned value nil means error & response already written
		return
	}

	params := models.IstioMetricsQuery{Namespace: namespace, App: app}
	err := extractIstioMetricsQueryParams(r, &params, namespaceInfo)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	metrics := metricsService.GetMetrics(params)
	dashboard, err := business.NewDashboardsService().BuildIstioDashboard(metrics, params.Direction)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, dashboard)
}
