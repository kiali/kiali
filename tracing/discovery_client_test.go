package tracing

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tracing/jaeger/model"
	"github.com/kiali/kiali/tracing/otel"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
	"github.com/kiali/kiali/util/httputil"
)

func fakeK8sNs() kubernetes.UserClientInterface {
	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = false
	return k8s
}

func TestCreateClient(t *testing.T) {

	k8s := fakeK8sNs()
	conf := config.Get()
	tc, err := DiagnoseTracingConfig(context.TODO(), conf, k8s.GetToken())

	assert.Nil(t, err)
	assert.NotNil(t, tc)
}

func TestParseUrlValidWithPort(t *testing.T) {
	url := "http://localhost:8080/test/path"

	parsed, logs, err := parseUrl(url)

	assert.Nil(t, err)
	assert.Equal(t, "localhost", parsed.Host)
	assert.Equal(t, "8080", parsed.Port)
	assert.Equal(t, "http://localhost:8080", parsed.BaseUrl)
	assert.Equal(t, "/test/path", parsed.Path)
	assert.Equal(t, "http", parsed.Scheme)

	assert.Len(t, logs, 1)
	assert.Contains(t, logs[0].Result, "[Ok]")
}

func TestParseUrlValidWithoutPort(t *testing.T) {
	url := "https://example.com/api"

	parsed, logs, err := parseUrl(url)

	assert.Nil(t, err)
	assert.Equal(t, "example.com", parsed.Host)
	assert.Equal(t, "", parsed.Port)
	assert.Equal(t, "https://example.com", parsed.BaseUrl)
	assert.Equal(t, "/api", parsed.Path)
	assert.Equal(t, "https", parsed.Scheme)

	assert.Len(t, logs, 1)
	assert.Contains(t, logs[0].Result, "[Ok]")
}

type mockConn struct{}

func (m *mockConn) Read(b []byte) (n int, err error)   { return 0, nil }
func (m *mockConn) Write(b []byte) (n int, err error)  { return len(b), nil }
func (m *mockConn) Close() error                       { return nil }
func (m *mockConn) LocalAddr() net.Addr                { return nil }
func (m *mockConn) RemoteAddr() net.Addr               { return nil }
func (m *mockConn) SetDeadline(t time.Time) error      { return nil }
func (m *mockConn) SetReadDeadline(t time.Time) error  { return nil }
func (m *mockConn) SetWriteDeadline(t time.Time) error { return nil }

func TestDiscoverPortsWithDial(t *testing.T) {
	mockDial := func(network, address string, timeout time.Duration) (net.Conn, error) {
		// Simulate only port 80 and 443 being open
		if address == "localhost:80" || address == "localhost:443" {
			return &mockConn{}, nil
		}
		return nil, errors.New("connection refused")
	}
	zl := log.WithGroup(log.TracingLogName)
	openPorts, logs := discoverPortsWithDial(zl, "localhost", mockDial)

	expectedPorts := map[string]bool{
		"80":  true,
		"443": true,
	}

	assert.Equal(t, len(expectedPorts), 2)
	assert.Equal(t, expectedPorts["80"], true)

	for _, port := range openPorts {
		assert.True(t, expectedPorts[port])
		assert.True(t, expectedPorts[port])
	}
	assert.Equal(t, len(logs), 2)
}

func mockMakeRequest(ctx context.Context, client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
	switch endpoint {
	case "http://tempo-host:3100/api/search?q={}":
		resp := []byte(`{"traces":[{"rootServiceName":"service.namespace"}]}`)
		return resp, 200, nil
	case "http://tempo-host:3100/api/services":
		resp := []byte(`{"data":["service.namespace"]}`)
		return resp, 200, nil
	default:
		return nil, 500, errors.New("mock error")
	}
}

