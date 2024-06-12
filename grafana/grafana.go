package grafana

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/config/dashboards"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

// Service provides discovery and info about Grafana.
type Service struct {
	conf                *config.Config
	homeClusterSAClient kubernetes.ClientInterface
	routeLock           sync.RWMutex
	routeURL            *string
}

// NewService creates a new Grafana service.
func NewService(conf *config.Config, homeClusterSAClient kubernetes.ClientInterface) *Service {
	s := &Service{
		conf:                conf,
		homeClusterSAClient: homeClusterSAClient,
	}

	routeURL := s.discover(context.TODO())
	if routeURL != "" {
		s.routeURL = &routeURL
	}

	return s
}

func (s *Service) URL(ctx context.Context) string {
	grafanaConf := s.conf.ExternalServices.Grafana

	// If Grafana is disabled in the configuration return an empty string and avoid discovery
	if !grafanaConf.Enabled {
		return ""
	}
	if grafanaConf.URL != "" || grafanaConf.InClusterURL == "" {
		return grafanaConf.URL
	}
	s.routeLock.RLock()
	if s.routeURL != nil {
		defer s.routeLock.RUnlock()
		return *s.routeURL
	}
	s.routeLock.RUnlock()
	return s.discover(ctx)
}

// DiscoverGrafana will return the Grafana URL if it has been configured,
// or will try to retrieve it if an OpenShift Route is defined.
func (s *Service) discover(ctx context.Context) string {
	s.routeLock.Lock()
	defer s.routeLock.Unlock()
	// Try to get service and namespace from in-cluster URL, to discover route
	routeURL := ""
	if inClusterURL := s.conf.ExternalServices.Grafana.InClusterURL; inClusterURL != "" {
		parsedURL, err := url.Parse(inClusterURL)
		if err == nil {
			parts := strings.Split(parsedURL.Hostname(), ".")
			if len(parts) >= 2 {
				routeURL, err = s.discoverServiceURL(ctx, parts[1], parts[0])
				if err != nil {
					log.Debugf("[GRAFANA] URL discovery failed: %v", err)
				}
				s.routeURL = &routeURL
			}
		}
	}
	return routeURL
}

func (s *Service) discoverServiceURL(ctx context.Context, ns, service string) (url string, err error) {
	log.Debugf("[%s] URL discovery for service '%s', namespace '%s'...", strings.ToUpper(service), service, ns)
	url = ""
	// If the client is not openshift return and avoid discover
	if !s.homeClusterSAClient.IsOpenShift() {
		log.Debugf("[%s] Client is not Openshift, discovery url is only supported in Openshift", strings.ToUpper(service))
		return
	}

	// Assuming service name == route name
	route, err := s.homeClusterSAClient.GetRoute(ctx, ns, service)
	if err != nil {
		log.Debugf("[%s] Discovery failed: %v", strings.ToUpper(service), err)
		return
	}

	host := route.Spec.Host
	if route.Spec.TLS != nil {
		url = "https://" + host
	} else {
		url = "http://" + host
	}
	log.Infof("[%s] URL discovered for %s: %s", strings.ToUpper(service), service, url)
	return
}

type DashboardSupplierFunc func(string, string, *config.Auth) ([]byte, int, error)

var DashboardSupplier = findDashboard

// GetGrafanaInfo returns the Grafana URL and other info, the HTTP status code (int) and eventually an error
func (s *Service) Info(ctx context.Context, dashboardSupplier DashboardSupplierFunc) (*models.GrafanaInfo, int, error) {
	grafanaConfig := s.conf.ExternalServices.Grafana
	if !grafanaConfig.Enabled {
		return nil, http.StatusNoContent, nil
	}

	conn, code, err := s.getGrafanaConnectionInfo(ctx)
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
				Variables: dashboards.MonitoringDashboardExternalLinkVariables{
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
func (s *Service) Links(ctx context.Context, linksSpec []dashboards.MonitoringDashboardExternalLink) ([]models.ExternalLink, int, error) {
	grafanaConfig := s.conf.ExternalServices.Grafana
	if !grafanaConfig.Enabled {
		return nil, 0, nil
	}

	connectionInfo, code, err := s.getGrafanaConnectionInfo(ctx)
	if err != nil {
		return nil, code, err
	}
	if connectionInfo.baseExternalURL == "" {
		log.Tracef("Skip checking Grafana links as Grafana is not configured")
		return nil, 0, nil
	}
	return getGrafanaLinks(connectionInfo, linksSpec, DashboardSupplier)
}

func getGrafanaLinks(conn grafanaConnectionInfo, linksSpec []dashboards.MonitoringDashboardExternalLink, dashboardSupplier DashboardSupplierFunc) ([]models.ExternalLink, int, error) {
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

func (s *Service) getGrafanaConnectionInfo(ctx context.Context) (grafanaConnectionInfo, int, error) {
	externalURL := s.URL(ctx)
	if externalURL == "" {
		return grafanaConnectionInfo{}, http.StatusServiceUnavailable, errors.New("grafana URL is not set in Kiali configuration")
	}
	cfg := s.conf.ExternalServices.Grafana

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

func getDashboardPath(name string, conn grafanaConnectionInfo, dashboardSupplier DashboardSupplierFunc) (string, error) {
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
	resp, code, _, err := httputil.HttpGet(query, auth, time.Second*10, nil, nil)
	return resp, code, err
}
