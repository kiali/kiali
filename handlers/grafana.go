package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"

	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

type osRouteSupplier func(string, string) (string, error)
type serviceSupplier func(string, string) (*v1.ServiceSpec, error)
type dashboardSupplier func(string, string) (string, error)

// GetGrafanaInfo provides the Grafana URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in namespace istio-system
func GetGrafanaInfo(w http.ResponseWriter, r *http.Request) {
	info, code, err := getGrafanaInfo(getService, findDashboardPath)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, info)
}

// getGrafanaInfo returns the Grafana URL and other info, the HTTP status code (int) and eventually an error
func getGrafanaInfo(serviceSupplier serviceSupplier, dashboardSupplier dashboardSupplier) (*models.GrafanaInfo, int, error) {
	grafanaConfig := config.Get().ExternalServices.Grafana

	// Check if URL is in the configuration
	if grafanaConfig.URL == "" {
		return nil, http.StatusNotFound, errors.New("You need to set the Grafana URL configuration.")
	}

	// Check if URL is valid
	_, error := validateURL(grafanaConfig.URL)
	if error != nil {
		return nil, http.StatusNotAcceptable, errors.New("You need to set a correct format for Grafana URL in the configuration error: " + error.Error())
	}

	if !grafanaConfig.DisplayLink {
		return nil, http.StatusNoContent, nil
	}

	// Find the in-cluster URL to reach Grafana's REST API
	spec, err := serviceSupplier(grafanaConfig.ServiceNamespace, grafanaConfig.Service)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(spec.Ports) == 0 {
		return nil, http.StatusInternalServerError, errors.New("No port found for Grafana service, cannot access in-cluster service")
	}
	if len(spec.Ports) > 1 {
		log.Warning("Several ports found for Grafana service, picking the first one")
	}
	internalURL := fmt.Sprintf("http://%s.%s:%d", grafanaConfig.Service, grafanaConfig.ServiceNamespace, spec.Ports[0].Port)

	// Call Grafana REST API to get dashboard urls
	serviceDashboardPath, err := dashboardSupplier(internalURL, grafanaConfig.ServiceDashboardPattern)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	workloadDashboardPath, err := dashboardSupplier(internalURL, grafanaConfig.WorkloadDashboardPattern)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	grafanaInfo := models.GrafanaInfo{
		URL:                   grafanaConfig.URL,
		ServiceDashboardPath:  serviceDashboardPath,
		WorkloadDashboardPath: workloadDashboardPath,
		VarNamespace:          grafanaConfig.VarNamespace,
		VarService:            grafanaConfig.VarService,
		VarWorkload:           grafanaConfig.VarWorkload,
	}

	return &grafanaInfo, http.StatusOK, nil
}

func findDashboardPath(url, searchPattern string) (string, error) {
	resp, err := http.Get(url + "/api/search?query=" + searchPattern)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var f interface{}
	err = json.Unmarshal(body, &f)
	if err != nil {
		return "", err
	}
	dashboards := f.([]interface{})
	if len(dashboards) == 0 {
		return "", fmt.Errorf("No Grafana dashboard found for pattern '%s'", searchPattern)
	}
	if len(dashboards) > 1 {
		log.Infof("Several Grafana dashboards found for pattern '%s', picking the first one", searchPattern)
	}
	dashPath := dashboards[0].(map[string]interface{})["url"]
	return dashPath.(string), nil
}
