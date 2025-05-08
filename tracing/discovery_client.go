package tracing

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tracing/jaeger"
	"github.com/kiali/kiali/tracing/jaeger/model"
	otel "github.com/kiali/kiali/tracing/otel/model"
	"github.com/kiali/kiali/tracing/tempo"
	"github.com/kiali/kiali/util/grpcutil"
	"github.com/kiali/kiali/util/httputil"
)

func TestNewClient(ctx context.Context, conf *config.Config, token string, client ClientInterface) (*model.TracingDiagnose, error) {
	cfgTracing := conf.ExternalServices.Tracing
	test := model.TracingDiagnose{}
	logs := []model.LogLine{}

	// Tracing not enabled
	if !cfgTracing.Enabled {
		test.Message = "tracing is not enabled"
		return &test, nil
	}

	// Internal URL not set
	url := cfgTracing.InternalURL
	if !conf.InCluster {
		url = cfgTracing.ExternalURL
		logs = append(logs, model.LogLine{Time: time.Now(), Test: fmt.Sprintf("Using external url %s because not in cluster", url)})
	}

	parsedURL, ll, err := parseUrl(url)
	if err != nil {
		return &test, fmt.Errorf("external_services.tracing.internal_url is required and must be a valid URL")
	}
	logs = append(logs, ll...)

	// Get Auth
	auth := cfgTracing.Auth
	if auth.UseKialiToken {
		auth.Token = token
	}

	ports, ll := discoverPorts(parsedURL.Host)
	logs = append(logs, ll...)

	validConfig, ll := discoverUrl(ctx, *parsedURL, ports, &auth, cfgTracing)
	test.ValidConfig = validConfig
	test.LogLine = append(logs, ll...)

	// TODO: Compare with client

	return &test, nil

}

// Parse URL
func parseUrl(urlToParse string) (*model.ParsedUrl, []model.LogLine, error) {
	parsedURL, err := url.Parse(urlToParse)
	logLines := []model.LogLine{}
	if err != nil {
		return nil, logLines, fmt.Errorf("cannot parse url: %s", err.Error())
	}
	host, port, err := net.SplitHostPort(parsedURL.Host)
	if err != nil {
		host = parsedURL.Host
		port = ""
	}
	baseURL := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
	rest := parsedURL.RequestURI()

	logLines = append(logLines, model.LogLine{Time: time.Now(), Test: "Parsed url", Result: fmt.Sprintf("[Ok] host %s - port %s - baseURL %s - rest %s - prot: %s", host, port, baseURL, rest, parsedURL.Scheme)})
	return &model.ParsedUrl{BaseUrl: baseURL, Host: host, Port: port, Path: rest, Scheme: parsedURL.Scheme}, logLines, nil
}

// discoverPorts try to discover open ports
func discoverPorts(host string) ([]string, []model.LogLine) {
	portsToScan := []string{"16686", "16685", "80", "3200", "8080", "9095"}
	openPorts := []string{}
	logLines := []model.LogLine{}

	for _, port := range portsToScan {
		address := fmt.Sprintf("%s:%s", host, port)
		conn, err := net.DialTimeout("tcp", address, 500*time.Millisecond)
		if err == nil {
			logLines = append(logLines, model.LogLine{Time: time.Now(), Test: "Checking open ports", Result: fmt.Sprintf("[Ok] Port %s is open", port)})
			openPorts = append(openPorts, port)
			conn.Close()
		}
	}
	log.Tracef("[Discovery client] Open ports: %v", openPorts)
	return openPorts, logLines
}

