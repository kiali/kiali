package tracing

import (
	"context"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tracing/jaeger"
	"github.com/kiali/kiali/tracing/jaeger/model"
	"github.com/kiali/kiali/tracing/otel"
	"github.com/kiali/kiali/tracing/tempo"
	"github.com/kiali/kiali/util/grpcutil"
	"github.com/kiali/kiali/util/httputil"
)

type DialFunc func(network, address string, timeout time.Duration) (net.Conn, error)

var MakeRequestFunc = otel.MakeRequest

func DiagnoseTracingConfig(ctx context.Context, conf *config.Config, token string) (*model.TracingDiagnose, error) {
	return diagnoseTracingConfig(ctx, conf, token, net.DialTimeout)
}

func diagnoseTracingConfig(ctx context.Context, conf *config.Config, token string, dial DialFunc) (*model.TracingDiagnose, error) {
	cfgTracing := conf.ExternalServices.Tracing
	test := model.TracingDiagnose{}
	logs := []model.LogLine{}
	zl := log.WithGroup(log.TracingLogName)

	// Tracing not enabled
	if !cfgTracing.Enabled {
		test.Message = "tracing is not enabled"
		return &test, nil
	}

	target, _ := tracingTarget(cfgTracing)
	parsedURL, ll, err := parseUrl(target)
	if err != nil {
		return &test, errors.New("the configured tracing backend must have a valid HTTP or HTTPS URL without embedded credentials")
	}
	logs = append(logs, ll...)

	ports, ll := discoverPortsWithDial(zl, parsedURL.Host, dial)
	logs = append(logs, ll...)
	test.ValidConfig, ll = discoverURL(ctx, conf, zl, *parsedURL, ports)
	logs = append(logs, ll...)

	// Discovery guesses ports and paths without credentials. Only the deployed
	// configuration is eligible for a check with Kiali's credentials.
	const testName = "Verify configured tracing backend"
	readiness, queryErr := verifyDeployedTracing(ctx, conf, token)
	test.Readiness = readiness
	test.QueryAPI = &model.TracingProbeResult{Status: model.TracingProbeFailed}
	if queryErr != nil {
		logs = append(logs, model.LogLine{Time: time.Now(), Test: testName, Result: queryErr.Error()})
	} else {
		test.QueryAPI.Status = model.TracingProbePassed
		test.ValidConfig = mergeVerifiedTracingConfig(test.ValidConfig, cfgTracing, *parsedURL.Url)
		logs = append(logs, model.LogLine{Time: time.Now(), Test: testName, Result: "[Ok] Configured tracing backend verified"})
	}
	test.LogLine = logs

	return &test, nil
}

func mergeVerifiedTracingConfig(candidates []model.ValidConfig, cfgTracing config.TracingConfig, candidateURL url.URL) []model.ValidConfig {
	candidateURL.RawQuery = ""
	candidateURL.ForceQuery = false
	verified := model.ValidConfig{
		AuthType:          cfgTracing.Auth.Type,
		NamespaceSelector: &cfgTracing.NamespaceSelector,
		Provider:          string(cfgTracing.Provider),
		Url:               candidateURL.String(),
		UseGRPC:           cfgTracing.UseGRPC,
	}
	i := findTracingCandidate(candidates, verified)
	if i >= 0 {
		// Query verification does not establish how service names are recorded.
		verified.NamespaceSelector = candidates[i].NamespaceSelector
		candidates[i] = verified
		return candidates
	}
	return append(candidates, verified)
}

func findTracingCandidate(candidates []model.ValidConfig, target model.ValidConfig) int {
	targetURL, err := url.Parse(target.Url)
	if err != nil {
		return -1
	}
	return slices.IndexFunc(candidates, func(candidate model.ValidConfig) bool {
		if candidate.Provider != target.Provider || candidate.UseGRPC != target.UseGRPC {
			return false
		}
		u, err := url.Parse(candidate.Url)
		if err != nil || strings.TrimSuffix(u.Path, "/") != strings.TrimSuffix(targetURL.Path, "/") {
			return false
		}
		return httputil.SameOrigin(u, targetURL)
	})
}