func TestValidateSimpleTempoHTTP(t *testing.T) {
	// Override the global MakeRequest with the mock version
	MakeRequestFunc = mockMakeRequest
	defer func() { MakeRequestFunc = otel.MakeRequest }() // restore after test

	client := http.Client{}
	zl := log.WithGroup(log.TracingLogName)
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "tempo-host",
	}
	port := "3100"

	validConfigs, logs := validateSimpleTempoHTTP(context.TODO(), client, zl, parsedUrl, port, true)

	assert.Len(t, validConfigs, 2, "Should detect two valid configs")
	assert.Equal(t, "tempo", validConfigs[0].Provider)
	assert.Equal(t, "jaeger", validConfigs[1].Provider)

	assert.True(t, *validConfigs[0].NamespaceSelector)
	assert.True(t, *validConfigs[1].NamespaceSelector)

	assert.Equal(t, "http://tempo-host:3100", validConfigs[0].Url)
	assert.Equal(t, "http://tempo-host:3100", validConfigs[1].Url)
	assert.Greater(t, len(logs), 0)
}

// Mock for MakeRequest that simulates HTTP responses
func mockMakeRequestTempo(ctx context.Context, client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
	switch endpoint {
	case "http://gateway-host:3100/api/traces/v1/tenantA/tempo/api/search?q={}":
		return []byte(`{"traces":[{"rootServiceName":"svc.namespace"}]}`), 200, nil
	case "http://gateway-host:3100/api/traces/v1/tenantA/api/services":
		return []byte(`{"data":["svc.namespace"]}`), 200, nil
	case "http://tempo-host:3100/api/traces/v1/tempo/api/search?q={}":
		return []byte(`{"traces":[{"rootServiceName":"svc.namespace"}]}`), 200, nil
	case "http://tempo-host:3100/api/search?q={}":
		return []byte(`{"traces":[{"rootServiceName":"svc.namespace"}]}`), 200, nil
	case "http://tempo-host:3100/api/services":
		return []byte(`{"data":["svc.namespace"]}`), 200, nil
	case "http://tempo-host:3100/api/traces/v1/api/services":
		return []byte(`{"data":["svc.namespace"]}`), 200, nil
	default:
		return nil, 500, errors.New("not found")
	}
}

func TestValidateTempoHTTP_WithGateway(t *testing.T) {
	MakeRequestFunc = mockMakeRequestTempo
	defer func() { MakeRequestFunc = otel.MakeRequest }()

	client := http.Client{}
	zl := log.WithGroup(log.TracingLogName)
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "gateway-host",
		Path:   "/api/traces/v1/tenantA", // path includes tenant
	}
	port := "3100"

	validConfigs, logs := validateTempoHTTP(context.TODO(), client, zl, parsedUrl, port, "")

	assert.Len(t, validConfigs, 2)
	assert.Equal(t, "tempo", validConfigs[0].Provider)
	assert.Equal(t, "jaeger", validConfigs[1].Provider)
	assert.Greater(t, len(logs), 0)
}

func TestValidateTempoHTTP_WithoutGateway(t *testing.T) {
	MakeRequestFunc = mockMakeRequestTempo
	defer func() { MakeRequestFunc = otel.MakeRequest }()

	client := http.Client{}
	zl := log.WithGroup(log.TracingLogName)
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "tempo-host",
		Path:   "",
	}
	port := "3100"

	validConfigs, logs := validateTempoHTTP(context.TODO(), client, zl, parsedUrl, port, "")

	assert.Len(t, validConfigs, 2)
	assert.Equal(t, "tempo", validConfigs[0].Provider)
	assert.Equal(t, "jaeger", validConfigs[1].Provider)
	assert.Greater(t, len(logs), 0)
}

func TestValidateTempoHTTP_GatewayMissingTenant(t *testing.T) {
	MakeRequestFunc = mockMakeRequestTempo
	defer func() { MakeRequestFunc = otel.MakeRequest }()

	client := http.Client{}
	zl := log.WithGroup(log.TracingLogName)
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "gateway-host",
		Path:   "/api/traces/v1", // No tenant segment
	}
	port := "3100"

	validConfigs, logs := validateTempoHTTP(context.TODO(), client, zl, parsedUrl, port, "")

	// Should fail due to missing tenant
	assert.Len(t, validConfigs, 0)
	assert.True(t, anyLogContains(logs, "tenant name not found"))
}

// helper to check logs
func anyLogContains(logs []model.LogLine, substr string) bool {
	for _, l := range logs {
		if strings.Contains(l.Result, substr) {
			return true
		}
	}
	return false
}

