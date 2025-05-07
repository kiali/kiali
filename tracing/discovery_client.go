package tracing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tracing/jaeger/model"
	otel "github.com/kiali/kiali/tracing/otel/model"
	"github.com/kiali/kiali/util/httputil"
)

func TestNewClient(ctx context.Context, conf *config.Config, token string, client ClientInterface) (*model.TracingDiagnose, error) {
	cfgTracing := conf.ExternalServices.Tracing
	test := model.TracingDiagnose{}

	// Tracing not enabled
	if !cfgTracing.Enabled {
		test.Message = "tracing is not enabled"
		return &test, nil
	}

	// Internal URL not set
	parsedURL, err := parseUrl(cfgTracing.InternalURL)
	if err != nil {
		return &test, errors.New("external_services.tracing.internal_url is required and must be a valid URL")
	}

	// Get Auth
	auth := cfgTracing.Auth
	if auth.UseKialiToken {
		auth.Token = token
	}

	// If the client is valid try to figure out the problem
	/*
		if client != nil {
			ts, err := client.GetAppTraces("", "", models.TracingQuery{})
			if err != nil {
				test.Message = err.Error()
				if strings.Contains(test.Message, "connection refused") {
					ports := discoverPorts(parsedURL.Host)
					validConfig := discoverUrl(parsedURL.Scheme, parsedURL.Host, ports, &auth, cfgTracing)
					test.ValidConfig = validConfig
				}
				return &test, err
			}
			if ts.Errors != nil {
				test.Message = err.Error()
				return &test, err
			}
		}
	*/
	ports := discoverPorts(parsedURL.Host)
	validConfig := discoverUrl(*parsedURL, ports, &auth, cfgTracing)
	test.ValidConfig = validConfig

	return &test, nil

}

// Parse URL
func parseUrl(urlToParse string) (*model.ParsedUrl, error) {
	parsedURL, err := url.Parse(urlToParse)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("Cannot parse url: %s", err.Error()))
	}
	host, port, err := net.SplitHostPort(parsedURL.Host)
	if err != nil {
		host = parsedURL.Host
		port = ""
	}
	baseURL := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
	rest := parsedURL.RequestURI()

	log.Infof("[Discovery client] Parsed URL: host %s - port %s - baseURL %s - rest %s - prot: %s", host, port, baseURL, rest, parsedURL.Scheme)
	return &model.ParsedUrl{BaseUrl: baseURL, Host: host, Port: port, Path: rest, Scheme: parsedURL.Scheme}, nil
}

// discoverPorts try to discover open ports
func discoverPorts(host string) []string {
	portsToScan := []string{"16686", "16685", "80", "3200", "8080", "9095"}
	openPorts := []string{}
	for _, port := range portsToScan {
		address := fmt.Sprintf("%s:%s", host, port)
		conn, err := net.DialTimeout("tcp", address, 500*time.Millisecond)
		if err == nil {
			log.Debugf("[Discovery client] Port %s is open", port)
			openPorts = append(openPorts, port)
			conn.Close()
		}
	}
	log.Infof("[Discovery client] Open ports: %v", openPorts)
	return openPorts
}