func verifyDeployedTracing(ctx context.Context, conf *config.Config, token string) (*model.TracingProbeResult, error) {
	cfg := conf.ExternalServices.Tracing
	if cfg.Provider != config.JaegerProvider && cfg.Provider != config.TempoProvider {
		return nil, errors.New("select Jaeger or Tempo as the tracing provider")
	}
	if cfg.Provider == config.TempoProvider && cfg.UseGRPC && (cfg.GrpcPort < 1 || cfg.GrpcPort > 65535) {
		return nil, errors.New("the configured Tempo gRPC port is invalid")
	}
	if cfg.Auth.Type == config.AuthTypeOAuth2 {
		if _, err := parseDiscoveryURL(cfg.Auth.OAuth2.TokenURL); err != nil {
			return nil, errors.New("the configured OAuth token URL is invalid")
		}
	}

	client, err := newClient(ctx, conf, token, httputil.SameOriginRedirect)
	if err != nil {
		return nil, errors.New("could not initialize the tracing client with these settings")
	}
	if client.grpcConn != nil {
		defer client.grpcConn.Close()
	}

	var readiness *model.TracingProbeResult
	tempoHTTP, isTempoHTTP := client.httpTracingClient.(*tempo.OtelHTTPClient)
	if isTempoHTTP && !cfg.UseGRPC {
		readinessCtx, cancel := context.WithTimeout(ctx, httputil.DefaultTimeout)
		result, readinessErr := tempoHTTP.ProbeReadinessHTTP(readinessCtx, conf, client.httpClient, client.baseURL)
		cancel()
		readiness = &model.TracingProbeResult{HTTPStatus: result.StatusCode, Status: model.TracingProbeFailed}
		switch {
		case readinessErr != nil:
			// A readiness failure must not stop the query check.
		case result.RequiresAuthentication():
			readiness.Status = model.TracingProbeUnverified
		case result.StatusCode == http.StatusOK:
			readiness.Status = model.TracingProbePassed
		}
	}

	queryCtx, cancel := context.WithTimeout(ctx, httputil.DefaultTimeout)
	defer cancel()
	if isTempoHTTP && !cfg.UseGRPC {
		err = tempoHTTP.VerifySearchHTTP(queryCtx, client.httpClient, client.baseURL)
	} else {
		_, err = client.GetServices(queryCtx)
	}
	// Backend and OAuth errors may contain credentials. Only return a fixed message.
	if errors.Is(err, httputil.ErrRedirectOrigin) {
		return readiness, errors.New("The tracing query redirected to a different address. Configure that address directly to verify it")
	}
	if err != nil {
		return readiness, errors.New("Could not verify the tracing query API with these settings")
	}
	return readiness, nil
}

func parseDiscoveryURL(rawURL string) (*url.URL, error) {
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil || u.Fragment != "" {
		return nil, errors.New("invalid tracing URL")
	}
	return u, nil
}

func parseUrl(urlToParse string) (*model.ParsedUrl, []model.LogLine, error) {
	logLines := []model.LogLine{}
	parsedURL, err := parseDiscoveryURL(urlToParse)
	if err != nil {
		return nil, logLines, err
	}
	host, port := parsedURL.Hostname(), parsedURL.Port()
	baseURL := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
	rest := parsedURL.EscapedPath()

	logLines = append(logLines, model.LogLine{Time: time.Now(), Test: "Parsed url", Result: fmt.Sprintf("[Ok] host %s - port %s - baseURL %s - rest %s - prot: %s", host, port, baseURL, rest, parsedURL.Scheme)})
	return &model.ParsedUrl{BaseUrl: baseURL, Host: host, Port: port, Path: rest, Scheme: parsedURL.Scheme, Url: parsedURL}, logLines, nil
}

