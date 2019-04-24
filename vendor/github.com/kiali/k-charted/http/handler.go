package http

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/k-charted/business"
	"github.com/kiali/k-charted/config"
	"github.com/kiali/k-charted/model"
)

// DashboardHandler is the API handler to fetch runtime metrics to be displayed.
// It expects "namespace" and "dashboard" to be provided as path params. Label filters can be provided as query params
// (see also: ExtractDashboardQueryParams)
func DashboardHandler(queryParams url.Values, pathParams map[string]string, w http.ResponseWriter, conf config.Config) {
	namespace := pathParams["namespace"]
	dashboardName := pathParams["dashboard"]

	svc := business.NewDashboardsService(conf)

	params := model.DashboardQuery{Namespace: namespace}
	err := ExtractDashboardQueryParams(queryParams, &params)
	if err != nil {
		respondWithError(conf, w, http.StatusBadRequest, err.Error())
		return
	}

	dashboard, err := svc.GetDashboard(params, dashboardName)
	if err != nil {
		if errors.IsNotFound(err) {
			respondWithError(conf, w, http.StatusNotFound, err.Error())
		} else {
			respondWithError(conf, w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	respondWithJSON(conf, w, http.StatusOK, dashboard)
}

// SearchDashboardsHandler is the API handler to search for all available dashboards on pods
// It expects "namespace" to be provided as path param. Label filters can be provided as query params
// (see also: ExtractDashboardQueryParams)
func SearchDashboardsHandler(queryParams url.Values, pathParams map[string]string, w http.ResponseWriter, conf config.Config) {
	namespace := pathParams["namespace"]
	labels := queryParams.Get("labelsFilters")

	var runtimes []model.Runtime
	svc := business.NewDashboardsService(conf)
	if conf.PodsLoader != nil {
		pods, err := conf.PodsLoader(namespace, strings.Replace(labels, ":", "=", -1))
		if err != nil {
			if errors.IsNotFound(err) {
				respondWithError(conf, w, http.StatusNotFound, err.Error())
			} else {
				respondWithError(conf, w, http.StatusInternalServerError, err.Error())
			}
			return
		}
		runtimes = svc.SearchExplicitDashboards(namespace, pods)
	}

	if len(runtimes) == 0 {
		labelsMap := extractLabelsFilters(labels)
		runtimes = svc.DiscoverDashboards(namespace, labelsMap)
	}

	respondWithJSON(conf, w, http.StatusOK, runtimes)
}

func respondWithJSON(conf config.Config, w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		response, _ = json.Marshal(map[string]string{"error": err.Error()})
		code = http.StatusInternalServerError
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, err = w.Write(response)
	if err != nil && conf.Errorf != nil {
		conf.Errorf("could not write response: %v", err)
	}
}

func respondWithError(conf config.Config, w http.ResponseWriter, code int, message string) {
	respondWithJSON(conf, w, code, map[string]string{"error": message})
}
