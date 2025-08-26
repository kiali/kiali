package perses

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	sessionData         *sessionData
}

type loginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

type sessionData struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    string `json:"expiry"`
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

func (s *Service) getToken() (token string, err error) {

	loginURL := fmt.Sprintf("%s/api/auth/providers/native/login", s.URL(context.TODO()))

	reqBody := loginRequest{
		Login:    s.conf.ExternalServices.Perses.Auth.Username,
		Password: s.conf.ExternalServices.Perses.Auth.Password,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		log.Errorf("Failed to marshal login request body: %v", err)
		return "", fmt.Errorf("failed to marshal login request body: %s", err.Error())
	}

	req, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		log.Errorf("Failed to create HTTP request: %v", err)
		return "", fmt.Errorf("failed to create HTTP request: %s", err.Error())
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Errorf("Failed to request login URL: %v", err)
		return "", fmt.Errorf("failed to request login URL: %s", err.Error())
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Errorf("Failed to read response: %v", err)
		return "", fmt.Errorf("failed to read response: %d", resp.StatusCode)
	}

	var loginResp sessionData
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		log.Errorf("Failed to unmarshall reponse: %v", err)
		return "", fmt.Errorf("failed to unmarshall reponse: %s", err.Error())
	}

	s.sessionData = &sessionData{AccessToken: loginResp.AccessToken, RefreshToken: loginResp.RefreshToken, ExpiresIn: loginResp.ExpiresIn}

	return loginResp.AccessToken, nil
}

func isExpired(expiryStr string) bool {

	if expiryStr == "0001-01-01T00:00:00Z" {
		return false
	}

	expiryTime, err := time.Parse(time.RFC3339, expiryStr)
	if err != nil {
		log.Infof("Error parsing expire time %s", err.Error())
		return true
	}

	return time.Now().After(expiryTime)
}

func (s *Service) GetAuth() *config.Auth {

	newAuth := config.Auth{}
	auth := s.conf.ExternalServices.Perses.Auth

	if auth.Type == config.AuthTypeNone {
		return &newAuth
	}

	if auth.Type == config.AuthTypeBasic {

		newAuth.Type = config.AuthTypeBearer

		if s.sessionData == nil || isExpired(s.sessionData.ExpiresIn) {
			token, err := s.getToken()
			if err != nil {
				log.Errorf("Error loggin %s", err.Error())
			}
			newAuth.Token = token
			return &newAuth
		}
		newAuth.Token = s.sessionData.AccessToken
		return &newAuth
	}

	log.Errorf("Auth type not supported %s", auth.Type)
	return &newAuth
}

type DashboardSupplierFunc func(PersesConnectionInfo, string, string, *config.Auth) ([]byte, int, string, error)

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

	if connectionInfo.BaseExternalURL == "" {
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
		connectionInfo = PersesConnectionInfo{
			BaseExternalURL: persesConfig.ExternalURL,
			InternalURL:     persesConfig.InternalURL,
		}
	}
	// we want to use the internal URL - but if it isn't known, try the external URL
	baseUrl := connectionInfo.InternalURL
	if connectionInfo.InternalURL == "" {
		baseUrl = connectionInfo.BaseExternalURL
	}

	if baseUrl == "" {
		zl.Warn().Msgf("Failed to obtain Perses version URL: Perses is not configured properly")
		return ""
	}

	return fmt.Sprintf("%s/api/v1/health", baseUrl)
}

func getPersesLinks(ctx context.Context, conn PersesConnectionInfo, project string, linksSpec []dashboards.MonitoringDashboardExternalLink, dashboardSupplier DashboardSupplierFunc) ([]models.ExternalLink, int, error) {
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

type PersesConnectionInfo struct {
	BaseExternalURL   string
	ExternalURLParams string
	InternalURL       string
	Auth              *config.Auth
}

func (s *Service) getPersesConnectionInfo(ctx context.Context) (PersesConnectionInfo, int, error) {
	externalURL := s.URL(ctx)
	if externalURL == "" {
		return PersesConnectionInfo{}, http.StatusServiceUnavailable, errors.New("perses URL is not set in Kiali configuration")
	}
	cfg := s.conf.ExternalServices.Perses

	// Check if URL is valid
	_, err := url.ParseRequestURI(externalURL)
	if err != nil {
		return PersesConnectionInfo{}, http.StatusServiceUnavailable, errors.New("wrong format for Perses URL: " + err.Error())
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

	return PersesConnectionInfo{
		BaseExternalURL:   externalURL,
		ExternalURLParams: externalURLParams,
		InternalURL:       apiURL,
		Auth:              s.GetAuth(),
	}, 0, nil
}

func getDashboardPath(ctx context.Context, project, name string, conn PersesConnectionInfo, dashboardSupplier DashboardSupplierFunc) (string, error) {
	lowerName := strings.ToLower(name)
	spacedName := strings.ReplaceAll(lowerName, " ", "-")
	body, code, url, err := dashboardSupplier(conn, project, url.PathEscape(spacedName), conn.Auth)
	zl := log.FromContext(ctx)
	if err != nil {
		return "", err
	}
	if code != http.StatusOK {
		// Get error message
		var f map[string]string
		err = json.Unmarshal(body, &f)
		if err != nil {
			zl.Warn().Msgf("No Perses dashboard found for pattern '%s'. Code %d", name, code)
			return "", nil
		}
		message, ok := f["message"]
		if !ok || message == "document not found" {
			zl.Warn().Msgf("No Perses dashboard found for pattern '%s'. Code %d", name, code)
			return "", nil
		}
		zl.Warn().Msgf("No Perses dashboard found for pattern '%s'. Code %d. Message: %s", name, code, message)
		return "", fmt.Errorf("error from Perses (%d): %s", code, message)
	}

	// Status OK, read dashboards info
	var dashboards map[string]interface{}
	err = json.Unmarshal(body, &dashboards)
	if err != nil {
		return "", err
	}

	return url, nil
}

// checkDashboard uses the internal and external URL from the Perses connection data
// Kiali will use the internal URL to check for the dashboard, but the external URL to be returned (And used as an external link)
// This is because, contrary to Grafana, the external URL from the dashboard is not returned in the API response
func checkDashboard(conn PersesConnectionInfo, project, searchPattern string, auth *config.Auth) ([]byte, int, string, error) {
	url := conn.BaseExternalURL
	if conn.InternalURL != "" {
		url = conn.InternalURL
	}
	urlParts := strings.Split(url, "?")
	query := strings.TrimSuffix(urlParts[0], "/") + fmt.Sprintf("/api/v1/projects/%s/dashboards/%s", project, searchPattern)
	if len(urlParts) > 1 {
		query = query + "&" + urlParts[1]
	}
	resp, code, _, err := httputil.HttpGet(query, auth, time.Second*10, nil, nil, config.Get())

	useURL := conn.BaseExternalURL
	if useURL == "" {
		useURL = urlParts[0]
	}
	extUrl := fmt.Sprintf("%s/projects/%s/dashboards/%s", useURL, project, searchPattern)
	if conn.ExternalURLParams != "" {
		extUrl = fmt.Sprintf("%s%s", extUrl, conn.ExternalURLParams)
	}
	return resp, code, extUrl, err
}