// Mock MakeRequest for Jaeger scenarios
func mockMakeRequestJaeger(ctx context.Context, client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
	switch endpoint {
	case "http://jaeger-host:16686/jaeger/api/services":
		return []byte(`{"data":["svc.namespace"]}`), 200, nil
	case "http://jaeger-host:16686/api/services":
		return []byte(`{"data":["svc.namespace"]}`), 200, nil
	default:
		return nil, 404, errors.New("not found")
	}
}

func TestValidateJaegerHTTP_SuccessfulBothEndpoints(t *testing.T) {
	MakeRequestFunc = mockMakeRequestJaeger
	defer func() { MakeRequestFunc = otel.MakeRequest }()

	client := http.Client{}
	zl := log.WithGroup(log.TracingLogName)
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "jaeger-host",
	}
	port := "16686"

	validConfigs, logs := validateJaegerHTTP(context.TODO(), client, zl, parsedUrl, port)

	assert.Len(t, validConfigs, 2)
	assert.Equal(t, "jaeger", validConfigs[0].Provider)
	assert.Equal(t, "jaeger", validConfigs[1].Provider)
	assert.GreaterOrEqual(t, len(logs), 2)
	assert.True(t, *validConfigs[0].NamespaceSelector)
	assert.True(t, *validConfigs[1].NamespaceSelector)
}

func TestValidateJaegerHTTP_OnlyOneSuccess(t *testing.T) {
	MakeRequestFunc = func(ctx context.Context, client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
		if endpoint == "http://jaeger-host:16686/jaeger/api/services" {
			return nil, 500, errors.New("fail")
		}
		if endpoint == "http://jaeger-host:16686/api/services" {
			return []byte(`{"data":["svc.namespace"]}`), 200, nil
		}
		return nil, 404, errors.New("not found")
	}
	defer func() { MakeRequestFunc = otel.MakeRequest }()

	client := http.Client{}
	zl := log.WithGroup(log.TracingLogName)
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "jaeger-host",
	}
	port := "16686"

	validConfigs, logs := validateJaegerHTTP(context.TODO(), client, zl, parsedUrl, port)

	assert.Len(t, validConfigs, 1)
	assert.Equal(t, "jaeger", validConfigs[0].Provider)
	assert.GreaterOrEqual(t, len(logs), 1)
}

func TestValidateJaegerHTTP_NoSuccess(t *testing.T) {
	MakeRequestFunc = func(ctx context.Context, client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
		return nil, 500, errors.New("mock failure")
	}
	defer func() { MakeRequestFunc = otel.MakeRequest }()

	client := http.Client{}
	zl := log.WithGroup(log.TracingLogName)
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "jaeger-host",
	}
	port := "16686"

	validConfigs, logs := validateJaegerHTTP(context.TODO(), client, zl, parsedUrl, port)

	assert.Len(t, validConfigs, 0)
	assert.GreaterOrEqual(t, len(logs), 2)
}

type tempoProbeServer struct {
	tempopb.UnimplementedStreamingQuerierServer
	code codes.Code
}

func (s *tempoProbeServer) Search(_ *tempopb.SearchRequest, _ tempopb.StreamingQuerier_SearchServer) error {
	// Finish without sending a reply. A clean end is valid for an empty result.
	return status.Error(s.code, "synthetic terminal status")
}

