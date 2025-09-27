package routing

import (
	"io"
	"net/http"
	"net/http/httptest"
	rpprof "runtime/pprof"
	"testing"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog/hlog"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	utilcontext "github.com/kiali/kiali/util/context"
	"github.com/kiali/kiali/util/filetest"
)

func TestDrawPathProperly(t *testing.T) {
	conf := new(config.Config)
	mockClientFactory := kubetest.NewK8SClientFactoryMock(kubetest.NewFakeK8sClient())
	router, _ := NewRouter(conf, nil, mockClientFactory, nil, nil, nil, nil, nil, nil, filetest.StaticAssetDir(t))
	testRoute(router, "Root", "GET", t)
}

func testRoute(router *mux.Router, name string, method string, t *testing.T) {
	path := router.Get(name)

	if path == nil {
		t.Error("path is not registered into router")
	}

	methods, err := path.GetMethods()
	if err != nil {
		t.Error(err)
	}

	if len(methods) != 1 && methods[0] != method {
		t.Error("Root path is not registered with method")
	}
}

func TestWebRootRedirect(t *testing.T) {
	conf := new(config.Config)
	conf.Server.WebRoot = "/test"

	mockClientFactory := kubetest.NewK8SClientFactoryMock(kubetest.NewFakeK8sClient())
	router, _ := NewRouter(conf, nil, mockClientFactory, nil, nil, nil, nil, nil, nil, filetest.StaticAssetDir(t))
	ts := httptest.NewServer(router)
	defer ts.Close()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(ts.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	// body, _ := ioutil.ReadAll(resp.Body)
	assert.Equal(t, 302, resp.StatusCode, "Response should redirect to the webroot")
	assert.Equal(t, "/test/", resp.Header.Get("Location"), "Response should redirect to the webroot")
}

func TestSimpleRoute(t *testing.T) {
	conf := new(config.Config)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(kubetest.NewFakeK8sClient())
	router, _ := NewRouter(conf, nil, mockClientFactory, nil, nil, nil, nil, nil, nil, filetest.StaticAssetDir(t))
	ts := httptest.NewServer(router)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, 200, resp.StatusCode, "Response should be ok")

	body, _ := io.ReadAll(resp.Body)
	assert.Equal(t, "", string(body), "Response should be empty")
}

func TestProfilerRoute(t *testing.T) {
	conf := new(config.Config)
	conf.Server.Profiler.Enabled = true

	mockClientFactory := kubetest.NewK8SClientFactoryMock(kubetest.NewFakeK8sClient())
	router, _ := NewRouter(conf, nil, mockClientFactory, nil, nil, nil, nil, nil, nil, filetest.StaticAssetDir(t))
	ts := httptest.NewServer(router)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/debug/pprof/")
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, 400, resp.StatusCode, "pprof index should exist but needed credentials")

	for _, p := range rpprof.Profiles() {
		resp, err = http.Get(ts.URL + "/debug/pprof/" + p.Name())
		if err != nil {
			t.Fatalf("Failed to get profile [%v]: %v", p, err)
		}
		assert.Equal(t, 400, resp.StatusCode, "pprof profile [%v] should exist but needed credentials", p.Name())
	}
	// note we do not test "profile" endpoint - it takes too long and besides that the test framework eventually times out
	for _, p := range []string{"symbol", "trace"} {
		resp, err = http.Get(ts.URL + "/debug/pprof/" + p)
		if err != nil {
			t.Fatalf("Failed to get profile [%v]: %v", p, err)
		}
		assert.Equal(t, 400, resp.StatusCode, "pprof endpoint [%v] should exist but needed credentials", p)
	}
}