// discoverUrl try to discover valid URLs
func discoverUrl(parsedUrl model.ParsedUrl, ports []string, auth *config.Auth, cfgTracing config.TracingConfig) []model.ValidConfig {
	validConfigs := []model.ValidConfig{}
	var client http.Client
	logs := []model.LogLine{}

	// Create client
	timeout := time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout) * time.Second
	transport, err := httputil.CreateTransport(auth, &http.Transport{}, timeout, cfgTracing.CustomHeaders)
	if err != nil {
		log.Infof("[Discovery client] Cannot create transport: %s", err.Error())
		// TODO: Validate auth?
		return validConfigs
	} else {
		client = http.Client{Transport: transport, Timeout: timeout}
	}

	for _, port := range ports {
		switch port {
		case "16686", "80":
			{
				// We assume it is Jaeger. Try Jaeger URL
				validEndpoint := fmt.Sprintf("%s://%s:%s", parsedUrl.Scheme, parsedUrl.Host, port)
				endpointJ := fmt.Sprintf("%s/jaeger/api/services", validEndpoint)
				vc, ll, err := validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
				if err == nil {
					validConfigs = append(validConfigs, *vc)
					logs = append(logs, ll...)
				}

				// Try Tempo URL
				validEndpoint = fmt.Sprintf("%s://%s:%s", parsedUrl.Scheme, parsedUrl.Host, port)
				endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
				vc, ll, err = validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
				if err == nil {
					validConfigs = append(validConfigs, *vc)
					logs = append(logs, ll...)
				}
			}
		case "8080":
			{
				// Tempo from GW, Tempo multi tenant uses security and the gateway
				if strings.Contains(parsedUrl.Host, "gateway") {
					splitUrl := strings.Split(parsedUrl.Path, "/")
					tenant := ""
					if len(splitUrl) > 3 {
						tenant = splitUrl[3]
					} else {
						log.Infof("[Discovery client] Tenant name not found: %s. Tempo URL includes gateway but not the Tenant name", parsedUrl.Path)
					}
					validEndpoint := fmt.Sprintf("%s://%s:%s/api/traces/v1/%s/tempo", parsedUrl.Scheme, parsedUrl.Host, port, tenant)
					endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
					vc, ll, err := validateEndpoint(client, endpointJ, validEndpoint, "tempo")
					if err == nil {
						validConfigs = append(validConfigs, *vc)
						logs = append(logs, ll...)
					}

					// Try GW Jaeger Endpoint
					validEndpoint = fmt.Sprintf("%s://%s:%s/api/traces/v1/%s", parsedUrl.Scheme, parsedUrl.Host, port, tenant)
					endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
					vc, ll, err = validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
					if err == nil {
						validConfigs = append(validConfigs, *vc)
						logs = append(logs, ll...)
					}

				} else {
					// Tempo service (No GW)
					validEndpoint := fmt.Sprintf("%s://%s:%s/api/traces/v1/tempo", parsedUrl.Scheme, parsedUrl.Host, port)
					endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
					vc, ll, err := validateEndpoint(client, endpointJ, validEndpoint, "tempo")
					if err == nil {
						validConfigs = append(validConfigs, *vc)
						logs = append(logs, ll...)
					}

					// Try GW Jaeger Endpoint
					validEndpoint = fmt.Sprintf("%s://%s:%s/api/traces/v1", parsedUrl.Scheme, parsedUrl.Host, port)
					endpointJ = fmt.Sprintf("%s/api/traces/v1/api/services", validEndpoint)
					vc, ll, err = validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
					if err == nil {
						validConfigs = append(validConfigs, *vc)
						logs = append(logs, ll...)
					}
				}
			}
		case "16685":
			{
				// Try gRPC Jaeger client

			}
		case "3200":
			{
				// Try Tempo HTTP client
				validEndpoint := fmt.Sprintf("%s://%s:%s", parsedUrl.Scheme, parsedUrl.Host, port)
				endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
				vc, ll, err := validateEndpoint(client, endpointJ, validEndpoint, "tempo")
				if err == nil {
					validConfigs = append(validConfigs, *vc)
					logs = append(logs, ll...)
				}
				// Try Jaeger?
				validEndpoint = fmt.Sprintf("%s://%s:%s", parsedUrl.Scheme, parsedUrl.Host, port)
				endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
				vc, ll, err = validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
				if err == nil {
					validConfigs = append(validConfigs, *vc)
					logs = append(logs, ll...)
				}
			}
		case "9095":
			{
				// Try GRPC Tempo Client
				// And this also requires HTTP Client
			}
		}
	}
	return validConfigs
}

func validateEndpoint(client http.Client, endpoint, validEndpoint string, provider string) (*model.ValidConfig, []model.LogLine, error) {

	logs := []model.LogLine{}
	resp, code, reqError := MakeRequest(client, endpoint, nil)

	if code != 200 {
		msg := fmt.Sprintf("[Discovery client] Cannot query endpoint: %s. Code [%d].", endpoint, code)
		if reqError != nil {
			msg = fmt.Sprintf("[Discovery client] Cannot query endpoint: %s. Code [%d]. Error: %s", endpoint, code, reqError.Error())
		}
		logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
		log.Tracef(msg)
		return nil, logs, fmt.Errorf(msg)
	}

	if provider == "jaeger" {
		var response model.TracingServices
		if errMarshal := json.Unmarshal(resp, &response); errMarshal != nil {
			msg := fmt.Sprintf("[Discovery client] Error unmarshalling Jaeger response: %s [URL: %v]", errMarshal, endpoint)
			logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
			log.Tracef(msg)
			return nil, logs, fmt.Errorf(msg)
		}
		vc := model.ValidConfig{Url: validEndpoint, Provider: provider, UseGRPC: false, NamespaceSelector: false}
		for _, rd := range response.Data {
			parts := strings.Split(rd, ".")
			if len(parts) > 1 {
				vc.NamespaceSelector = true
				break
			}
		}
		msg := fmt.Sprintf("[Discovery client] Found valid Config %v", vc)
		logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
		log.Tracef(msg)
		return &vc, logs, nil
	}
	// Try Tempo
	var response otel.Traces
	if errMarshal := json.Unmarshal(resp, &response); errMarshal != nil {
		msg := fmt.Sprintf("[Discovery client] Error unmarshalling Tempo response: %s [URL: %v]", errMarshal, endpoint)
		logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
		log.Tracef(msg)
		return nil, logs, fmt.Errorf(msg)
	}
	vc := model.ValidConfig{Url: validEndpoint, Provider: "tempo", UseGRPC: false, NamespaceSelector: false}
	for _, rd := range response.Traces {
		parts := strings.Split(rd.RootServiceName, ".")
		if len(parts) > 1 {
			vc.NamespaceSelector = true
			break
		}
	}
	msg := fmt.Sprintf("[Discovery client] Found valid Config %v", vc)
	logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
	log.Tracef(msg)
	return &vc, logs, nil
}