func TestDiscoverTempoGRPCPreservesProbeStatus(t *testing.T) {
	for _, tc := range []struct {
		candidate bool
		code      codes.Code
		log       string
		name      string
		warning   string
	}{
		{name: "clean empty stream", code: codes.OK, candidate: true, log: "Tracing gRPC backend found"},
		{name: "deadline before first reply", code: codes.DeadlineExceeded, log: "Timed out verifying the gRPC backend"},
		{name: "authentication rejected", code: codes.Unauthenticated, candidate: true, log: discoveryAuthWarning, warning: discoveryAuthWarning},
	} {
		t.Run(tc.name, func(t *testing.T) {
			listener, err := net.Listen("tcp4", "127.0.0.1:0")
			require.NoError(t, err)
			host, port, err := net.SplitHostPort(listener.Addr().String())
			require.NoError(t, err)
			server := grpc.NewServer()
			tempopb.RegisterStreamingQuerierServer(server, &tempoProbeServer{code: tc.code})
			go func() { _ = server.Serve(listener) }()
			t.Cleanup(server.Stop)

			candidates, logs := discoverGRPC(t.Context(), config.NewConfig(), model.ParsedUrl{Host: host, Scheme: "http"}, port, config.TempoProvider)
			require.True(t, anyLogContains(logs, tc.log))
			if !tc.candidate {
				require.Empty(t, candidates)
				return
			}
			require.Len(t, candidates, 1)
			assert.Equal(t, "tempo", candidates[0].Provider)
			assert.True(t, candidates[0].UseGRPC)
			if tc.warning != "" {
				assert.Equal(t, tc.warning, candidates[0].Warning)
			}
		})
	}
}