// discoverUrl try to discover valid URLs
func discoverUrl(ctx context.Context, parsedUrl model.ParsedUrl, ports []string, auth *config.Auth, cfgTracing config.TracingConfig) ([]model.ValidConfig, []model.LogLine) {
	validConfigs := []model.ValidConfig{}
	var client http.Client
	logs := []model.LogLine{}

	// Create client
	timeout := time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout) * time.Second
	transport, err := httputil.CreateTransport(auth, &http.Transport{}, timeout, cfgTracing.CustomHeaders)
	if err != nil {
		logs = append(logs, model.LogLine{Time: time.Now(), Test: "Create HTTP client", Result: fmt.Sprintf("[ERROR] Cannot create transport: %s", err.Error())})
		// TODO: Validate auth?
		return validConfigs, logs
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
				}
				logs = append(logs, ll...)

				// Try Tempo URL
				validEndpoint = fmt.Sprintf("%s://%s:%s", parsedUrl.Scheme, parsedUrl.Host, port)
				endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
				vc, ll, err = validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
				if err == nil {
					validConfigs = append(validConfigs, *vc)
				}
				logs = append(logs, ll...)
			}
		case "8080":
			{
				// Tempo from GW, Tempo multi tenant uses security and the gateway
				if strings.Contains(parsedUrl.Host, "gateway") {
					splitUrl := strings.Split(parsedUrl.Path, "/")
					tenant := ""
					if len(splitUrl) > 3 {
						tenant = splitUrl[4]
					} else {
						logs = append(logs, model.LogLine{Time: time.Now(), Test: "Create http client in port 8080", Result: "tenant name not found"})
						log.Infof("[Discovery client] Tenant name not found: %s. Tempo URL includes gateway but not the Tenant name", parsedUrl.Path)
					}
					validEndpoint := fmt.Sprintf("%s://%s:%s/api/traces/v1/%s/tempo", parsedUrl.Scheme, parsedUrl.Host, port, tenant)
					endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
					vc, ll, err := validateEndpoint(client, endpointJ, validEndpoint, "tempo")
					if err == nil {
						validConfigs = append(validConfigs, *vc)
					}
					logs = append(logs, ll...)

					// Try GW Jaeger Endpoint
					validEndpoint = fmt.Sprintf("%s://%s:%s/api/traces/v1/%s", parsedUrl.Scheme, parsedUrl.Host, port, tenant)
					endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
					vc, ll, err = validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
					if err == nil {
						validConfigs = append(validConfigs, *vc)
					}
					logs = append(logs, ll...)

				} else {
					// Tempo service (No GW)
					validEndpoint := fmt.Sprintf("%s://%s:%s/api/traces/v1/tempo", parsedUrl.Scheme, parsedUrl.Host, port)
					endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
					vc, ll, err := validateEndpoint(client, endpointJ, validEndpoint, "tempo")
					if err == nil {
						validConfigs = append(validConfigs, *vc)
					}
					logs = append(logs, ll...)

					// Try GW Jaeger Endpoint
					validEndpoint = fmt.Sprintf("%s://%s:%s/api/traces/v1", parsedUrl.Scheme, parsedUrl.Host, port)
					endpointJ = fmt.Sprintf("%s/api/traces/v1/api/services", validEndpoint)
					vc, ll, err = validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
					if err == nil {
						validConfigs = append(validConfigs, *vc)
					}
					logs = append(logs, ll...)
				}
			}
		case "16685":
			{
				// Try gRPC Jaeger client
				opts, err := grpcutil.GetAuthDialOptions(parsedUrl.Scheme == "https", auth)
				if err == nil {
					address := parsedUrl.Host + ":" + port
					logs = append(logs, model.LogLine{Time: time.Now(), Test: "gRPC Client 16685", Result: fmt.Sprintf("%s GRPC client info: address=%s, auth.type=%s", cfgTracing.Provider, address, auth.Type)})

					if len(cfgTracing.CustomHeaders) > 0 {
						logs = append(logs, model.LogLine{Time: time.Now(), Test: "gRPC Client 16685", Result: fmt.Sprintf("Adding [%v] custom headers to Tracing client", len(cfgTracing.CustomHeaders))})
						ctx = metadata.NewOutgoingContext(ctx, metadata.New(cfgTracing.CustomHeaders))
					}
					conn, err := grpc.NewClient(address, opts...)
					if err == nil {
						cc := model.NewQueryServiceClient(conn)
						clientgRPC, err := jaeger.NewGRPCJaegerClient(cc)
						if err != nil {
							logs = append(logs, model.LogLine{Time: time.Now(), Test: "Create gRPC Client 16685", Result: fmt.Sprintf("Error creating gRPC Client: [%s]", err.Error())})
						} else {
							ok, err := clientgRPC.GetServices(ctx)
							if ok {
								vc := model.ValidConfig{Url: address, Provider: "jaeger", UseGRPC: true}
								validConfigs = append(validConfigs, vc)
								logs = append(logs, model.LogLine{Time: time.Now(), Test: "Create gRPC Client 16685 Ok", Result: "Valid gRPC Client found"})
							} else {
								logs = append(logs, model.LogLine{Time: time.Now(), Test: "GetServices gRPC Client 16685", Result: fmt.Sprintf("Error getting gRPC Services: [%s]", err.Error())})
							}
						}
					} else {
						log.Errorf("Error creating client %s", err.Error())
						return nil, nil
					}
				}
				if err != nil {
					logs = append(logs, model.LogLine{Time: time.Now(), Test: "gRPC Client 16685", Result: fmt.Sprintf("Error while building GRPC dial options: %v", err)})
				}
			}
		case "3200":
			{
				// Try Tempo HTTP client
				validEndpoint := fmt.Sprintf("%s://%s:%s", parsedUrl.Scheme, parsedUrl.Host, port)
				endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
				vc, ll, err := validateEndpoint(client, endpointJ, validEndpoint, "tempo")
				if err == nil {
					validConfigs = append(validConfigs, *vc)
				}
				logs = append(logs, ll...)

				// Try Jaeger?
				validEndpoint = fmt.Sprintf("%s://%s:%s", parsedUrl.Scheme, parsedUrl.Host, port)
				endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
				vc, ll, err = validateEndpoint(client, endpointJ, validEndpoint, "jaeger")
				if err == nil {
					validConfigs = append(validConfigs, *vc)
				}
				logs = append(logs, ll...)
			}
		case "9095":
			{
				// Try GRPC Tempo Client
				// And this also requires HTTP Client
				var dialOps []grpc.DialOption
				if cfgTracing.Auth.Type == "basic" {
					dialOps = append(dialOps, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
					dialOps = append(dialOps, grpc.WithPerRPCCredentials(&basicAuth{
						Header: fmt.Sprintf("Basic %s", base64.StdEncoding.EncodeToString([]byte(strings.Join([]string{cfgTracing.Auth.Username, cfgTracing.Auth.Password}, ":")))),
					}))
				} else {
					dialOps = append(dialOps, grpc.WithTransportCredentials(insecure.NewCredentials()))
				}
				grpcAddress := fmt.Sprintf("%s:%s", parsedUrl.Host, port)
				clientConn, _ := grpc.NewClient(grpcAddress, dialOps...)
				streamClient, err := tempo.NewgRPCClient(clientConn)
				if err != nil {
					msg := fmt.Sprintf("Error creating gRPC Client %s", err.Error())
					logs = append(logs, model.LogLine{Time: time.Now(), Test: "Create gRPC Client 9095 error", Result: msg})
					log.Error(msg)
				} else {
					ok, err := streamClient.GetServices(ctx)
					if ok {
						// TODO: Different config gRPC Port!!!
						vc := model.ValidConfig{Url: grpcAddress, Provider: "tempo", UseGRPC: true}
						validConfigs = append(validConfigs, vc)
						logs = append(logs, model.LogLine{Time: time.Now(), Test: "Create gRPC Tempo Client 9095 Ok", Result: "Valid gRPC Client found. Notice this config also requires any valid HTTP configuration. "})
					} else {
						logs = append(logs, model.LogLine{Time: time.Now(), Test: "GetServices gRPC Tempo Client 9095", Result: fmt.Sprintf("Error getting gRPC Services: [%s]", err.Error())})
					}
				}
			}
		}
	}
	return validConfigs, logs
}

