package prometheus

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	utilcontext "github.com/kiali/kiali/util/context"
)

// mockRoundTripper captures the request for verification
type mockRoundTripper struct {
	capturedRequest *http.Request
	response        *http.Response
	err             error
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	// Capture the request for verification
	m.capturedRequest = req
	return m.response, m.err
}

func setupMockRoundTripper() *mockRoundTripper {
	return &mockRoundTripper{
		response: &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(strings.NewReader(`{"status":"success"}`)),
			Header:     make(http.Header),
		},
	}
}

func TestContextHeadersRoundTripper_WithXRequestId(t *testing.T) {
	// Setup
	mockRT := setupMockRoundTripper()
	contextRT := newContextHeadersRoundTripper(mockRT)

	// Create request with context containing X-Request-Id
	req, err := http.NewRequest("GET", "http://prometheus:9090/api/v1/query", nil)
	assert.NoError(t, err)

	headers := &utilcontext.RequestHeaders{XRequestID: "test-prometheus-123"}
	ctx := utilcontext.SetRequestHeadersContext(context.Background(), headers)
	req = req.WithContext(ctx)

	// Execute RoundTrip
	resp, err := contextRT.RoundTrip(req)

	// Verify response
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, 200, resp.StatusCode)

	// Verify X-Request-Id header was added
	assert.NotNil(t, mockRT.capturedRequest)
	assert.Equal(t, "test-prometheus-123", mockRT.capturedRequest.Header.Get("X-Request-Id"))
}

func TestContextHeadersRoundTripper_WithoutContext(t *testing.T) {
	// Setup
	mockRT := setupMockRoundTripper()
	contextRT := newContextHeadersRoundTripper(mockRT)

	// Create request without any context headers
	req, err := http.NewRequest("GET", "http://prometheus:9090/api/v1/query", nil)
	assert.NoError(t, err)

	// Execute RoundTrip
	resp, err := contextRT.RoundTrip(req)

	// Verify response
	assert.NoError(t, err)
	assert.NotNil(t, resp)

	// Verify no X-Request-Id header was added
	assert.NotNil(t, mockRT.capturedRequest)
	assert.Empty(t, mockRT.capturedRequest.Header.Get("X-Request-Id"))
}

func TestContextHeadersRoundTripper_WithInvalidHeaders(t *testing.T) {
	testCases := []struct {
		name         string
		requestID    string
		expectHeader bool
	}{
		{"empty request ID", "", false},
		{"too long request ID", strings.Repeat("a", 1025), false},
		{"valid long request ID", strings.Repeat("a", 1024), true},
		{"valid request ID", "valid-prometheus-123", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup
			mockRT := setupMockRoundTripper()
			contextRT := newContextHeadersRoundTripper(mockRT)

			// Create request with context containing headers
			req, err := http.NewRequest("GET", "http://prometheus:9090/api/v1/query", nil)
			assert.NoError(t, err)

			headers := &utilcontext.RequestHeaders{XRequestID: tc.requestID}
			ctx := utilcontext.SetRequestHeadersContext(context.Background(), headers)
			req = req.WithContext(ctx)

			// Execute RoundTrip
			resp, err := contextRT.RoundTrip(req)

			// Verify response
			assert.NoError(t, err)
			assert.NotNil(t, resp)

			// Verify header behavior
			if tc.expectHeader {
				assert.Equal(t, tc.requestID, mockRT.capturedRequest.Header.Get("X-Request-Id"))
			} else {
				assert.Empty(t, mockRT.capturedRequest.Header.Get("X-Request-Id"))
			}
		})
	}
}

func TestContextHeadersRoundTripper_PreservesExistingHeaders(t *testing.T) {
	// Setup
	mockRT := setupMockRoundTripper()
	contextRT := newContextHeadersRoundTripper(mockRT)

	// Create request with existing headers
	req, err := http.NewRequest("GET", "http://prometheus:9090/api/v1/query", nil)
	assert.NoError(t, err)

	req.Header.Set("Authorization", "Bearer token123")
	req.Header.Set("Content-Type", "application/json")

	// Add context headers
	headers := &utilcontext.RequestHeaders{XRequestID: "preserve-prometheus-456"}
	ctx := utilcontext.SetRequestHeadersContext(context.Background(), headers)
	req = req.WithContext(ctx)

	// Execute RoundTrip
	resp, err := contextRT.RoundTrip(req)

	// Verify response
	assert.NoError(t, err)
	assert.NotNil(t, resp)

	// Verify all headers are preserved
	capturedReq := mockRT.capturedRequest
	assert.Equal(t, "Bearer token123", capturedReq.Header.Get("Authorization"))
	assert.Equal(t, "application/json", capturedReq.Header.Get("Content-Type"))
	assert.Equal(t, "preserve-prometheus-456", capturedReq.Header.Get("X-Request-Id"))
}