func TestDiscoveryRequiresJaegerServicesArray(t *testing.T) {
	for _, tc := range []struct {
		body              string
		name              string
		namespaceSelector *bool
		valid             bool
	}{
		{name: "empty services array", body: `{"data":[]}`, valid: true},
		{name: "namespace-qualified service", body: `{"data":["reviews.bookinfo"]}`, namespaceSelector: new(true), valid: true},
		{name: "unqualified service", body: `{"data":["reviews"]}`, namespaceSelector: new(false), valid: true},
		{name: "unrelated JSON", body: `{"status":"ok"}`},
		{name: "null data", body: `{"data":null}`},
		{name: "data is not an array", body: `{"data":{}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/api/services", r.URL.Path)
				_, _ = io.WriteString(w, tc.body)
			}))
			t.Cleanup(server.Close)

			conf := config.NewConfig()
			conf.ExternalServices.Tracing = config.TracingConfig{
				Auth:              config.Auth{Type: config.AuthTypeNone},
				Enabled:           true,
				InternalURL:       server.URL,
				NamespaceSelector: false,
				Provider:          config.JaegerProvider,
			}
			_, verifyErr := verifyDeployedTracing(t.Context(), conf, "")

			zl := log.WithGroup(log.TracingLogName)
			candidate, _, discoverErr := validateEndpoint(t.Context(), *server.Client(), zl, server.URL+"/api/services", server.URL, "jaeger")
			if tc.valid {
				require.NoError(t, verifyErr)
				require.NoError(t, discoverErr)
				require.NotNil(t, candidate)
				candidateURL, err := parseDiscoveryURL(server.URL)
				require.NoError(t, err)
				merged := mergeVerifiedTracingConfig([]model.ValidConfig{*candidate}, conf.ExternalServices.Tracing, *candidateURL)
				require.Len(t, merged, 1)
				assert.Equal(t, config.AuthTypeNone, merged[0].AuthType)
				assert.Equal(t, tc.namespaceSelector, merged[0].NamespaceSelector)
			} else {
				require.Error(t, verifyErr)
				require.Error(t, discoverErr)
				require.Nil(t, candidate)
			}
		})
	}
}

func TestDiscoveryProbesRootJaegerEndpointOnce(t *testing.T) {
	for _, configuredURL := range []string{"https://jaeger-host", "https://jaeger-host:443", "http://jaeger-host"} {
		t.Run(configuredURL, func(t *testing.T) {
			parsed, _, err := parseUrl(configuredURL)
			require.NoError(t, err)
			port := "443"
			if parsed.Scheme == "http" {
				port = "80"
			}
			rootServicesURL := discoveredOrigin(*parsed, port) + "/api/services"
			requests := 0
			MakeRequestFunc = func(_ context.Context, _ http.Client, endpoint string, _ io.Reader) ([]byte, int, error) {
				if endpoint == rootServicesURL {
					requests++
					return nil, http.StatusUnauthorized, nil
				}
				return nil, http.StatusNotFound, nil
			}
			t.Cleanup(func() { MakeRequestFunc = otel.MakeRequest })

			conf := config.NewConfig()
			conf.ExternalServices.Tracing.Provider = config.JaegerProvider
			conf.ExternalServices.Tracing.UseGRPC = false
			zl := log.WithGroup(log.TracingLogName)
			candidates, _ := discoverURL(t.Context(), conf, zl, *parsed, []string{port})
			assert.Equal(t, 1, requests)
			require.Len(t, candidates, 1)
			assert.Equal(t, discoveryAuthWarning, candidates[0].Warning)

			merged := mergeVerifiedTracingConfig(candidates, conf.ExternalServices.Tracing, *parsed.Url)
			require.Len(t, merged, 1)
			assert.Equal(t, configuredURL, merged[0].Url)
			assert.Empty(t, merged[0].Warning)
		})
	}
}

func TestDiscoveryDeduplicatesAcrossHTTPAndHTTPSPorts(t *testing.T) {
	for _, tc := range []struct {
		name      string
		directTLS bool
	}{
		{name: "both probes require authentication"},
		{name: "direct probe provides service names", directTLS: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			const configuredURL = "https://jaeger-host:443"
			parsed, _, err := parseUrl(configuredURL)
			require.NoError(t, err)
			MakeRequestFunc = func(ctx context.Context, client http.Client, endpoint string, _ io.Reader) ([]byte, int, error) {
				switch endpoint {
				case "http://jaeger-host:80/api/services":
					from, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
					require.NoError(t, err)
					to, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://jaeger-host/api/services", nil)
					require.NoError(t, err)
					require.NoError(t, client.CheckRedirect(to, []*http.Request{from}))
					return nil, http.StatusUnauthorized, nil
				case configuredURL + "/api/services":
					if tc.directTLS {
						return []byte(`{"data":["reviews.bookinfo"]}`), http.StatusOK, nil
					}
					return nil, http.StatusUnauthorized, nil
				default:
					return nil, http.StatusNotFound, nil
				}
			}
			t.Cleanup(func() { MakeRequestFunc = otel.MakeRequest })

			conf := config.NewConfig()
			conf.ExternalServices.Tracing.Provider = config.JaegerProvider
			conf.ExternalServices.Tracing.UseGRPC = false
			conf.ExternalServices.Tracing.NamespaceSelector = false
			zl := log.WithGroup(log.TracingLogName)
			candidates, _ := discoverURL(t.Context(), conf, zl, *parsed, []string{"80", "443"})
			require.Len(t, candidates, 1)
			if tc.directTLS {
				assert.Empty(t, candidates[0].Warning)
			} else {
				assert.Equal(t, discoveryAuthWarning, candidates[0].Warning)
			}

			verified := mergeVerifiedTracingConfig(candidates, conf.ExternalServices.Tracing, *parsed.Url)
			require.Len(t, verified, 1)
			assert.Equal(t, configuredURL, verified[0].Url)
			assert.Empty(t, verified[0].Warning)
			if tc.directTLS {
				require.NotNil(t, verified[0].NamespaceSelector)
				assert.True(t, *verified[0].NamespaceSelector)
			}
		})
	}
}

func TestDiscoverySeparatesCandidateAndConfiguredCredentials(t *testing.T) {
	var anonymousProbes, authenticatedProbes atomic.Int32
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/candidate/"):
			anonymousProbes.Add(1)
			assert.Empty(t, r.Header.Get("Authorization"))
			assert.Empty(t, r.Header.Get("X-Tracing-Secret"))
			http.Error(w, "private backend response", http.StatusUnauthorized)
		case r.URL.Path == "/api/services":
			authenticatedProbes.Add(1)
			assert.Equal(t, "Bearer test-service-account", r.Header.Get("Authorization"))
			assert.Equal(t, "test-header", r.Header.Get("X-Tracing-Secret"))
			http.Redirect(w, r, "/canonical/api/services", http.StatusFound)
		case r.URL.Path == "/canonical/api/services":
			authenticatedProbes.Add(1)
			assert.Equal(t, "Bearer test-service-account", r.Header.Get("Authorization"))
			assert.Equal(t, "test-header", r.Header.Get("X-Tracing-Secret"))
			_, _ = io.WriteString(w, "{\"data\":[\"service.namespace\"]}")
		default:
			t.Errorf("unexpected discovery path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(backend.Close)

	// Reuse the fixture for candidate traffic. The configured check uses the
	// real tracing client and contacts the active URL as configured.
	MakeRequestFunc = func(ctx context.Context, client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
		return otel.MakeRequest(ctx, client, backend.URL+"/candidate/"+strings.TrimPrefix(endpoint, "http://"), body)
	}
	t.Cleanup(func() { MakeRequestFunc = otel.MakeRequest })

	conf := config.NewConfig()
	conf.ExternalServices.Tracing = config.TracingConfig{
		Auth:          config.Auth{Type: config.AuthTypeBearer, UseKialiToken: true},
		CustomHeaders: map[string]string{"X-Tracing-Secret": "test-header"},
		Enabled:       true,
		InternalURL:   backend.URL,
		Provider:      config.JaegerProvider,
		QueryTimeout:  2,
	}
	dial := func(_ string, address string, _ time.Duration) (net.Conn, error) {
		if strings.HasSuffix(address, ":16686") {
			return &mockConn{}, nil
		}
		return nil, errors.New("port unavailable in discovery fixture")
	}

	result, err := diagnoseTracingConfig(t.Context(), conf, "test-service-account", dial)
	require.NoError(t, err)
	assert.EqualValues(t, 2, anonymousProbes.Load())
	assert.EqualValues(t, 2, authenticatedProbes.Load())
	assert.True(t, anyLogContains(result.LogLine, "Configured tracing backend verified"))
	assert.True(t, anyLogContains(result.LogLine, discoveryAuthWarning))
	assert.False(t, anyLogContains(result.LogLine, "private backend response"))
	require.NotEmpty(t, result.ValidConfig)
	assert.Equal(t, backend.URL, result.ValidConfig[len(result.ValidConfig)-1].Url)
}

func TestDiscoveryRequiresTempoSearchResponse(t *testing.T) {
	for _, tc := range []struct {
		body  string
		name  string
		valid bool
	}{
		{name: "empty traces array", body: `{"traces":[]}`, valid: true},
		{name: "metrics only", body: `{"metrics":{}}`, valid: true},
		{name: "unrelated JSON", body: `{"status":"ok"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_, _ = io.WriteString(w, tc.body)
			}))
			t.Cleanup(server.Close)

			zl := log.WithGroup(log.TracingLogName)
			candidate, _, err := validateEndpoint(t.Context(), *server.Client(), zl, server.URL+"/api/search", server.URL, "tempo")
			if !tc.valid {
				require.Error(t, err)
				assert.Nil(t, candidate)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, candidate)
			assert.Nil(t, candidate.NamespaceSelector)
		})
	}
}

