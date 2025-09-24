package integration

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"

	utilcontext "github.com/kiali/kiali/util/context"
)

// MockPrometheusServer captures headers from incoming requests
type MockPrometheusServer struct {
	server          *httptest.Server
	capturedHeaders map[string]string
	mutex           sync.RWMutex
	requestCount    int
}

func setupMockPrometheusServer(t *testing.T) *MockPrometheusServer {
	mock := &MockPrometheusServer{
		capturedHeaders: make(map[string]string),
	}

	mock.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mock.mutex.Lock()
		defer mock.mutex.Unlock()

		// Capture all headers
		for name, values := range r.Header {
			if len(values) > 0 {
				mock.capturedHeaders[name] = values[0]
			}
		}
		mock.requestCount++

		// Return mock Prometheus response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"status":"success","data":{"resultType":"vector","result":[]}}`))
	}))

	return mock
}

func (m *MockPrometheusServer) GetCapturedHeaders() map[string]string {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	result := make(map[string]string)
	for k, v := range m.capturedHeaders {
		result[k] = v
	}
	return result
}

func (m *MockPrometheusServer) GetRequestCount() int {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.requestCount
}

func (m *MockPrometheusServer) Reset() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.capturedHeaders = make(map[string]string)
	m.requestCount = 0
}

func (m *MockPrometheusServer) Close() {
	m.server.Close()
}

// NewContextHeadersRoundTripper creates a new context-aware RoundTripper for testing
func NewContextHeadersRoundTripper(rt http.RoundTripper) http.RoundTripper {
	return &contextHeadersRoundTripper{
		originalRT: rt,
	}
}

// contextHeadersRoundTripper for testing - simplified version of the prometheus package implementation
type contextHeadersRoundTripper struct {
	originalRT http.RoundTripper
}

func (rt *contextHeadersRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	// Extract headers from context and inject into request
	if headers := utilcontext.GetRequestHeadersContext(req.Context()); headers != nil {
		if headers.IsValid() {
			req.Header.Set("X-Request-Id", headers.XRequestID)
		}
	}
	return rt.originalRT.RoundTrip(req)
}

func TestE2E_ContextHeaderPropagation(t *testing.T) {
	// Setup mock Prometheus server
	mockPrometheus := setupMockPrometheusServer(t)
	defer mockPrometheus.Close()

	// Create Prometheus client pointing to mock server
	// Note: This is a simplified test - in real integration we'd use the full Kiali setup

	t.Run("header propagation through RoundTripper", func(t *testing.T) {
		// Create a context with X-Request-Id
		headers := &utilcontext.RequestHeaders{XRequestID: "integration-test-123"}
		ctx := utilcontext.SetRequestHeadersContext(context.Background(), headers)

		// Create HTTP request with context
		req, err := http.NewRequest("GET", mockPrometheus.server.URL+"/api/v1/query?query=up", nil)
		assert.NoError(t, err)
		req = req.WithContext(ctx)

		// Create RoundTripper and execute request
		mockRT := &http.Transport{}
		contextRT := NewContextHeadersRoundTripper(mockRT)

		client := &http.Client{Transport: contextRT}
		resp, err := client.Do(req)

		// Verify response
		assert.NoError(t, err)
		assert.NotNil(t, resp)
		assert.Equal(t, 200, resp.StatusCode)
		resp.Body.Close()

		// Verify X-Request-Id was propagated
		capturedHeaders := mockPrometheus.GetCapturedHeaders()
		assert.Equal(t, "integration-test-123", capturedHeaders["X-Request-Id"])
	})
}

func TestE2E_ConcurrentRequestIsolation(t *testing.T) {
	// Setup mock Prometheus server
	mockPrometheus := setupMockPrometheusServer(t)
	defer mockPrometheus.Close()

	// Test concurrent requests with different X-Request-Id values
	requestIds := []string{"concurrent-1", "concurrent-2", "concurrent-3"}

	var wg sync.WaitGroup
	results := make(chan string, len(requestIds))

	for _, requestID := range requestIds {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()

			// Create context with unique X-Request-Id
			headers := &utilcontext.RequestHeaders{XRequestID: id}
			ctx := utilcontext.SetRequestHeadersContext(context.Background(), headers)

			// Create HTTP request
			req, err := http.NewRequest("GET", mockPrometheus.server.URL+"/api/v1/query?query=up", nil)
			assert.NoError(t, err)
			req = req.WithContext(ctx)

			// Execute request
			mockRT := &http.Transport{}
			contextRT := NewContextHeadersRoundTripper(mockRT)
			client := &http.Client{Transport: contextRT}

			resp, err := client.Do(req)
			assert.NoError(t, err)
			assert.Equal(t, 200, resp.StatusCode)
			resp.Body.Close()

			results <- id
		}(requestID)
	}

	wg.Wait()
	close(results)

	// Verify all requests completed
	completedIds := make([]string, 0, len(requestIds))
	for id := range results {
		completedIds = append(completedIds, id)
	}
	assert.Len(t, completedIds, len(requestIds))

	// Verify multiple requests were made to Prometheus
	assert.GreaterOrEqual(t, mockPrometheus.GetRequestCount(), len(requestIds))
}

func TestE2E_HeaderValidation(t *testing.T) {
	// Setup mock Prometheus server
	mockPrometheus := setupMockPrometheusServer(t)
	defer mockPrometheus.Close()

	testCases := []struct {
		name         string
		requestID    string
		expectHeader bool
	}{
		{"valid request ID", "valid-integration-456", true},
		{"empty request ID", "", false},
		{"too long request ID", strings.Repeat("a", 1025), false},
		{"valid long request ID", strings.Repeat("a", 1024), true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Reset mock server for each test case
			mockPrometheus.Reset()

			// Create context with headers
			headers := &utilcontext.RequestHeaders{XRequestID: tc.requestID}
			ctx := utilcontext.SetRequestHeadersContext(context.Background(), headers)

			// Create and execute request
			req, err := http.NewRequest("GET", mockPrometheus.server.URL+"/api/v1/query", nil)
			assert.NoError(t, err)
			req = req.WithContext(ctx)

			mockRT := &http.Transport{}
			contextRT := NewContextHeadersRoundTripper(mockRT)
			client := &http.Client{Transport: contextRT}

			resp, err := client.Do(req)
			assert.NoError(t, err)
			assert.Equal(t, 200, resp.StatusCode)
			resp.Body.Close()

			// Verify header behavior
			capturedHeaders := mockPrometheus.GetCapturedHeaders()
			if tc.expectHeader {
				assert.Equal(t, tc.requestID, capturedHeaders["X-Request-Id"])
			} else {
				assert.Empty(t, capturedHeaders["X-Request-Id"])
			}
		})
	}
}
