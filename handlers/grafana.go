package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/util/httputil"
)

type dashboardSupplier func(string, string, *config.Auth) ([]byte, int, error)

// GetGrafanaInfo provides the Grafana URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in Istio installation namespace
func GetGrafanaInfo(w http.ResponseWriter, r *http.Request) {
	requestToken, err := getToken(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Token initialization error: "+err.Error())
		return
	}

	info, code, err := getGrafanaInfo(requestToken, findDashboard)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, info)
}

// getGrafanaInfo returns the Grafana URL and other info, the HTTP status code (int) and eventually an error
func getGrafanaInfo(requestToken string, dashboardSupplier dashboardSupplier) (*models.GrafanaInfo, int, error) {
	grafanaConfig := config.Get().ExternalServices.Grafana

	if !grafanaConfig.Enabled {
		return nil, http.StatusNoContent, nil
	}

	externalURL := status.DiscoverGrafana()
	if externalURL == "" {
		return nil, http.StatusServiceUnavailable, errors.New("grafana URL is not set in Kiali configuration")
	}

	// Check if URL is valid
	_, err := validateURL(externalURL)
	if err != nil {
		return nil, http.StatusServiceUnavailable, errors.New("wrong format for Grafana URL: " + err.Error())
	}

	apiURL := externalURL

	// Find the in-cluster URL to reach Grafana's REST API if properties demand so
	if grafanaConfig.InClusterURL != "" {
		apiURL = grafanaConfig.InClusterURL
	}

	// Be sure to copy config.Auth and not modify the existing
	auth := grafanaConfig.Auth
	if auth.UseKialiToken {
		auth.Token = requestToken
	}

	// Call Grafana REST API to get dashboard urls
	dashboards := []models.GrafanaDashboardInfo{}
	for _, dashboardConfig := range grafanaConfig.Dashboards {
		dashboardPath, err := getDashboardPath(apiURL, dashboardConfig.Name, &auth, dashboardSupplier)
		if err != nil {
			return nil, http.StatusServiceUnavailable, err
		}
		if dashboardPath != "" {
			dashboard := models.GrafanaDashboardInfo{
				URL:       externalURL + dashboardPath,
				Name:      dashboardConfig.Name,
				Variables: dashboardConfig.Variables,
			}
			dashboards = append(dashboards, dashboard)
		}
	}

	grafanaInfo := models.GrafanaInfo{
		Dashboards: dashboards,
	}

	return &grafanaInfo, http.StatusOK, nil
}

func getDashboardPath(basePath, name string, auth *config.Auth, dashboardSupplier dashboardSupplier) (string, error) {
	body, code, err := dashboardSupplier(basePath, url.PathEscape(name), auth)
	if err != nil {
		return "", err
	}
	if code != http.StatusOK {
		// Get error message
		var f map[string]string
		err = json.Unmarshal(body, &f)
		if err != nil {
			return "", fmt.Errorf("unknown error from Grafana (%d)", code)
		}
		message, ok := f["message"]
		if !ok {
			return "", fmt.Errorf("unknown error from Grafana (%d)", code)
		}
		return "", fmt.Errorf("error from Grafana (%d): %s", code, message)
	}

	// Status OK, read dashboards info
	var dashboards []map[string]interface{}
	err = json.Unmarshal(body, &dashboards)
	if err != nil {
		return "", err
	}
	if len(dashboards) == 0 {
		log.Warningf("No Grafana dashboard found for pattern '%s'", name)
		return "", nil
	}
	if len(dashboards) > 1 {
		log.Infof("Several Grafana dashboards found for pattern '%s', picking the first one", name)
	}
	dashPath, ok := dashboards[0]["url"]
	if !ok {
		log.Warningf("URL field not found in Grafana dashboard for search pattern '%s'", name)
		return "", nil
	}
	return dashPath.(string), nil
}

func findDashboard(url, searchPattern string, auth *config.Auth) ([]byte, int, error) {
	return httputil.HttpGet(url+"/api/search?query="+searchPattern, auth, time.Second*10)
}
