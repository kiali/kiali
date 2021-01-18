package business

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/monitoringdashboards/v1alpha1"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/util/httputil"
)

type dashboardSupplier func(string, string, *config.Auth) ([]byte, int, error)

var GrafanaDashboardSupplier = findDashboard

// GetGrafanaInfo returns the Grafana URL and other info, the HTTP status code (int) and eventually an error
func GetGrafanaInfo(authInfo *api.AuthInfo, dashboardSupplier dashboardSupplier) (*models.GrafanaInfo, int, error) {
	grafanaConfig := config.Get().ExternalServices.Grafana
	if !grafanaConfig.Enabled {
		return nil, http.StatusNoContent, nil
	}
	conn, code, err := getGrafanaConnectionInfo(authInfo, &grafanaConfig)
	if err != nil {
		return nil, code, err
	}

	// Call Grafana REST API to get dashboard urls
	links := []models.ExternalLink{}
	for _, dashboardConfig := range grafanaConfig.Dashboards {
		dashboardPath, err := getDashboardPath(dashboardConfig.Name, conn, dashboardSupplier)
		if err != nil {
			return nil, http.StatusServiceUnavailable, err
		}
		if dashboardPath != "" {
			externalLink := models.ExternalLink{
				URL:  dashboardPath,
				Name: dashboardConfig.Name,
				Variables: v1alpha1.MonitoringDashboardExternalLinkVariables{
					App:       dashboardConfig.Variables.App,
					Namespace: dashboardConfig.Variables.Namespace,
					Service:   dashboardConfig.Variables.Service,
					Version:   dashboardConfig.Variables.Version,
					Workload:  dashboardConfig.Variables.Workload,
				},
			}
			links = append(links, externalLink)
		}
	}

	grafanaInfo := models.GrafanaInfo{
		ExternalLinks: links,
	}

	return &grafanaInfo, http.StatusOK, nil
}

// GetGrafanaLinks returns the links to Grafana dashboards and other info, the HTTP status code (int) and eventually an error
func GetGrafanaLinks(authInfo *api.AuthInfo, linksSpec []v1alpha1.MonitoringDashboardExternalLink) ([]models.ExternalLink, int, error) {
	grafanaConfig := config.Get().ExternalServices.Grafana
	if !grafanaConfig.Enabled {
		return nil, 0, nil
	}

	connectionInfo, code, err := getGrafanaConnectionInfo(authInfo, &grafanaConfig)
	if err != nil {
		return nil, code, err
	}
	if connectionInfo.baseExternalURL == "" {
		log.Tracef("Skip checking Grafana links as Grafana is not configured")
		return nil, 0, nil
	}
	return getGrafanaLinks(connectionInfo, linksSpec, GrafanaDashboardSupplier)
}

func getGrafanaLinks(conn grafanaConnectionInfo, linksSpec []v1alpha1.MonitoringDashboardExternalLink, dashboardSupplier dashboardSupplier) ([]models.ExternalLink, int, error) {
	// Call Grafana REST API to get dashboard urls
	linksOut := []models.ExternalLink{}
	for _, linkSpec := range linksSpec {
		if linkSpec.Type == "grafana" {
			dashboardPath, err := getDashboardPath(linkSpec.Name, conn, dashboardSupplier)
			if err != nil {
				return nil, http.StatusServiceUnavailable, err
			}
			if dashboardPath != "" {
				linkOut := models.ExternalLink{
					URL:       dashboardPath,
					Name:      linkSpec.Name,
					Variables: linkSpec.Variables,
				}
				linksOut = append(linksOut, linkOut)
			}
		}
	}

	return linksOut, http.StatusOK, nil
}

type grafanaConnectionInfo struct {
	baseExternalURL   string
	externalURLParams string
	inClusterURL      string
	auth              *config.Auth
}

func getGrafanaConnectionInfo(authInfo *api.AuthInfo, cfg *config.GrafanaConfig) (grafanaConnectionInfo, int, error) {
	externalURL := status.DiscoverGrafana()
	if externalURL == "" {
		return grafanaConnectionInfo{}, http.StatusServiceUnavailable, errors.New("grafana URL is not set in Kiali configuration")
	}

	// Check if URL is valid
	_, err := url.ParseRequestURI(externalURL)
	if err != nil {
		return grafanaConnectionInfo{}, http.StatusServiceUnavailable, errors.New("wrong format for Grafana URL: " + err.Error())
	}

	apiURL := externalURL

	// Find the in-cluster URL to reach Grafana's REST API if properties demand so
	if cfg.InClusterURL != "" {
		apiURL = cfg.InClusterURL
	}

	urlParts := strings.Split(externalURL, "?")
	externalURLParams := ""
	// E.g.: http://localhost:3000?orgId=1 transformed into http://localhost:3000/d/LJ_uJAvmk/istio-service-dashboard?orgId=1
	externalURL = urlParts[0]
	if len(urlParts) > 1 {
		externalURLParams = "?" + urlParts[1]
	}

	return grafanaConnectionInfo{
		baseExternalURL:   externalURL,
		externalURLParams: externalURLParams,
		inClusterURL:      apiURL,
		auth:              &cfg.Auth,
	}, 0, nil
}

func getDashboardPath(name string, conn grafanaConnectionInfo, dashboardSupplier dashboardSupplier) (string, error) {
	body, code, err := dashboardSupplier(conn.inClusterURL, url.PathEscape(name), conn.auth)
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

	fullPath := dashPath.(string)
	if fullPath != "" {
		// Dashboard path might be an absolute URL (hence starting with cfg.URL) or a relative one, depending on grafana's "GF_SERVER_SERVE_FROM_SUB_PATH"
		if !strings.HasPrefix(fullPath, conn.baseExternalURL) {
			fullPath = strings.TrimSuffix(conn.baseExternalURL, "/") + "/" + strings.TrimPrefix(fullPath, "/")
		}
	}

	return fullPath + conn.externalURLParams, nil
}

func findDashboard(url, searchPattern string, auth *config.Auth) ([]byte, int, error) {
	urlParts := strings.Split(url, "?")
	query := strings.TrimSuffix(urlParts[0], "/") + "/api/search?query=" + searchPattern
	if len(urlParts) > 1 {
		query = query + "&" + urlParts[1]
	}
	return httputil.HttpGet(query, auth, time.Second*10)
}