// discoverPorts try to discover open ports
// dial is just to make it testable
func discoverPortsWithDial(zl *zerolog.Logger, host string, dial DialFunc) ([]string, []model.LogLine) {
	portsToScan := []string{"16686", "16685", "80", "3200", "3100", "8080", "9095", "443"}
	openPorts := []string{}
	logLines := []model.LogLine{}

	for _, port := range portsToScan {
		address := net.JoinHostPort(host, port)
		conn, err := dial("tcp", address, 500*time.Millisecond)
		if err == nil {
			logLines = append(logLines, model.LogLine{Time: time.Now(), Test: "Checking open ports", Result: fmt.Sprintf("[Ok] Port %s is open", port)})
			openPorts = append(openPorts, port)
			conn.Close()
		}
	}
	zl.Trace().Msgf("[Discovery client] Open ports: %v", openPorts)
	return openPorts, logLines
}

const discoveryAuthWarning = "This address requires authentication. Ask an operator to configure it before verifying authentication."

// discoverURL tries the usual ports without sending any configured credential or custom header.
func discoverURL(ctx context.Context, conf *config.Config, zl *zerolog.Logger, parsed model.ParsedUrl, ports []string) ([]model.ValidConfig, []model.LogLine) {
	results := []model.ValidConfig{}
	logs := []model.LogLine{}
	timeout := time.Duration(conf.ExternalServices.Tracing.QueryTimeout) * time.Second
	if timeout <= 0 {
		timeout = httputil.DefaultTimeout
	}
	client, err := httputil.NewProbeHTTPClient(conf, nil, timeout, nil, httputil.AnonymousDiscoveryRedirect)
	if err != nil {
		logs = append(logs, model.LogLine{Time: time.Now(), Test: "Create HTTP discovery client", Result: "Could not initialize the HTTP discovery client"})
		return results, logs
	}

	for _, port := range ports {
		target := parsed
		switch port {
		case "80":
			target.Scheme = "http"
		case "443":
			target.Scheme = "https"
		}
		var candidates []model.ValidConfig
		var messages []model.LogLine
		switch port {
		case "16686":
			candidates, messages = validateJaegerHTTP(ctx, client, zl, target, port)
		case "8080":
			candidates, messages = validateTempoHTTP(ctx, client, zl, target, port, conf.ExternalServices.Tracing.TempoConfig.Tenant)
		case "80", "443":
			candidates, messages = validateJaegerHTTP(ctx, client, zl, target, port)
			tempoCandidates, tempoMessages := validateTempoHTTP(ctx, client, zl, target, port, conf.ExternalServices.Tracing.TempoConfig.Tenant)
			simpleCandidates, simpleMessages := validateSimpleTempoHTTP(ctx, client, zl, target, port, false)
			candidates = append(append(candidates, tempoCandidates...), simpleCandidates...)
			messages = append(append(messages, tempoMessages...), simpleMessages...)
		case "3200", "3100":
			candidates, messages = validateSimpleTempoHTTP(ctx, client, zl, target, port, true)
		case "16685":
			candidates, messages = discoverGRPC(ctx, conf, target, port, config.JaegerProvider)
		case "9095":
			candidates, messages = discoverGRPC(ctx, conf, target, port, config.TempoProvider)
		}
		for _, candidate := range candidates {
			i := findTracingCandidate(results, candidate)
			if i < 0 {
				results = append(results, candidate)
				continue
			}
			// Two ports can lead to the same endpoint after an HTTPS upgrade.
			// Keep a successful probe or namespace observation over a weaker result.
			if (results[i].Warning != "" && candidate.Warning == "") ||
				(results[i].NamespaceSelector == nil && candidate.NamespaceSelector != nil) {
				results[i] = candidate
			}
		}
		logs = append(logs, messages...)
	}

	return results, logs
}

