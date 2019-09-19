package business

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/kiali/k-charted/config/extconfig"
	"github.com/kiali/k-charted/httputil"
	"github.com/kiali/k-charted/kubernetes/v1alpha1"
	"github.com/kiali/k-charted/log"
	"github.com/kiali/k-charted/model"
)

type dashboardSupplier func(string, string, *extconfig.Auth) ([]byte, int, error)

// GetGrafanaLinks returns the links to Grafana dashboards and other info, the HTTP status code (int) and eventually an error
func GetGrafanaLinks(logger log.SafeAdapter, cfg extconfig.GrafanaConfig, linksSpec []v1alpha1.MonitoringDashboardExternalLink) ([]model.ExternalLink, int, error) {
	if cfg.URL == "" {
		logger.Tracef("Skip checking Grafana links as Grafana is not configured")
		return nil, 0, nil
	}
	return getGrafanaLinks(logger, cfg, linksSpec, findDashboard)
}

func getGrafanaLinks(logger log.SafeAdapter, cfg extconfig.GrafanaConfig, linksSpec []v1alpha1.MonitoringDashboardExternalLink, dashboardSupplier dashboardSupplier) ([]model.ExternalLink, int, error) {
	apiURL := cfg.URL

	// Find the in-cluster URL to reach Grafana's REST API if properties demand so
	if cfg.InClusterURL != "" {
		apiURL = cfg.InClusterURL
	}

	// Call Grafana REST API to get dashboard urls
	linksOut := []model.ExternalLink{}
	for _, linkSpec := range linksSpec {
		if linkSpec.Type == "grafana" {
			dashboardPath, err := getDashboardPath(logger, apiURL, linkSpec.Name, &cfg.Auth, dashboardSupplier)
			if err != nil {
				return nil, http.StatusServiceUnavailable, err
			}
			if dashboardPath != "" {
				linkOut := model.ExternalLink{
					URL:       cfg.URL + dashboardPath,
					Name:      linkSpec.Name,
					Variables: linkSpec.Variables,
				}
				linksOut = append(linksOut, linkOut)
			}
		}
	}

	return linksOut, http.StatusOK, nil
}

func getDashboardPath(logger log.SafeAdapter, basePath, name string, auth *extconfig.Auth, dashboardSupplier dashboardSupplier) (string, error) {
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
		logger.Warningf("No Grafana dashboard found for pattern '%s'", name)
		return "", nil
	}
	if len(dashboards) > 1 {
		logger.Infof("Several Grafana dashboards found for pattern '%s', picking the first one", name)
	}
	dashPath, ok := dashboards[0]["url"]
	if !ok {
		logger.Warningf("URL field not found in Grafana dashboard for search pattern '%s'", name)
		return "", nil
	}
	return dashPath.(string), nil
}

func findDashboard(url, searchPattern string, auth *extconfig.Auth) ([]byte, int, error) {
	return httputil.HttpGet(url+"/api/search?query="+searchPattern, auth, time.Second*10)
}