func TestDisabledProfilerRoute(t *testing.T) {
	conf := new(config.Config)
	conf.Server.Profiler.Enabled = false

	mockClientFactory := kubetest.NewK8SClientFactoryMock(kubetest.NewFakeK8sClient())
	router, _ := NewRouter(conf, nil, mockClientFactory, nil, nil, nil, nil, nil, nil, filetest.StaticAssetDir(t))
	ts := httptest.NewServer(router)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/debug/pprof/")
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, 404, resp.StatusCode, "pprof should have been disabled")

	for _, p := range rpprof.Profiles() {
		resp, err = http.Get(ts.URL + "/debug/pprof/" + p.Name())
		if err != nil {
			t.Fatal(err)
		}
		assert.Equal(t, 404, resp.StatusCode, "pprof should have been disabled [%v]", p.Name())
	}
	for _, p := range []string{"symbol", "trace", "profile"} {
		resp, err = http.Get(ts.URL + "/debug/pprof/" + p)
		if err != nil {
			t.Fatal(err)
		}
		assert.Equal(t, 404, resp.StatusCode, "pprof should have been disabled [%v]", p)
	}
}

func TestRedirectWithSetWebRootKeepsParams(t *testing.T) {
	conf := new(config.Config)
	conf.Server.WebRoot = "/test"

	mockClientFactory := kubetest.NewK8SClientFactoryMock(kubetest.NewFakeK8sClient())
	router, _ := NewRouter(conf, nil, mockClientFactory, nil, nil, nil, nil, nil, nil, filetest.StaticAssetDir(t))
	ts := httptest.NewServer(router)
	defer ts.Close()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(ts.URL + "/test")
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	assert.Equal(t, 200, resp.StatusCode, "Response should not redirect")

	resp, err = client.Get(ts.URL + "/test/")
	if err != nil {
		t.Fatal(err)
	}
	body2, _ := io.ReadAll(resp.Body)
	assert.Equal(t, 200, resp.StatusCode, string(body2))

	assert.Equal(t, string(body), string(body2), "Response with and without the trailing slash on the webroot are not the same")
}

func TestMetricHandlerAPIFailures(t *testing.T) {
	errcodes := []struct {
		Name string
		Code int
	}{
		{Name: "InternalServerError", Code: http.StatusInternalServerError},
		{Name: "StatusServiceUnavailable", Code: http.StatusServiceUnavailable},
	}

	for _, errcode := range errcodes {
		t.Run(errcode.Name, func(t *testing.T) {
			req, err := http.NewRequest("GET", "/error", nil)
			if err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			handler := metricHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(errcode.Code)
			}), Route{Name: "error"})

			handler.ServeHTTP(rr, req)

			if status := rr.Code; status != http.StatusInternalServerError && status != http.StatusServiceUnavailable {
				t.Errorf("handler returned wrong status code: got %v want %v",
					status, errcode.Code)
			}
		})
	}

	registry := prometheus.NewRegistry()
	prometheus.DefaultRegisterer = registry
	internalmetrics.RegisterInternalMetrics()

	metrics, err := registry.Gather()
	assert.Nil(t, err)

	for _, m := range metrics {
		if m.GetName() == "kiali_api_failures_total" {
			if m.GetMetric()[0].Counter.GetValue() != 2 {
				t.Errorf("Failure counter metric should have a value of 2: %+v", m)
			}
		}
	}
}

