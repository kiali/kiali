package business

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/monitoringdashboards/v1alpha1"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

type dashboardSupplier func(string, string, *config.Auth) ([]byte, int, error)

// GetGrafanaLinks returns the links to Grafana dashboards and other info, the HTTP status code (int) and eventually an error
func GetGrafanaLinks(linksSpec []v1alpha1.MonitoringDashboardExternalLink) ([]models.ExternalLink, int, error) {
	cfg := config.Get().ExternalServices.Grafana
	if !cfg.Enabled || cfg.URL == "" {
		log.Tracef("Skip checking Grafana links as Grafana is not configured")
		return nil, 0, nil
	}
	return getGrafanaLinks(cfg, linksSpec, findDashboard)
}

func getGrafanaLinks(cfg config.GrafanaConfig, linksSpec []v1alpha1.MonitoringDashboardExternalLink, dashboardSupplier dashboardSupplier) ([]models.ExternalLink, int, error) {
	apiURL := cfg.URL

	// Find the in-cluster URL to reach Grafana's REST API if properties demand so
	if cfg.InClusterURL != "" {
		apiURL = cfg.InClusterURL
	}

	// Call Grafana REST API to get dashboard urls
	linksOut := []models.ExternalLink{}
	for _, linkSpec := range linksSpec {
		if linkSpec.Type == "grafana" {
			dashboardPath, err := getDashboardPath(apiURL, linkSpec.Name, &cfg.Auth, dashboardSupplier)
			if err != nil {
				return nil, http.StatusServiceUnavailable, err
			}
			if dashboardPath != "" {
				linkOut := models.ExternalLink{
					URL:       strings.TrimSuffix(cfg.URL, "/") + "/" + strings.TrimPrefix(dashboardPath, "/"),
					Name:      linkSpec.Name,
					Variables: linkSpec.Variables,
				}
				linksOut = append(linksOut, linkOut)
			}
		}
	}

	return linksOut, http.StatusOK, nil
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
	return httputil.HttpGet(strings.TrimSuffix(url, "/")+"/api/search?query="+searchPattern, auth, time.Second*10)
}
