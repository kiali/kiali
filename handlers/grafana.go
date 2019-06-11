package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/util/httputil"
)

type dashboardSupplier func(string, string, *config.Auth) ([]byte, int, error)

const (
	workloadDashboardPattern = "Istio%20Workload%20Dashboard"
	serviceDashboardPattern  = "Istio%20Service%20Dashboard"
)

// GetGrafanaInfo provides the Grafana URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in namespace istio-system
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

	if !grafanaConfig.DisplayLink {
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
	serviceDashboardPath, err := getDashboardPath(apiURL, serviceDashboardPattern, &auth, dashboardSupplier)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	workloadDashboardPath, err := getDashboardPath(apiURL, workloadDashboardPattern, &auth, dashboardSupplier)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	grafanaInfo := models.GrafanaInfo{
		URL:                   externalURL,
		ServiceDashboardPath:  serviceDashboardPath,
		WorkloadDashboardPath: workloadDashboardPath,
	}

	return &grafanaInfo, http.StatusOK, nil
}

func getDashboardPath(url, searchPattern string, auth *config.Auth, dashboardSupplier dashboardSupplier) (string, error) {
	body, code, err := dashboardSupplier(url, searchPattern, auth)
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
		return "", fmt.Errorf("no Grafana dashboard found for search pattern '%s'", searchPattern)
	}
	if len(dashboards) > 1 {
		log.Infof("Several Grafana dashboards found for pattern '%s', picking the first one", searchPattern)
	}
	dashPath, ok := dashboards[0]["url"]
	if !ok {
		return "", fmt.Errorf("URL field not found in Grafana dashboard for search pattern '%s'", searchPattern)
	}
	return dashPath.(string), nil
}

func findDashboard(url, searchPattern string, auth *config.Auth) ([]byte, int, error) {
	return httputil.HttpGet(url+"/api/search?query="+searchPattern, auth, time.Second*30)
}