func TestBuildHttpHandlerLogger_RequestIdHandling(t *testing.T) {
	// Create a test handler that captures both context and hlog state
	type testCapture struct {
		contextHeaders *utilcontext.RequestHeaders
		httpHeader     string
		hlogId         string
		hlogFound      bool
	}

	var captured testCapture
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Capture our context
		captured.contextHeaders = utilcontext.GetRequestHeadersContext(r.Context())

		// Capture HTTP header state
		captured.httpHeader = r.Header.Get("X-Request-Id")

		// Capture hlog context state
		if id, ok := hlog.IDFromRequest(r); ok {
			captured.hlogId = id.String()
			captured.hlogFound = true
		} else {
			captured.hlogId = ""
			captured.hlogFound = false
		}

		w.WriteHeader(http.StatusOK)
	})

	// Create a route for testing
	testRoute := Route{
		Name:    "test-route",
		Pattern: "/test",
	}

	t.Run("request with existing X-Request-Id header", func(t *testing.T) {
		// Reset capture
		captured = testCapture{}

		// Build the handler with logger
		handler := buildHttpHandlerLogger(testRoute, testHandler)

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Request-Id", "existing-request-123")

		resp := httptest.NewRecorder()
		handler.ServeHTTP(resp, req)

		// Verify behavior: existing header should be used
		assert.Equal(t, "existing-request-123", captured.httpHeader, "HTTP header should contain original value")
		assert.False(t, captured.hlogFound, "hlog should not generate ID when header exists")

		// Verify our context gets the existing header value
		assert.NotNil(t, captured.contextHeaders, "context headers should be set")
		assert.Equal(t, "existing-request-123", captured.contextHeaders.XRequestID, "context should contain original header value")
		assert.True(t, captured.contextHeaders.IsValid(), "context headers should be valid")
	})

	t.Run("request without X-Request-Id header", func(t *testing.T) {
		// Reset capture
		captured = testCapture{}

		// Build the handler with logger
		handler := buildHttpHandlerLogger(testRoute, testHandler)

		req := httptest.NewRequest("GET", "/test", nil)
		// No X-Request-Id header

		resp := httptest.NewRecorder()
		handler.ServeHTTP(resp, req)

		// Verify behavior: hlog should generate ID, header should remain empty
		assert.Empty(t, captured.httpHeader, "HTTP header should remain empty")
		assert.True(t, captured.hlogFound, "hlog should generate an ID")
		assert.NotEmpty(t, captured.hlogId, "hlog ID should be generated")

		// Verify our context gets the hlog-generated ID
		assert.NotNil(t, captured.contextHeaders, "context headers should be set")
		assert.Equal(t, captured.hlogId, captured.contextHeaders.XRequestID, "context should contain hlog-generated ID")
		assert.True(t, captured.contextHeaders.IsValid(), "context headers should be valid")

		// Verify hlog ID format (should be shorter than UUID)
		assert.Greater(t, len(captured.hlogId), 0, "hlog ID should not be empty")
		assert.Less(t, len(captured.hlogId), 36, "hlog ID should be shorter than UUID")
	})

	t.Run("request with empty X-Request-Id header", func(t *testing.T) {
		// Reset capture
		captured = testCapture{}

		// Build the handler with logger
		handler := buildHttpHandlerLogger(testRoute, testHandler)

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Request-Id", "")

		resp := httptest.NewRecorder()
		handler.ServeHTTP(resp, req)

		// Verify behavior: empty header treated as missing, hlog should generate ID
		assert.Empty(t, captured.httpHeader, "HTTP header should be empty")
		assert.True(t, captured.hlogFound, "hlog should generate an ID for empty header")
		assert.NotEmpty(t, captured.hlogId, "hlog ID should be generated")

		// Verify our context gets the hlog-generated ID
		assert.NotNil(t, captured.contextHeaders, "context headers should be set")
		assert.Equal(t, captured.hlogId, captured.contextHeaders.XRequestID, "context should contain hlog-generated ID")
		assert.True(t, captured.contextHeaders.IsValid(), "context headers should be valid")
	})

	t.Run("request with whitespace-only X-Request-Id header", func(t *testing.T) {
		// Reset capture
		captured = testCapture{}

		// Build the handler with logger
		handler := buildHttpHandlerLogger(testRoute, testHandler)

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Request-Id", "   ")

		resp := httptest.NewRecorder()
		handler.ServeHTTP(resp, req)

		// Verify behavior: whitespace header should be treated as existing
		assert.Equal(t, "   ", captured.httpHeader, "HTTP header should contain whitespace")
		assert.False(t, captured.hlogFound, "hlog should not generate ID for whitespace header")

		// Verify our context gets the whitespace header value
		assert.NotNil(t, captured.contextHeaders, "context headers should be set")
		assert.Equal(t, "   ", captured.contextHeaders.XRequestID, "context should contain whitespace header")
		assert.True(t, captured.contextHeaders.IsValid(), "whitespace header is technically valid (non-empty, within length limit)")
	})
}