func discoverGRPC(ctx context.Context, conf *config.Config, parsed model.ParsedUrl, port string, provider config.TracingProvider) ([]model.ValidConfig, []model.LogLine) {
	address := net.JoinHostPort(parsed.Host, port)
	testName := fmt.Sprintf("Check %s gRPC on port %s", provider, port)
	logResult := func(message string) []model.LogLine {
		return []model.LogLine{{Time: time.Now(), Test: testName, Result: message}}
	}
	opts, err := grpcutil.GetAuthDialOptions(conf, parsed.Host, parsed.Scheme == "https", nil)
	if err != nil {
		return nil, logResult("Could not initialize gRPC transport")
	}
	opts = append(opts, grpc.WithDisableServiceConfig())
	conn, err := grpc.NewClient(address, opts...)
	if err != nil {
		return nil, logResult("Could not initialize gRPC client")
	}
	defer conn.Close()

	var client GRPCClientInterface
	if provider == config.TempoProvider {
		client, err = tempo.NewgRPCClient(conn)
	} else {
		client, err = jaeger.NewGRPCJaegerClient(model.NewQueryServiceClient(conn))
	}
	if err != nil {
		return nil, logResult("Could not initialize tracing gRPC client")
	}

	result := model.ValidConfig{Url: parsed.Scheme + "://" + address, Provider: string(provider), UseGRPC: true}
	_, err = client.GetServicesList(ctx)
	switch status.Code(err) {
	case codes.OK:
		if provider == config.TempoProvider {
			result.Warning = "Tempo gRPC also requires an HTTP backend URL."
		}
		return []model.ValidConfig{result}, logResult("[Ok] Tracing gRPC backend found")
	case codes.Unauthenticated, codes.PermissionDenied:
		result.Warning = discoveryAuthWarning
		return []model.ValidConfig{result}, logResult(discoveryAuthWarning)
	case codes.DeadlineExceeded:
		return nil, logResult("Timed out verifying the gRPC backend")
	default:
		return nil, logResult("Could not verify the gRPC backend")
	}
}

func discoveredOrigin(parsed model.ParsedUrl, port string) string {
	return parsed.Scheme + "://" + net.JoinHostPort(parsed.Host, port)
}

// validateJaegerHTTP validate specific path for Jaeger and HTTP endpoint
func validateJaegerHTTP(ctx context.Context, client http.Client, zl *zerolog.Logger, parsedUrl model.ParsedUrl, port string) ([]model.ValidConfig, []model.LogLine) {
	logs := []model.LogLine{}
	validConfigs := []model.ValidConfig{}

	// We assume it is Jaeger. Try Jaeger URL
	validEndpoint := discoveredOrigin(parsedUrl, port) + "/jaeger"
	endpointJ := fmt.Sprintf("%s/api/services", validEndpoint)
	vc, ll, err := validateEndpoint(ctx, client, zl, endpointJ, validEndpoint, "jaeger")
	if err == nil {
		validConfigs = append(validConfigs, *vc)
	}
	logs = append(logs, ll...)

	// Try Tempo URL
	validEndpoint = discoveredOrigin(parsedUrl, port)
	endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
	vc, ll, err = validateEndpoint(ctx, client, zl, endpointJ, validEndpoint, "jaeger")
	if err == nil {
		validConfigs = append(validConfigs, *vc)
	}
	logs = append(logs, ll...)
	return validConfigs, logs
}