func validateEndpoint(client http.Client, endpoint, validEndpoint string, provider string) (*model.ValidConfig, []model.LogLine, error) {

	logs := []model.LogLine{}
	resp, code, reqError := MakeRequest(client, endpoint, nil)
	if code != 200 {
		msg := fmt.Sprintf("[Discovery client] Cannot query endpoint: %s. Code [%d].", endpoint, code)
		if reqError != nil {
			msg = fmt.Sprintf("%s. Error: %s", msg, reqError.Error())
		}
		if resp != nil {
			msg = fmt.Sprintf("%s. Response: %s", msg, resp)
			response := fmt.Sprintf("%s", resp)
			// HTTPS required. Try HTTPS URL
			if strings.Contains(response, "Client sent an HTTP request to an HTTPS") && !strings.Contains(endpoint, "https") {
				endpoint = strings.Replace(endpoint, "http", "https", 1)
				validEndpoint = strings.Replace(validEndpoint, "http", "https", 1)
				return validateEndpoint(client, endpoint, validEndpoint, provider)
			}
		}
		// Certificate error: Try valid host
		if reqError != nil && strings.Contains(reqError.Error(), "certificate is valid for") {
			validRe := regexp.MustCompile(`certificate is valid for ([^,]+)`)
			notRe := regexp.MustCompile(`not ([^\s]+)`)
			validMatch := validRe.FindStringSubmatch(reqError.Error())
			notMatch := notRe.FindStringSubmatch(reqError.Error())
			if len(validMatch) > 1 && len(notMatch) > 1 {
				replacedEndpoint := strings.Replace(endpoint, notMatch[1], validMatch[1], 1)
				replacedValidEndpoint := strings.Replace(validEndpoint, notMatch[1], validMatch[1], 1)
				if replacedEndpoint != endpoint {
					return validateEndpoint(client, replacedEndpoint, replacedValidEndpoint, provider)
				}
			}
		}
		// Auth issue
		if reqError != nil && strings.Contains(reqError.Error(), "certificate signed by unknown authority") {
			vc := model.ValidConfig{Url: validEndpoint, Provider: provider, UseGRPC: false, Warning: "Auth section must be configured properly"}
			return &vc, logs, nil
		}
		logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
		log.Trace(msg)
		return nil, logs, errors.New(msg)
	}

	if provider == "jaeger" {
		var response model.TracingServices
		if errMarshal := json.Unmarshal(resp, &response); errMarshal != nil {
			msg := fmt.Sprintf("[Discovery client] Error unmarshalling Jaeger response: %s [URL: %v]", errMarshal, endpoint)
			logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
			log.Trace(msg)
			return nil, logs, errors.New(msg)
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
		log.Trace(msg)
		return &vc, logs, nil
	}
	// Try Tempo
	var response otel.Traces
	if errMarshal := json.Unmarshal(resp, &response); errMarshal != nil {
		msg := fmt.Sprintf("[Discovery client] Error unmarshalling Tempo response: %s [URL: %v]", errMarshal, endpoint)
		logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
		log.Trace(msg)
		return nil, logs, errors.New(msg)
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
	log.Trace(msg)
	return &vc, logs, nil
}
