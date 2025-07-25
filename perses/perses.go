package perses

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

// Service provides discovery and info about Perses.
type Service struct {
	conf                *config.Config
	homeClusterSAClient kubernetes.ClientInterface
	routeLock           sync.RWMutex
	routeURL            *string
}

// NewService creates a new Perses service.
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
	persesConf := s.conf.ExternalServices.Perses

	// If Perses is disabled in the configuration return an empty string and avoid discovery
	if !persesConf.Enabled {
		return ""
	}
	if persesConf.ExternalURL != "" || persesConf.InternalURL == "" {
		return persesConf.ExternalURL
	}
	s.routeLock.RLock()
	if s.routeURL != nil {
		defer s.routeLock.RUnlock()
		return *s.routeURL
	}
	s.routeLock.RUnlock()
	return s.discover(ctx)
}

// discover will return the Perses URL if it has been configured,
// or will try to retrieve it if an OpenShift Route is defined.
func (s *Service) discover(ctx context.Context) string {
	s.routeLock.Lock()
	defer s.routeLock.Unlock()
	// Try to get service and namespace from in-cluster URL, to discover route
	routeURL := ""
	if internalURL := s.conf.ExternalServices.Perses.InternalURL; internalURL != "" {
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

type DashboardSupplierFunc func(string, string, string, *config.Auth) ([]byte, int, string, error)

var DashboardSupplier = checkDashboard

// Info returns the Perses URL and other info, the HTTP status code (int) and eventually an error
func (s *Service) Info(ctx context.Context, dashboardSupplier DashboardSupplierFunc) (*models.PersesInfo, int, error) {
	persesConfig := s.conf.ExternalServices.Perses
	if !persesConfig.Enabled {
		return nil, http.StatusNoContent, nil
	}

	conn, code, err := s.getPersesConnectionInfo(ctx)
	if err != nil {
		return nil, code, err
	}

	project := s.conf.ExternalServices.Perses.Project

	// Call Perses REST API to get dashboard urls
	links := []models.ExternalLink{}
	for _, dashboardConfig := range persesConfig.Dashboards {
		dashboardPath, err := getDashboardPath(ctx, project, dashboardConfig.Name, conn, dashboardSupplier)
		if err != nil {
			return nil, http.StatusServiceUnavailable, err
		}
		if dashboardPath != "" {
			externalLink := models.ExternalLink{
				URL:  dashboardPath,
				Name: dashboardConfig.Name,
				Variables: dashboards.MonitoringDashboardExternalLinkVariables{
					App:        dashboardConfig.Variables.App,
					Datasource: dashboardConfig.Variables.Datasource,
					Namespace:  dashboardConfig.Variables.Namespace,
					Service:    dashboardConfig.Variables.Service,
					Version:    dashboardConfig.Variables.Version,
					Workload:   dashboardConfig.Variables.Workload,
				},
			}
			links = append(links, externalLink)
		}
	}

	persesInfo := models.PersesInfo{
		ExternalLinks: links,
		Project:       persesConfig.Project,
	}

	return &persesInfo, http.StatusOK, nil
}

// Links returns the links to Perses dashboards and other info, the HTTP status code (int) and eventually an error
func (s *Service) Links(ctx context.Context, linksSpec []dashboards.MonitoringDashboardExternalLink) ([]models.ExternalLink, int, error) {
	persesConfig := s.conf.ExternalServices.Perses
	if !persesConfig.Enabled {
		return nil, 0, nil
	}

	connectionInfo, code, err := s.getPersesConnectionInfo(ctx)
	if err != nil {
		return nil, code, err
	}

	zl := log.FromContext(ctx)

	if connectionInfo.baseExternalURL == "" {
		zl.Trace().Msgf("Skip checking Perses links as Perses is not configured")
		return nil, 0, nil
	}
	return getPersesLinks(ctx, connectionInfo, persesConfig.Project, linksSpec, DashboardSupplier)
}

// VersionURL returns the Perses URL that can be used to obtain the Perses build information that includes its version.
// This returns an empty string if the version will not be able to be obtained for some reason.
func (s *Service) VersionURL(ctx context.Context) string {
	persesConfig := s.conf.ExternalServices.Perses
	if !persesConfig.Enabled {
		return ""
	}

	zl := log.FromContext(ctx)

	connectionInfo, code, err := s.getPersesConnectionInfo(ctx)
	if err != nil {
		zl.Warn().Msgf("Cannot get Perses connection info. Will try a different way to obtain Perses version. code=[%v]: %v", code, err)
		connectionInfo = persesConnectionInfo{
			baseExternalURL: persesConfig.ExternalURL,
			internalURL:     persesConfig.InternalURL,
		}
	}
	// we want to use the internal URL - but if it isn't known, try the external URL
	baseUrl := connectionInfo.internalURL
	if connectionInfo.internalURL == "" {
		baseUrl = connectionInfo.baseExternalURL
	}

	if baseUrl == "" {
		zl.Warn().Msgf("Failed to obtain Perses version URL: Perses is not configured properly")
		return ""
	}

	return fmt.Sprintf("%s/api/v1/health", baseUrl)
}

func getPersesLinks(ctx context.Context, conn persesConnectionInfo, project string, linksSpec []dashboards.MonitoringDashboardExternalLink, dashboardSupplier DashboardSupplierFunc) ([]models.ExternalLink, int, error) {
	// Call Perses REST API to get dashboard urls
	linksOut := []models.ExternalLink{}
	for _, linkSpec := range linksSpec {
		if linkSpec.Type == "perses" {
			dashboardPath, err := getDashboardPath(ctx, project, linkSpec.Name, conn, dashboardSupplier)
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

type persesConnectionInfo struct {
	baseExternalURL   string
	externalURLParams string
	internalURL       string
	auth              *config.Auth
}

func (s *Service) getPersesConnectionInfo(ctx context.Context) (persesConnectionInfo, int, error) {
	externalURL := s.URL(ctx)
	if externalURL == "" {
		return persesConnectionInfo{}, http.StatusServiceUnavailable, errors.New("perses URL is not set in Kiali configuration")
	}
	cfg := s.conf.ExternalServices.Perses

	// Check if URL is valid
	_, err := url.ParseRequestURI(externalURL)
	if err != nil {
		return persesConnectionInfo{}, http.StatusServiceUnavailable, errors.New("wrong format for Perses URL: " + err.Error())
	}

	apiURL := externalURL

	// Find the in-cluster URL to reach Perses's REST API if properties demand so
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

	return persesConnectionInfo{
		baseExternalURL:   externalURL,
		externalURLParams: externalURLParams,
		internalURL:       apiURL,
		auth:              &cfg.Auth,
	}, 0, nil
}

func getDashboardPath(ctx context.Context, project, name string, conn persesConnectionInfo, dashboardSupplier DashboardSupplierFunc) (string, error) {
	lowerName := strings.ToLower(name)
	spacedName := strings.ReplaceAll(lowerName, " ", "-")
	body, code, url, err := dashboardSupplier(conn.internalURL, project, url.PathEscape(spacedName), conn.auth)
	if err != nil {
		return "", err
	}
	if code != http.StatusOK {
		// Get error message
		var f map[string]string
		err = json.Unmarshal(body, &f)
		if err != nil {
			return "", fmt.Errorf("unknown error from Perses (%d)", code)
		}
		message, ok := f["message"]
		if !ok {
			return "", fmt.Errorf("unknown error from Perses (%d)", code)
		}
		return "", fmt.Errorf("error from Perses (%d): %s", code, message)
	}

	return url, nil
}

func checkDashboard(url, project, searchPattern string, auth *config.Auth) ([]byte, int, string, error) {
	urlParts := strings.Split(url, "?")
	query := strings.TrimSuffix(urlParts[0], "/") + fmt.Sprintf("/api/v1/projects/%s/dashboards/%s", project, searchPattern)
	if len(urlParts) > 1 {
		query = query + "&" + urlParts[1]
	}
	resp, code, _, err := httputil.HttpGet(query, auth, time.Second*10, nil, nil, config.Get())
	extUrl := fmt.Sprintf("%s/projects/%s/dashboards/%s", urlParts[0], project, searchPattern)
	return resp, code, extUrl, err
}