// validateTempoHTTP validate specific path for Tempo and HTTP endpoint
func validateTempoHTTP(ctx context.Context, client http.Client, zl *zerolog.Logger, parsedUrl model.ParsedUrl, port, tenant string) ([]model.ValidConfig, []model.LogLine) {
	logs := []model.LogLine{}
	validConfigs := []model.ValidConfig{}

	// Tempo from GW, Tempo multi tenant uses security and the gateway
	if strings.Contains(parsedUrl.Host, "gateway") {
		splitUrl := strings.Split(parsedUrl.Path, "/")
		if tenant == "" {
			if len(splitUrl) > 4 {
				tenant = splitUrl[4]
			} else {
				logs = append(logs, model.LogLine{Time: time.Now(), Test: fmt.Sprintf("Create http client in port [%s]", port), Result: fmt.Sprintf("tenant name not found: %s", parsedUrl.Path)})
			}
		}

		validEndpoint := discoveredOrigin(parsedUrl, port) + "/api/traces/v1/" + url.PathEscape(tenant) + "/tempo"
		endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
		vc, ll, err := validateEndpoint(ctx, client, zl, endpointJ, validEndpoint, "tempo")
		if err == nil {
			validConfigs = append(validConfigs, *vc)
		}
		logs = append(logs, ll...)

		// Try GW Jaeger Endpoint
		validEndpoint = discoveredOrigin(parsedUrl, port) + "/api/traces/v1/" + url.PathEscape(tenant)
		endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
		vc, ll, err = validateEndpoint(ctx, client, zl, endpointJ, validEndpoint, "jaeger")
		if err == nil {
			validConfigs = append(validConfigs, *vc)
		}
		logs = append(logs, ll...)

	} else {
		// Tempo service (No GW)
		validEndpoint := discoveredOrigin(parsedUrl, port) + "/api/traces/v1/tempo"
		endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
		vc, ll, err := validateEndpoint(ctx, client, zl, endpointJ, validEndpoint, "tempo")
		if err == nil {
			validConfigs = append(validConfigs, *vc)
		}
		logs = append(logs, ll...)

		// Try GW Jaeger Endpoint
		validEndpoint = discoveredOrigin(parsedUrl, port) + "/api/traces/v1"
		endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
		vc, ll, err = validateEndpoint(ctx, client, zl, endpointJ, validEndpoint, "jaeger")
		if err == nil {
			validConfigs = append(validConfigs, *vc)
		}
		logs = append(logs, ll...)
	}

	return validConfigs, logs
}

// validateSimpleTempoHTTP probes the root Tempo API and optionally the Jaeger-compatible one.
func validateSimpleTempoHTTP(ctx context.Context, client http.Client, zl *zerolog.Logger, parsedUrl model.ParsedUrl, port string, probeJaeger bool) ([]model.ValidConfig, []model.LogLine) {
	logs := []model.LogLine{}
	validConfigs := []model.ValidConfig{}

	// Try Tempo HTTP client
	validEndpoint := discoveredOrigin(parsedUrl, port)
	endpointJ := fmt.Sprintf("%s/api/search?q={}", validEndpoint)
	vc, ll, err := validateEndpoint(ctx, client, zl, endpointJ, validEndpoint, "tempo")
	if err == nil {
		validConfigs = append(validConfigs, *vc)
	}
	logs = append(logs, ll...)

	if !probeJaeger {
		return validConfigs, logs
	}
	endpointJ = fmt.Sprintf("%s/api/services", validEndpoint)
	vc, ll, err = validateEndpoint(ctx, client, zl, endpointJ, validEndpoint, "jaeger")
	if err == nil {
		validConfigs = append(validConfigs, *vc)
	}
	logs = append(logs, ll...)

	return validConfigs, logs
}

