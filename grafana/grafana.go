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
	if grafanaConf.ExternalURL != "" || grafanaConf.InternalURL == "" {
		return grafanaConf.ExternalURL
	}
	s.routeLock.RLock()
	if s.routeURL != nil {
		defer s.routeLock.RUnlock()
		return *s.routeURL
	}
	s.routeLock.RUnlock()
	return s.discover(ctx)
}

// discover will return the Grafana URL if it has been configured,
// or will try to retrieve it if an OpenShift Route is defined.
func (s *Service) discover(ctx context.Context) string {
	s.routeLock.Lock()
	defer s.routeLock.Unlock()
	// Try to get service and namespace from in-cluster URL, to discover route
	routeURL := ""
	if internalURL := s.conf.ExternalServices.Grafana.InternalURL; internalURL != "" {
		parsedURL, err := url.Parse(internalURL)
		if err == nil {
			parts := strings.Split(parsedURL.Hostname(), ".")
			if len(parts) >= 2 {
				routeURL, err = s.discoverServiceURL(ctx, parts[1], parts[0])
				if err != nil {
					log.FromContext(ctx).Debug().Msgf("URL discovery failed: %v", err)
				}
				s.routeURL = &routeURL
			}
		}
	}
	return routeURL
}

func (s *Service) discoverServiceURL(ctx context.Context, ns, service string) (url string, err error) {
	zl := log.FromContext(ctx)
	zl.Debug().Msgf("URL discovery for service [%s], namespace '%s'...", service, ns)
	url = ""
	// If the client is not openshift return and avoid discover
	if !s.homeClusterSAClient.IsOpenShift() {
		zl.Debug().Msgf("Client for service [%s] is not Openshift, discovery url is only supported in Openshift", service)
		return
	}

	// Assuming service name == route name
	route, err := s.homeClusterSAClient.GetRoute(ctx, ns, service)
	if err != nil {
		zl.Debug().Msgf("Discovery for service [%s] failed: %v", service, err)
		return
	}

	host := route.Spec.Host
	if route.Spec.TLS != nil {
		url = "https://" + host
	} else {
		url = "http://" + host
	}
	zl.Info().Msgf("URL discovered for service [%s]: %s", service, url)
	return
}

type DashboardSupplierFunc func(string, string, *config.Auth) ([]byte, int, error)

var DashboardSupplier = findDashboard

// Info returns the Grafana URL and other info, the HTTP status code (int) and eventually an error
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
		dashboardPath, err := getDashboardPath(ctx, dashboardConfig.Name, conn, dashboardSupplier)
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

// Links returns the links to Grafana dashboards and other info, the HTTP status code (int) and eventually an error
func (s *Service) Links(ctx context.Context, linksSpec []dashboards.MonitoringDashboardExternalLink) ([]models.ExternalLink, int, error) {
	grafanaConfig := s.conf.ExternalServices.Grafana
	if !grafanaConfig.Enabled {
		return nil, 0, nil
	}

	connectionInfo, code, err := s.getGrafanaConnectionInfo(ctx)
	if err != nil {
		return nil, code, err
	}

	zl := log.FromContext(ctx)

	if connectionInfo.baseExternalURL == "" {
		zl.Trace().Msgf("Skip checking Grafana links as Grafana is not configured")
		return nil, 0, nil
	}
	return getGrafanaLinks(ctx, connectionInfo, linksSpec, DashboardSupplier)
}

// VersionURL returns the Grafana URL that can be used to obtain the Grafana build information that includes its version.
// This returns an empty string if the version will not be able to be obtained for some reason.
func (s *Service) VersionURL(ctx context.Context) string {
	grafanaConfig := s.conf.ExternalServices.Grafana
	if !grafanaConfig.Enabled {
		return ""
	}

	zl := log.FromContext(ctx)

	connectionInfo, code, err := s.getGrafanaConnectionInfo(ctx)
	if err != nil {
		zl.Warn().Msgf("Cannot get Grafana connection info. Will try a different way to obtain Grafana version. code=[%v]: %v", code, err)
		connectionInfo = grafanaConnectionInfo{
			baseExternalURL: grafanaConfig.ExternalURL,
			internalURL:     grafanaConfig.InternalURL,
		}
	}
	// we want to use the internal URL - but if it isn't known, try the external URL
	baseUrl := connectionInfo.internalURL
	if connectionInfo.internalURL == "" {
		baseUrl = connectionInfo.baseExternalURL
	}

	if baseUrl == "" {
		zl.Warn().Msgf("Failed to obtain Grafana version URL: Grafana is not configured properly")
		return ""
	}

	return fmt.Sprintf("%s/api/frontend/settings", baseUrl)
}

func getGrafanaLinks(ctx context.Context, conn grafanaConnectionInfo, linksSpec []dashboards.MonitoringDashboardExternalLink, dashboardSupplier DashboardSupplierFunc) ([]models.ExternalLink, int, error) {
	// Call Grafana REST API to get dashboard urls
	linksOut := []models.ExternalLink{}
	for _, linkSpec := range linksSpec {
		if linkSpec.Type == "grafana" {
			dashboardPath, err := getDashboardPath(ctx, linkSpec.Name, conn, dashboardSupplier)
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
	internalURL       string
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
	if cfg.InternalURL != "" {
		apiURL = cfg.InternalURL
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
		internalURL:       apiURL,
		auth:              &cfg.Auth,
	}, 0, nil
}

func getDashboardPath(ctx context.Context, name string, conn grafanaConnectionInfo, dashboardSupplier DashboardSupplierFunc) (string, error) {
	body, code, err := dashboardSupplier(conn.internalURL, url.PathEscape(name), conn.auth)
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

	zl := log.FromContext(ctx)

	if len(dashboards) == 0 {
		zl.Warn().Msgf("No Grafana dashboard found for pattern '%s'", name)
		return "", nil
	}
	if len(dashboards) > 1 {
		zl.Info().Msgf("Several Grafana dashboards found for pattern '%s', picking the first one", name)
	}
	dashPath, ok := dashboards[0]["url"]
	if !ok {
		zl.Warn().Msgf("URL field not found in Grafana dashboard for search pattern '%s'", name)
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