func TestRequestIdGeneration_Uniqueness(t *testing.T) {
	// Test that multiple requests generate unique IDs when no X-Request-Id header is provided
	testRoute := Route{Name: "test", Pattern: "/test"}
	requestIds := make(map[string]bool)

	// Generate multiple request IDs
	for i := 0; i < 100; i++ {
		var capturedHeaders *utilcontext.RequestHeaders

		// Capture context in handler
		captureHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedHeaders = utilcontext.GetRequestHeadersContext(r.Context())
			w.WriteHeader(http.StatusOK)
		})

		testHandlerWithCapture := buildHttpHandlerLogger(testRoute, captureHandler)

		req := httptest.NewRequest("GET", "/test", nil)
		// Explicitly no X-Request-Id header to trigger hlog generation
		resp := httptest.NewRecorder()
		testHandlerWithCapture.ServeHTTP(resp, req)

		// Verify uniqueness
		assert.NotNil(t, capturedHeaders, "context headers should be set for request %d", i)
		assert.NotEmpty(t, capturedHeaders.XRequestID, "request ID should be generated for request %d", i)
		assert.True(t, capturedHeaders.IsValid(), "generated request ID should be valid for request %d", i)

		if requestIds[capturedHeaders.XRequestID] {
			t.Errorf("Duplicate request ID generated: %s (iteration %d)", capturedHeaders.XRequestID, i)
		}
		requestIds[capturedHeaders.XRequestID] = true
	}

	// Verify we generated 100 unique IDs
	assert.Len(t, requestIds, 100, "should generate 100 unique request IDs")
}

func TestRequestIdHandling_EdgeCases(t *testing.T) {
	testRoute := Route{Name: "test-edge-cases", Pattern: "/test"}

	type testCase struct {
		name              string
		headerValue       *string // nil means no header, empty string means empty header
		expectedInContext bool
		shouldUseHlog     bool
	}

	testCases := []testCase{
		{
			name:              "no header set",
			headerValue:       nil,
			expectedInContext: true,
			shouldUseHlog:     true,
		},
		{
			name:              "empty header",
			headerValue:       stringPtr(""),
			expectedInContext: true,
			shouldUseHlog:     true,
		},
		{
			name:              "valid header",
			headerValue:       stringPtr("valid-request-id-123"),
			expectedInContext: true,
			shouldUseHlog:     false,
		},
		{
			name:              "very long header (within limit)",
			headerValue:       stringPtr(generateString(1024)),
			expectedInContext: true,
			shouldUseHlog:     false,
		},
		{
			name:              "very long header (exceeds limit)",
			headerValue:       stringPtr(generateString(1025)),
			expectedInContext: true, // Still stored, but IsValid() will return false
			shouldUseHlog:     false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var captured *utilcontext.RequestHeaders
			var hlogFound bool

			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				captured = utilcontext.GetRequestHeadersContext(r.Context())
				_, hlogFound = hlog.IDFromRequest(r)
				w.WriteHeader(http.StatusOK)
			})

			loggerHandler := buildHttpHandlerLogger(testRoute, handler)

			req := httptest.NewRequest("GET", "/test", nil)
			if tc.headerValue != nil {
				req.Header.Set("X-Request-Id", *tc.headerValue)
			}

			resp := httptest.NewRecorder()
			loggerHandler.ServeHTTP(resp, req)

			if tc.expectedInContext {
				assert.NotNil(t, captured, "context headers should be set")
				assert.NotEmpty(t, captured.XRequestID, "request ID should be present in context")
			} else {
				assert.Nil(t, captured, "context headers should not be set")
			}

			if tc.shouldUseHlog {
				assert.True(t, hlogFound, "hlog should generate ID")
				if captured != nil {
					// Verify it's not empty and looks like an hlog ID (shorter than UUID)
					assert.Greater(t, len(captured.XRequestID), 0)
					assert.Less(t, len(captured.XRequestID), 36) // hlog IDs are shorter than UUIDs
				}
			} else {
				assert.False(t, hlogFound, "hlog should not generate ID when header exists")
				if captured != nil && tc.headerValue != nil {
					assert.Equal(t, *tc.headerValue, captured.XRequestID, "context should contain original header value")
				}
			}
		})
	}
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func generateString(length int) string {
	result := make([]byte, length)
	for i := range result {
		result[i] = 'a'
	}
	return string(result)
}