// validateEndpoint Given an endpoint, validates it is valid, otherwise returns an error or logLines
func validateEndpoint(ctx context.Context, client http.Client, zl *zerolog.Logger, endpoint, validEndpoint string, provider string) (*model.ValidConfig, []model.LogLine, error) {
	logs := []model.LogLine{}
	// Remember the HTTPS origin if the anonymous probe upgraded during a redirect.
	redirectPolicy := client.CheckRedirect
	if redirectPolicy != nil {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			if err := redirectPolicy(req, via); err != nil {
				return err
			}
			if req.URL.Scheme != via[0].URL.Scheme {
				u, err := url.Parse(validEndpoint)
				if err == nil {
					u.Scheme, u.Host = req.URL.Scheme, req.URL.Host
					validEndpoint = u.String()
				}
			}
			return nil
		}
	}
	// This is an anonymous retry against the same host and port. Some servers
	// respond to plaintext on their TLS port with an error instead of a redirect.
	resp, code, reqError := MakeRequestFunc(ctx, client, endpoint, nil)
	if strings.HasPrefix(endpoint, "http://") && strings.Contains(string(resp), "Client sent an HTTP request to an HTTPS") {
		// Keep the original policy when retrying, so it cannot capture the
		// candidate URL from this invocation.
		client.CheckRedirect = redirectPolicy
		return validateEndpoint(ctx, client, zl, "https://"+strings.TrimPrefix(endpoint, "http://"),
			"https://"+strings.TrimPrefix(validEndpoint, "http://"), provider)
	}
	if reqError != nil || code != http.StatusOK {
		// Interpret known responses without returning raw backend bodies or errors.
		warning := ""
		var unknownAuthErr x509.UnknownAuthorityError
		var hostnameErr x509.HostnameError
		switch {
		case errors.Is(reqError, httputil.ErrRedirectOrigin):
			warning = "The probe redirected to a different address. Ask an operator to configure the destination before verification."
		case errors.As(reqError, &unknownAuthErr), errors.As(reqError, &hostnameErr):
			warning = "The TLS certificate could not be verified. Check the hostname and CA configuration."
		case code == http.StatusUnauthorized || code == http.StatusForbidden:
			warning = discoveryAuthWarning
		case strings.Contains(string(resp), "tenant not found"):
			warning = "Tenant must be specified."
		}
		if warning != "" {
			logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: warning})
			return &model.ValidConfig{Url: validEndpoint, Provider: provider, Warning: warning}, logs, nil
		}
		msg := "Could not query the tracing endpoint"
		if code != 0 {
			msg = fmt.Sprintf("The tracing endpoint returned HTTP %d", code)
		}
		logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
		zl.Trace().Msg(msg)
		return nil, logs, errors.New(msg)
	}

	if provider == "jaeger" {
		services, err := jaeger.DecodeServicesResponse(resp)
		if err != nil {
			msg := fmt.Sprintf("[Discovery client] Invalid Jaeger services response: %s [URL: %v]", err, endpoint)
			logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
			zl.Trace().Msg(msg)
			return nil, logs, errors.New(msg)
		}
		ns := false
		vc := model.ValidConfig{Url: validEndpoint, Provider: provider, UseGRPC: false}
		for _, rd := range services {
			parts := strings.Split(rd, ".")
			if len(parts) > 1 {
				ns = true
				break
			}
		}
		if len(services) > 0 {
			vc.NamespaceSelector = &ns
		}
		msg := fmt.Sprintf("[Discovery client] Found valid Config %v", vc)
		logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
		zl.Trace().Msg(msg)
		return &vc, logs, nil
	}
	response, err := tempo.DecodeSearchResponse(resp)
	if err != nil {
		msg := "The tracing endpoint did not return a Tempo search response"
		logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
		zl.Trace().Msg(msg)
		return nil, logs, errors.New(msg)
	}
	ns := false
	vc := model.ValidConfig{Url: validEndpoint, Provider: "tempo", UseGRPC: false}
	for _, rd := range response.Traces {
		parts := strings.Split(rd.RootServiceName, ".")
		if len(parts) > 1 {
			ns = true
			break
		}
	}
	if len(response.Traces) > 0 {
		vc.NamespaceSelector = &ns
	}
	msg := fmt.Sprintf("[Discovery client] Found valid Config %v", vc)
	logs = append(logs, model.LogLine{Time: time.Now(), Test: endpoint, Result: msg})
	zl.Trace().Msg(msg)
	return &vc, logs, nil
}
