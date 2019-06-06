package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	core_v1 "k8s.io/api/core/v1"
	k8serr "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/util"
)

type serviceSupplier func(string, string, string) (*core_v1.ServiceSpec, error)
type dashboardSupplier func(string, string, string, bool) ([]byte, int, error)

const (
	workloadDashboardPattern = "Istio%20Workload%20Dashboard"
	serviceDashboardPattern  = "Istio%20Service%20Dashboard"
)

// GetGrafanaInfo provides the Grafana URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in namespace istio-system
func GetGrafanaInfo(w http.ResponseWriter, r *http.Request) {
	info, code, err := getGrafanaInfo(getService, findDashboard)
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
	if grafanaConfig.InCluster {
		saToken, err := kubernetes.GetKialiToken()
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}
		spec, err := serviceSupplier(saToken, grafanaConfig.Namespace, grafanaConfig.Service)
		if err != nil {
			if k8serr.IsNotFound(err) {
				return nil, http.StatusServiceUnavailable, err
			}
			return nil, http.StatusInternalServerError, err
		}
		if spec != nil && len(spec.Ports) == 0 {
			return nil, http.StatusServiceUnavailable, errors.New("no port found for Grafana service, cannot access in-cluster service")
		}
		if spec != nil && len(spec.Ports) > 1 {
			log.Warning("Several ports found for Grafana service, picking the first one")
		}
		if spec != nil {
			apiURL = fmt.Sprintf("http://%s.%s:%d", grafanaConfig.Service, grafanaConfig.Namespace, spec.Ports[0].Port)
		}
	}

	credentials, err := buildAuthHeader(grafanaConfig)
	if err != nil {
		log.Warning("Failed to build auth header token: " + err.Error())
	}

	// Call Grafana REST API to get dashboard urls
	serviceDashboardPath, err := getDashboardPath(apiURL, serviceDashboardPattern, credentials, grafanaConfig.InsecureSkipVerify, dashboardSupplier)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	workloadDashboardPath, err := getDashboardPath(apiURL, workloadDashboardPattern, credentials, grafanaConfig.InsecureSkipVerify, dashboardSupplier)
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

func getDashboardPath(url, searchPattern, credentials string, insecureSkipVerify bool, dashboardSupplier dashboardSupplier) (string, error) {
	body, code, err := dashboardSupplier(url, searchPattern, credentials, insecureSkipVerify)
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

func findDashboard(url, searchPattern, credentials string, insecureSkipVerify bool) ([]byte, int, error) {
	return util.HttpGet(url+"/api/search?query="+searchPattern, credentials, insecureSkipVerify, time.Second*30)
}

func buildAuthHeader(grafanaConfig config.GrafanaConfig) (string, error) {
	var credHeader string
	if grafanaConfig.APIKey != "" {
		credHeader = "Bearer " + grafanaConfig.APIKey
	} else if grafanaConfig.Username != "" {
		if grafanaConfig.Password == "" {
			return "", fmt.Errorf("grafana username set but no Grafana password provided")
		}
		basicAuth := base64.StdEncoding.EncodeToString([]byte(grafanaConfig.Username + ":" + grafanaConfig.Password))
		credHeader = "Basic " + basicAuth
	}
	return credHeader, nil
}