func TestConfiguredTracingProbeLogsBackendAddress(t *testing.T) {
	const queryValue = "synthetic-backend-query-value"
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, queryValue, r.URL.Query().Get("token"))
		if r.URL.Path == "/api/search" {
			_, _ = io.WriteString(w, `{"status":"ok"}`)
		}
	}))
	t.Cleanup(backend.Close)

	conf := config.NewConfig()
	conf.ExternalServices.Tracing = config.TracingConfig{
		Enabled:     true,
		InternalURL: backend.URL + "?token=" + queryValue,
		Provider:    config.TempoProvider,
	}
	var logs bytes.Buffer
	logger := zerolog.New(&logs).Level(zerolog.TraceLevel)
	readiness, err := verifyDeployedTracing(log.ToContext(t.Context(), &logger), conf, "")

	require.Error(t, err)
	require.NotNil(t, readiness)
	assert.Equal(t, model.TracingProbePassed, readiness.Status)
	assert.Contains(t, logs.String(), "Create Tracing HTTP client")
	assert.Contains(t, logs.String(), "Invalid search response")
	assert.Contains(t, logs.String(), strings.TrimPrefix(backend.URL, "http://"))
	assert.NotContains(t, logs.String(), queryValue)
}

func TestDiscoveryReportsTempoReadinessAndQuerySeparately(t *testing.T) {
	for _, tc := range []struct {
		name            string
		queryCode       int
		queryStatus     model.TracingProbeStatus
		readinessCode   int
		readinessStatus model.TracingProbeStatus
		sameOrigin      bool
	}{
		{"ready endpoint and failed query", http.StatusServiceUnavailable, model.TracingProbeFailed, http.StatusOK, model.TracingProbePassed, false},
		{"readiness requires authentication", http.StatusOK, model.TracingProbePassed, http.StatusUnauthorized, model.TracingProbeUnverified, false},
		{"readiness unavailable and query works", http.StatusOK, model.TracingProbePassed, http.StatusServiceUnavailable, model.TracingProbeFailed, false},
		{"authenticated readiness on query origin", http.StatusOK, model.TracingProbePassed, http.StatusOK, model.TracingProbePassed, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			const wantToken = "Bearer synthetic-tracing-token"
			const wantHeader = "synthetic-tracing-header"
			var readinessRequests, queryRequests atomic.Int32
			readinessHandler := func(w http.ResponseWriter, r *http.Request) {
				readinessRequests.Add(1)
				if tc.sameOrigin {
					assert.Equal(t, wantToken, r.Header.Get("Authorization"))
					assert.Equal(t, wantHeader, r.Header.Get("X-Tracing-Secret"))
				} else {
					assert.Empty(t, r.Header.Get("Authorization"))
					assert.Empty(t, r.Header.Get("X-Tracing-Secret"))
				}
				w.WriteHeader(tc.readinessCode)
			}
			queryBackend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/ready" && tc.sameOrigin {
					readinessHandler(w, r)
					return
				}
				queryRequests.Add(1)
				assert.Equal(t, "/tempo/api/search", r.URL.Path)
				assert.Equal(t, "1", r.URL.Query().Get("limit"))
				assert.Equal(t, wantToken, r.Header.Get("Authorization"))
				assert.Equal(t, wantHeader, r.Header.Get("X-Tracing-Secret"))
				w.WriteHeader(tc.queryCode)
				_, _ = io.WriteString(w, `{"traces":[]}`)
			}))
			t.Cleanup(queryBackend.Close)
			readinessURL := queryBackend.URL + "/ready"
			if !tc.sameOrigin {
				readinessBackend := httptest.NewServer(http.HandlerFunc(readinessHandler))
				t.Cleanup(readinessBackend.Close)
				readinessURL = readinessBackend.URL + "/ready"
			}

			conf := config.NewConfig()
			conf.ExternalServices.Tracing = config.TracingConfig{
				Auth:           config.Auth{Type: config.AuthTypeBearer, UseKialiToken: true},
				CustomHeaders:  map[string]string{"X-Tracing-Secret": wantHeader},
				Enabled:        true,
				HealthCheckUrl: readinessURL,
				InternalURL:    queryBackend.URL + "/tempo",
				Provider:       config.TempoProvider,
				QueryTimeout:   2,
			}
			dial := func(string, string, time.Duration) (net.Conn, error) {
				return nil, errors.New("skip scanning candidate ports in this fixture")
			}
			result, err := diagnoseTracingConfig(t.Context(), conf, "synthetic-tracing-token", dial)
			require.NoError(t, err)
			require.NotNil(t, result.Readiness)
			require.NotNil(t, result.QueryAPI)
			assert.Equal(t, tc.readinessStatus, result.Readiness.Status)
			assert.Equal(t, tc.readinessCode, result.Readiness.HTTPStatus)
			assert.Equal(t, tc.queryStatus, result.QueryAPI.Status)
			assert.Equal(t, tc.queryStatus == model.TracingProbePassed, anyLogContains(result.LogLine, "Configured tracing backend verified"))
			assert.EqualValues(t, 1, readinessRequests.Load())
			assert.EqualValues(t, 1, queryRequests.Load())

			if tc.readinessStatus == model.TracingProbeUnverified {
				// The shared service status can still identify a working API
				// after a separate readiness endpoint refuses anonymous access.
				client, err := newClient(t.Context(), conf, "synthetic-tracing-token", httputil.SameOriginRedirect)
				require.NoError(t, err)
				available, err := client.GetServiceStatus(t.Context())
				require.NoError(t, err)
				assert.True(t, available)
				assert.EqualValues(t, 2, readinessRequests.Load())
				assert.EqualValues(t, 2, queryRequests.Load())
			}
		})
	}
}
