package tracing

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/tracing/jaeger/model"
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
	tc, err := TestNewClient(context.TODO(), conf, k8s.GetToken())

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

	openPorts, logs := discoverPortsWithDial("localhost", mockDial)

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

func mockMakeRequest(client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
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
	MakeRequestI = mockMakeRequest
	defer func() { MakeRequestI = MakeRequest }() // restore after test

	client := http.Client{}
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "tempo-host",
	}
	port := "3100"

	validConfigs, logs := validateSimpleTempoHTTP(client, parsedUrl, port)

	assert.Len(t, validConfigs, 2, "Should detect two valid configs")
	assert.Equal(t, "tempo", validConfigs[0].Provider)
	assert.Equal(t, "jaeger", validConfigs[1].Provider)

	assert.True(t, validConfigs[0].NamespaceSelector)
	assert.True(t, validConfigs[1].NamespaceSelector)

	assert.Equal(t, "http://tempo-host:3100", validConfigs[0].Url)
	assert.Equal(t, "http://tempo-host:3100", validConfigs[1].Url)
	assert.Greater(t, len(logs), 0)
}

// Mock for MakeRequest that simulates HTTP responses
func mockMakeRequestTempo(client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
	switch endpoint {
	case "http://gateway-host:3100/api/traces/v1/tenantA/tempo/api/search?q={}":
		return []byte(`{"traces":[{"rootServiceName":"svc.namespace"}]}`), 200, nil
	case "http://gateway-host:3100/api/traces/v1/tenantA/api/services":
		return []byte(`{"data":["svc.namespace"]}`), 200, nil
	case "http://tempo-host:3100/api/traces/v1/tempo/api/search?q={}":
		return []byte(`{"traces":[{"rootServiceName":"svc.namespace"}]}`), 200, nil
	case "http://tempo-host:3100/api/traces/v1/api/traces/v1/api/services":
		return []byte(`{"data":["svc.namespace"]}`), 200, nil
	default:
		return nil, 500, errors.New("not found")
	}
}

func TestValidateTempoHTTP_WithGateway(t *testing.T) {
	MakeRequestI = mockMakeRequestTempo
	defer func() { MakeRequestI = MakeRequest }()

	client := http.Client{}
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "gateway-host",
		Path:   "/api/traces/v1/tenantA", // path includes tenant
	}
	port := "3100"

	validConfigs, logs := validateTempoHTTP(client, parsedUrl, port)

	assert.Len(t, validConfigs, 2)
	assert.Equal(t, "tempo", validConfigs[0].Provider)
	assert.Equal(t, "jaeger", validConfigs[1].Provider)
	assert.Greater(t, len(logs), 0)
}

func TestValidateTempoHTTP_WithoutGateway(t *testing.T) {
	MakeRequestI = mockMakeRequestTempo
	defer func() { MakeRequestI = MakeRequest }()

	client := http.Client{}
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "tempo-host",
		Path:   "",
	}
	port := "3100"

	validConfigs, logs := validateTempoHTTP(client, parsedUrl, port)

	assert.Len(t, validConfigs, 2)
	assert.Equal(t, "tempo", validConfigs[0].Provider)
	assert.Equal(t, "jaeger", validConfigs[1].Provider)
	assert.Greater(t, len(logs), 0)
}

func TestValidateTempoHTTP_GatewayMissingTenant(t *testing.T) {
	MakeRequestI = mockMakeRequestTempo
	defer func() { MakeRequestI = MakeRequest }()

	client := http.Client{}
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "gateway-host",
		Path:   "/api/traces/v1", // No tenant segment
	}
	port := "3100"

	validConfigs, logs := validateTempoHTTP(client, parsedUrl, port)

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
func mockMakeRequestJaeger(client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
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
	MakeRequestI = mockMakeRequestJaeger
	defer func() { MakeRequestI = MakeRequest }()

	client := http.Client{}
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "jaeger-host",
	}
	port := "16686"

	validConfigs, logs := validateJaegerHTTP(client, parsedUrl, port)

	assert.Len(t, validConfigs, 2)
	assert.Equal(t, "jaeger", validConfigs[0].Provider)
	assert.Equal(t, "jaeger", validConfigs[1].Provider)
	assert.GreaterOrEqual(t, len(logs), 2)
	assert.True(t, validConfigs[0].NamespaceSelector)
	assert.True(t, validConfigs[1].NamespaceSelector)
}

func TestValidateJaegerHTTP_OnlyOneSuccess(t *testing.T) {
	MakeRequestI = func(client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
		if endpoint == "http://jaeger-host:16686/jaeger/api/services" {
			return nil, 500, errors.New("fail")
		}
		if endpoint == "http://jaeger-host:16686/api/services" {
			return []byte(`{"data":["svc.namespace"]}`), 200, nil
		}
		return nil, 404, errors.New("not found")
	}
	defer func() { MakeRequestI = MakeRequest }()

	client := http.Client{}
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "jaeger-host",
	}
	port := "16686"

	validConfigs, logs := validateJaegerHTTP(client, parsedUrl, port)

	assert.Len(t, validConfigs, 1)
	assert.Equal(t, "jaeger", validConfigs[0].Provider)
	assert.GreaterOrEqual(t, len(logs), 1)
}

func TestValidateJaegerHTTP_NoSuccess(t *testing.T) {
	MakeRequestI = func(client http.Client, endpoint string, body io.Reader) ([]byte, int, error) {
		return nil, 500, errors.New("mock failure")
	}
	defer func() { MakeRequestI = MakeRequest }()

	client := http.Client{}
	parsedUrl := model.ParsedUrl{
		Scheme: "http",
		Host:   "jaeger-host",
	}
	port := "16686"

	validConfigs, logs := validateJaegerHTTP(client, parsedUrl, port)

	assert.Len(t, validConfigs, 0)
	assert.GreaterOrEqual(t, len(logs), 2)
}
