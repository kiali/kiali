package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/mux"
	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai"
	"github.com/kiali/kiali/ai/mcp"
	aiTypes "github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/tracing/tracingtest"
)

func SetupChatMCPHandlerForTest(t *testing.T) (http.Handler, *config.Config) {
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)
	prom := &prometheustest.PromClientMock{}
	grafanaSvc, err := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)
	persesSvc, err := perses.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)

	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := &tracingtest.TracingClientMock{}

	handler := ChatMCP(
		conf,
		kialiCache,
		nil, // aiStore
		cf,
		prom,
		cpm,
		func() tracing.ClientInterface { return traceLoader },
		grafanaSvc,
		persesSvc,
		discovery,
	)

	return WithFakeAuthInfo(conf, handler), conf
}

func TestChatMCP_TraceToolsNotAvailableWhenTracingDisabled(t *testing.T) {
	require := require.New(t)
	require.NoError(mcp.LoadTools())

	handler, conf := SetupChatMCPHandlerForTest(t)
	require.False(conf.ExternalServices.Tracing.Enabled, "default test config should have tracing disabled")

	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	for _, tool := range []string{"list_traces", "get_trace_details"} {
		body := bytes.NewBufferString(`{}`)
		resp, err := http.Post(ts.URL+"/api/chat/mcp/"+tool, "application/json", body)
		require.NoError(err)
		resp.Body.Close()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "tool %s should be unavailable when tracing is disabled", tool)
	}
}

func TestChatMCP_TraceToolsReachableWhenTracingEnabled(t *testing.T) {
	require := require.New(t)
	require.NoError(mcp.LoadTools())

	handler, conf := SetupChatMCPHandlerForTest(t)
	conf.ExternalServices.Tracing.Enabled = true

	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{}`)
	resp, err := http.Post(ts.URL+"/api/chat/mcp/list_traces", "application/json", body)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode, "list_traces should be registered when tracing is enabled")
}

func TestChatMCP_MetricToolsNotAvailableWhenPrometheusDisabled(t *testing.T) {
	require := require.New(t)
	require.NoError(mcp.LoadTools())

	handler, conf := SetupChatMCPHandlerForTest(t)
	conf.ExternalServices.Prometheus.Enabled = false

	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	for _, tool := range []string{"get_mesh_traffic_graph", "get_metrics", "get_pod_performance"} {
		body := bytes.NewBufferString(`{}`)
		resp, err := http.Post(ts.URL+"/api/chat/mcp/"+tool, "application/json", body)
		require.NoError(err)
		resp.Body.Close()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "tool %s should be unavailable when Prometheus is disabled", tool)
	}
}

func TestChatMCP_ToolNotFound(t *testing.T) {
	require := require.New(t)

	// Ensure tools are loaded
	require.NoError(mcp.LoadTools())

	handler, _ := SetupChatMCPHandlerForTest(t)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	// Test with non-existent tool
	body := bytes.NewBufferString(`{"arg1": "value1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/mcp/non_existent_tool", "application/json", body)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusNotFound, resp.StatusCode, "Non-existent tool should return 404")
}

func TestChatMCP_InvalidJSON(t *testing.T) {
	require := require.New(t)

	// Ensure tools are loaded
	require.NoError(mcp.LoadTools())

	handler, _ := SetupChatMCPHandlerForTest(t)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	// Test with invalid JSON
	body := bytes.NewBufferString(`{invalid json}`)
	resp, err := http.Post(ts.URL+"/api/chat/mcp/get_mesh_traffic_graph", "application/json", body)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "Invalid JSON should return 400")
}

func TestChatMCP_ConcurrentRequests(t *testing.T) {
	// Validates concurrent access to MCP handler and tool maps (MCPToolHandlers / DefaultToolHandlers).
	// Run with: go test -race -run TestChatMCP_ConcurrentRequests ./handlers/...
	require := require.New(t)

	require.NoError(mcp.LoadTools())

	handler, _ := SetupChatMCPHandlerForTest(t)
	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	const numRequests = 50
	var wg sync.WaitGroup
	statusCodes := make(chan int, numRequests)

	// Alternate between tools and header to exercise concurrent reads from both handler maps:
	// - get_referenced_docs (no header): MCPToolHandlers
	// - get_action_ui (no header): MCPToolHandlers
	// - get_referenced_docs + HeaderKialiUI: DefaultToolHandlers (200 if the tool is also in default)
	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			var tool string
			var body map[string]interface{}
			withKialiUIHeader := false
			switch i % 3 {
			case 0:
				tool = "get_referenced_docs"
				body = map[string]interface{}{"keywords": "istio,kiali"}
			case 1:
				tool = "get_action_ui"
				body = map[string]interface{}{"resourceType": "graph", "namespaces": "default"}
			default:
				tool = "get_referenced_docs"
				body = map[string]interface{}{"keywords": "istio"}
				withKialiUIHeader = true
			}

			bodyBytes, err := json.Marshal(body)
			if err != nil {
				t.Errorf("marshal: %v", err)
				return
			}
			req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/chat/mcp/"+tool, bytes.NewBuffer(bodyBytes))
			if err != nil {
				t.Errorf("NewRequest: %v", err)
				return
			}
			req.Header.Set("Content-Type", "application/json")
			if withKialiUIHeader {
				req.Header.Set(mcp.HeaderKialiUI, "true")
			}

			resp, err := ts.Client().Do(req)
			if err != nil {
				t.Errorf("Do: %v", err)
				return
			}
			defer resp.Body.Close()

			statusCodes <- resp.StatusCode
		}(i)
	}

	wg.Wait()
	close(statusCodes)

	var got200, got404 int
	for code := range statusCodes {
		switch code {
		case http.StatusOK:
			got200++
		case http.StatusNotFound:
			got404++
		default:
			t.Errorf("unexpected status code: %d", code)
		}
	}

	// Concurrent access to handler and tool maps: we must see 200s (MCP tools). We may also see 404s
	// when HeaderKialiUI is set but the tool is not registered in DefaultToolHandlers.
	require.Greater(got200, 0, "expected some 200 responses from concurrent MCP tool calls")
	require.Equal(numRequests, got200+got404, "all responses should be 200 or 404 (no 500/panic)")
}

func TestChatMCP_LoadToolsOnFirstRequest(t *testing.T) {
	require := require.New(t)

	handler, _ := SetupChatMCPHandlerForTest(t)
	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	// Trigger LoadTools() via a tool that needs no K8s/Prometheus (get_mesh_graph would panic with test setup)
	body := bytes.NewBufferString(`{"keywords": "istio"}`)
	resp, err := http.Post(ts.URL+"/api/chat/mcp/get_referenced_docs", "application/json", body)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	require.Equal(http.StatusOK, resp.StatusCode, "get_referenced_docs should succeed")
	assert.Greater(t, len(mcp.MCPToolHandlers), 0, "MCP tools should be loaded after first request")
	assert.Greater(t, len(mcp.DefaultToolHandlers), 0, "Default (chatbot) toolset should be loaded")
}

func TestChatMCP_UsesDefaultHandlersWhenKialiUIHeaderSet(t *testing.T) {
	require := require.New(t)
	require.NoError(mcp.LoadTools())

	handler, _ := SetupChatMCPHandlerForTest(t)
	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	// Tool with toolset: [mcp] only is in MCPToolHandlers but not in DefaultToolHandlers.
	// Without header: found via MCPToolHandlers. With HeaderKialiUI: 404 via DefaultToolHandlers.
	excludedTool := "get_referenced_docs"
	if _, inDefault := mcp.DefaultToolHandlers[excludedTool]; inDefault {
		t.Skipf("%s is in DefaultToolHandlers, cannot test header subset behavior", excludedTool)
	}
	require.Contains(mcp.MCPToolHandlers, excludedTool, "tool should exist in MCPToolHandlers")

	body := bytes.NewBufferString(`{}`)
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/chat/mcp/"+excludedTool, body)
	require.NoError(err)
	req.Header.Set("Content-Type", "application/json")
	resp, err := ts.Client().Do(req)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Without HeaderKialiUI, tool should be found (MCPToolHandlers)")

	body2 := bytes.NewBufferString(`{}`)
	req2, err := http.NewRequest(http.MethodPost, ts.URL+"/api/chat/mcp/"+excludedTool, body2)
	require.NoError(err)
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set(mcp.HeaderKialiUI, "true")
	resp2, err := ts.Client().Do(req2)
	require.NoError(err)
	t.Cleanup(func() { resp2.Body.Close() })
	assert.Equal(t, http.StatusNotFound, resp2.StatusCode, "With HeaderKialiUI, tool should not be found when absent from DefaultToolHandlers")
}

func TestChatMCP_ResponseFormatDiffersByMCPMode(t *testing.T) {
	require := require.New(t)
	require.NoError(mcp.LoadTools())

	// Create a custom setup with a fake namespace so manage_istio_config can validate it
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)
	prom := &prometheustest.PromClientMock{}
	grafanaSvc, err := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(err)
	persesSvc, err := perses.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(err)
	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := &tracingtest.TracingClientMock{}

	handler := ChatMCP(
		conf,
		kialiCache,
		nil, // aiStore
		cf,
		prom,
		cpm,
		func() tracing.ClientInterface { return traceLoader },
		grafanaSvc,
		persesSvc,
		discovery,
	)
	handler = WithFakeAuthInfo(conf, handler)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	// Use manage_istio_config which is in both toolsets and formats responses based on mcp_mode.
	tool := "manage_istio_config"
	require.Contains(mcp.MCPToolHandlers, tool, "tool should exist in MCPToolHandlers")
	require.Contains(mcp.DefaultToolHandlers, tool, "tool should exist in DefaultToolHandlers")

	// Minimal request body for create preview (confirmed: false).
	// This will trigger the preview flow that returns different formats based on mcp_mode.
	// Use "bookinfo" namespace which exists in our fake k8s client.
	requestBody := `{
		"action": "create",
		"confirmed": false,
		"namespace": "bookinfo",
		"group": "networking.istio.io",
		"version": "v1",
		"kind": "VirtualService",
		"object": "test-vs",
		"data": "{\"apiVersion\":\"networking.istio.io/v1\",\"kind\":\"VirtualService\",\"metadata\":{\"name\":\"test-vs\",\"namespace\":\"bookinfo\"},\"spec\":{\"hosts\":[\"test.example.com\"]}}"
	}`

	// Test 1: Without Kiali-UI header (MCP mode) - response should be direct result, no actions wrapper
	req1, err := http.NewRequest(http.MethodPost, ts.URL+"/api/chat/mcp/"+tool, bytes.NewBufferString(requestBody))
	require.NoError(err)
	req1.Header.Set("Content-Type", "application/json")
	resp1, err := ts.Client().Do(req1)
	require.NoError(err)
	t.Cleanup(func() { resp1.Body.Close() })

	var mcpResponse interface{}
	require.NoError(json.NewDecoder(resp1.Body).Decode(&mcpResponse))

	// In MCP mode (mcp_mode=true), manage_istio_config returns the result directly without wrapping.
	// Even with confirmed=false, MCP mode executes directly (no preview flow).
	// The response should be a string (direct result), not a structured object with "actions".
	mcpResponseStr, isMCPString := mcpResponse.(string)
	if isMCPString {
		assert.NotEmpty(t, mcpResponseStr, "MCP mode should return non-empty result string")
	} else {
		// If it's a map (shouldn't be for MCP mode), verify it does NOT have "actions"
		mcpResponseMap, _ := mcpResponse.(map[string]interface{})
		_, hasActions := mcpResponseMap["actions"]
		assert.False(t, hasActions, "MCP mode response should not contain 'actions' field")
	}

	// Test 2: With Kiali-UI header (UI mode) - response should have actions array and result fields
	req2, err := http.NewRequest(http.MethodPost, ts.URL+"/api/chat/mcp/"+tool, bytes.NewBufferString(requestBody))
	require.NoError(err)
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set(mcp.HeaderKialiUI, "true")
	resp2, err := ts.Client().Do(req2)
	require.NoError(err)
	t.Cleanup(func() { resp2.Body.Close() })

	var uiResponse map[string]interface{}
	require.NoError(json.NewDecoder(resp2.Body).Decode(&uiResponse))

	// In UI mode (mcp_mode=false), manage_istio_config wraps the response with actions and result.
	assert.Contains(t, uiResponse, "actions", "UI mode response should contain 'actions' field")
	assert.Contains(t, uiResponse, "result", "UI mode response should contain 'result' field")

	// Verify actions is an array
	actions, ok := uiResponse["actions"].([]interface{})
	assert.True(t, ok, "actions field should be an array")
	assert.Greater(t, len(actions), 0, "actions array should not be empty")

	// Verify the first action has expected fields (kind: file, fileName, payload)
	if len(actions) > 0 {
		firstAction, ok := actions[0].(map[string]interface{})
		assert.True(t, ok, "first action should be a map")
		if ok {
			assert.Equal(t, "file", firstAction["kind"], "action kind should be 'file'")
			assert.Contains(t, firstAction, "fileName", "action should have fileName")
			assert.Contains(t, firstAction, "payload", "action should have payload")
		}
	}
}

// ========================================================================
// ChatAI handler tests
// ========================================================================

func setupChatAIHandlerForTest(t *testing.T, conf *config.Config) (http.Handler, *prometheustest.PromClientMock, aiTypes.AIStore) {
	t.Helper()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)
	prom := &prometheustest.PromClientMock{}
	promAPI := new(prometheustest.PromAPIMock)
	prom.On("API").Return(promAPI)
	grafanaSvc, err := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)
	persesSvc, err := perses.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)

	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := &tracingtest.TracingClientMock{}

	aiStore := ai.NewAIStore(context.Background(), nil)

	handler := ChatAI(
		conf,
		kialiCache,
		aiStore,
		cf,
		prom,
		cpm,
		func() tracing.ClientInterface { return traceLoader },
		grafanaSvc,
		persesSvc,
		discovery,
	)

	return WithFakeAuthInfo(conf, handler), prom, aiStore
}

func TestChatAI_DisabledReturnsError(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = false

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query": "hello", "conversation_id": "c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/openai/gpt-4/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode, "disabled ChatAI should return error")
}

func TestChatAI_InvalidRequestBody(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	conf.Auth.Strategy = config.AuthStrategyAnonymous

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{not valid json}`)
	resp, err := http.Post(ts.URL+"/api/chat/openai/gpt-4/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "invalid JSON body should return 400")

	var payload map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	assert.Equal(t, "Invalid request body", payload["error"])
}

func TestChatAI_ProviderNotFound(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	conf.Auth.Strategy = config.AuthStrategyAnonymous

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query": "hello", "conversation_id": "c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/nonexistent/model/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode, "nonexistent provider should return error")
}

// ========================================================================
// Token logging accuracy: AI Prometheus metrics tests
// ========================================================================

func TestChatAI_AuthInfoMissingClusterName(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	conf.Auth.Strategy = config.AuthStrategyToken
	conf.KubernetesConfig.ClusterName = "primary-cluster"

	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)
	prom := &prometheustest.PromClientMock{}
	grafanaSvc, err := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)
	persesSvc, err := perses.NewService(conf, cf.GetSAHomeClusterClient())
	require.NoError(t, err)
	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := &tracingtest.TracingClientMock{}
	aiStore := ai.NewAIStore(context.Background(), nil)

	handler := ChatAI(
		conf, kialiCache, aiStore, cf, prom, cpm,
		func() tracing.ClientInterface { return traceLoader },
		grafanaSvc, persesSvc, discovery,
	)

	// Inject auth info that does NOT contain the configured cluster name
	wrongClusterAuth := map[string]*api.AuthInfo{
		"wrong-cluster": {Token: "test"},
	}
	wrappedHandler := WithAuthInfo(wrongClusterAuth, handler)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", wrappedHandler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query": "hello", "conversation_id": "c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/openai/gpt-4/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode,
		"should return error when auth info doesn't contain the configured cluster name")
}

func TestChatMCP_EmptyBody(t *testing.T) {
	require := require.New(t)
	require.NoError(mcp.LoadTools())

	handler, _ := SetupChatMCPHandlerForTest(t)
	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	resp, err := http.Post(ts.URL+"/api/chat/mcp/get_referenced_docs", "application/json", nil)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	// The tool may return an error for missing required args,
	// but the handler must not panic on nil body.
	assert.NotEqual(t, http.StatusInternalServerError, resp.StatusCode,
		"empty body should not cause a 500/panic")
}

// ========================================================================
// Token logging accuracy: AI Prometheus metrics tests
// ========================================================================

func aiRequestsCounterValue(provider, model string) float64 {
	m := &dto.Metric{}
	counter := internalmetrics.GetAIRequestsTotalMetric(provider, model)
	if err := counter.Write(m); err != nil {
		return 0
	}
	return m.Counter.GetValue()
}

func TestChatAI_MetricsNotIncrementedOnProviderFailure(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	conf.Auth.Strategy = config.AuthStrategyAnonymous

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	before := aiRequestsCounterValue("nonexistent", "model")

	body := bytes.NewBufferString(`{"query": "hello", "conversation_id": "c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/nonexistent/model/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)

	after := aiRequestsCounterValue("nonexistent", "model")
	assert.Equal(t, before, after,
		"kiali_ai_requests_total should NOT be incremented when provider initialization fails")
}

func TestChatAI_MetricsNotIncrementedOnDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = false

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	before := aiRequestsCounterValue("openai", "gpt-4")

	body := bytes.NewBufferString(`{"query": "hello", "conversation_id": "c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/openai/gpt-4/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	after := aiRequestsCounterValue("openai", "gpt-4")
	assert.Equal(t, before, after,
		"kiali_ai_requests_total should NOT be incremented when ChatAI is disabled")
}

func TestChatAI_MetricsNotIncrementedOnBadRequest(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	conf.Auth.Strategy = config.AuthStrategyAnonymous

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	before := aiRequestsCounterValue("openai", "gpt-4")

	body := bytes.NewBufferString(`{invalid json}`)
	resp, err := http.Post(ts.URL+"/api/chat/openai/gpt-4/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	after := aiRequestsCounterValue("openai", "gpt-4")
	assert.Equal(t, before, after,
		"kiali_ai_requests_total should NOT be incremented on invalid request body")
}

// ========================================================================
// ChatAI streaming path tests
// ========================================================================

// openaiSSEResponse returns a minimal OpenAI SSE stream with a single text response.
func openaiSSEResponse(content string) string {
	chunk1 := fmt.Sprintf(
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":%q},"finish_reason":null}]}`,
		content,
	)
	chunk2 := `{"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":5,"total_tokens":10}}`
	return fmt.Sprintf("data: %s\n\ndata: %s\n\ndata: [DONE]\n\n", chunk1, chunk2)
}

// chatAIConfWithFakeProvider builds a config that points the AI provider to the given endpoint.
func chatAIConfWithFakeProvider(endpoint string) *config.Config {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	conf.Auth.Strategy = config.AuthStrategyAnonymous
	conf.AI.ChatAI.DefaultProvider = "test-openai"
	conf.AI.ChatAI.Providers = []config.ProviderConfig{{
		Name:         "test-openai",
		Type:         config.OpenAIProvider,
		Config:       config.DefaultProviderConfigType,
		Enabled:      true,
		DefaultModel: "gpt-4o",
		Key:          "test-api-key",
		Models: []config.AIModel{{
			Name:     "gpt-4o",
			Model:    "gpt-4o",
			Enabled:  true,
			Endpoint: endpoint,
		}},
	}}
	return conf
}

// TestChatAI_FullStreamingResponse exercises the complete streaming path in ChatAI,
// covering the SSE header setup, flusher check, and onChunk callback.
func TestChatAI_FullStreamingResponse(t *testing.T) {
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, openaiSSEResponse("Hello from the AI"))
	}))
	defer fakeAI.Close()

	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	defer ts.Close()

	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/test-openai/gpt-4o/ai", "application/json", body)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))

	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	respStr := string(b)

	assert.Contains(t, respStr, `"event":"start"`)
	assert.Contains(t, respStr, "Hello from the AI")
	assert.NotContains(t, respStr, `"input_tokens"`)
	assert.NotContains(t, respStr, `"output_tokens"`)
}

func TestChatAI_RecordsUsageWithoutStreamingTokenPayload(t *testing.T) {
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, openaiSSEResponse("Hello from the AI"))
	}))
	defer fakeAI.Close()

	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	handler, promClient, aiStore := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	mr.Handle("/api/ai/usage/user", WithFakeAuthInfo(conf, AIUserUsage(conf, aiStore, promClient)))
	ts := httptest.NewServer(mr)
	defer ts.Close()

	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/test-openai/gpt-4o/ai", "application/json", body)
	require.NoError(t, err)
	defer resp.Body.Close()
	_, err = io.ReadAll(resp.Body)
	require.NoError(t, err)

	metrics := aiStore.GetUsageMetrics("anonymous")
	require.Len(t, metrics, 1)
	assert.Equal(t, "openai", metrics[0].Provider)
	assert.Equal(t, "gpt-4o", metrics[0].Model)
	assert.Equal(t, int64(5), metrics[0].PromptTokens)
	assert.Equal(t, int64(5), metrics[0].CompletionTokens)
	assert.Equal(t, int64(10), metrics[0].TotalTokens)

	req, err := http.NewRequest(http.MethodGet, ts.URL+"/api/ai/usage/user", nil)
	require.NoError(t, err)
	usageResp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer usageResp.Body.Close()
	assert.Equal(t, http.StatusOK, usageResp.StatusCode)

	var got struct {
		Session []aiTypes.UsageMetric `json:"session"`
		Budget  *UserBudgetStatus     `json:"budget,omitempty"`
	}
	require.NoError(t, json.NewDecoder(usageResp.Body).Decode(&got))
	require.Len(t, got.Session, 1)
	assert.Equal(t, int64(10), got.Session[0].TotalTokens)
}

// noFlushWriter is an http.ResponseWriter that intentionally does NOT implement
// http.Flusher, triggering the "Streaming unsupported" error path in ChatAI.
type noFlushWriter struct {
	code    int
	headers http.Header
	body    bytes.Buffer
}

func (w *noFlushWriter) Header() http.Header {
	if w.headers == nil {
		w.headers = make(http.Header)
	}
	return w.headers
}

func (w *noFlushWriter) Write(b []byte) (int, error) {
	if w.code == 0 {
		w.code = http.StatusOK
	}
	return w.body.Write(b)
}

func (w *noFlushWriter) WriteHeader(code int) {
	w.code = code
}

// TestChatAI_StreamingNotSupported covers the `flusher, ok := w.(http.Flusher); if !ok` branch.
func TestChatAI_StreamingNotSupported(t *testing.T) {
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer fakeAI.Close()

	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)

	w := &noFlushWriter{}
	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	r := httptest.NewRequest(http.MethodPost, "/api/chat/test-openai/gpt-4o/ai", body)

	mr.ServeHTTP(w, r)

	assert.Equal(t, http.StatusInternalServerError, w.code)
	assert.Contains(t, w.body.String(), "Streaming unsupported")
}

// ========================================================================
// ChatAI AllowedUsers tests
// ========================================================================

// TestChatAI_AllowedUsersBlocksUserNotInList covers the case where AllowedUsers is
// non-empty and the requesting user is not part of it: the request must be rejected
// with 403 before the AI provider is ever contacted.
func TestChatAI_AllowedUsersBlocksUserNotInList(t *testing.T) {
	var providerCalled int32
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&providerCalled, 1)
		_, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, openaiSSEResponse("should not be reached"))
	}))
	defer fakeAI.Close()

	// chatAIConfWithFakeProvider sets Auth.Strategy to anonymous, so the effective
	// user for the AllowedUsers check is "anonymous" (see resolveChatAIUsageUserID/fallbackUserID).
	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	conf.AI.ChatAI.AllowedUsers = []string{"someone-else"}

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/test-openai/gpt-4o/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, "user not in AllowedUsers should be forbidden")
	assert.Equal(t, int32(0), atomic.LoadInt32(&providerCalled), "AI provider must not be contacted when the user is blocked")

	var payload map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	assert.Equal(t, "You are not allowed to use the ChatAI feature", payload["error"])
}

// TestChatAI_AllowedUsersEmptyListAllowsAnyUser covers the "no restriction" convention:
// an empty/unset AllowedUsers list must allow every user through.
func TestChatAI_AllowedUsersEmptyListAllowsAnyUser(t *testing.T) {
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, openaiSSEResponse("Hello from the AI"))
	}))
	defer fakeAI.Close()

	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	conf.AI.ChatAI.AllowedUsers = nil // explicitly empty: no restriction

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/test-openai/gpt-4o/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode, "empty AllowedUsers should not restrict access")
}

// TestChatAI_AllowedUsersAllowsUserInList covers the case where AllowedUsers is
// non-empty and the requesting user is part of it: the request must proceed normally.
func TestChatAI_AllowedUsersAllowsUserInList(t *testing.T) {
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, openaiSSEResponse("Hello from the AI"))
	}))
	defer fakeAI.Close()

	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	conf.AI.ChatAI.AllowedUsers = []string{"someone-else", "anonymous"}

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/test-openai/gpt-4o/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode, "user in AllowedUsers should be allowed")
}

// ========================================================================
// DeleteConversations handler tests
// ========================================================================

func withSessionID(sessionID string, hf http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := authentication.SetSessionIDContext(r.Context(), sessionID)
		hf(w, r.WithContext(ctx))
	}
}

func TestDeleteConversations_Success(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	aiStore := ai.NewAIStore(context.Background(), nil)

	conv := &aiTypes.Conversation{
		Conversation: []aiTypes.ConversationMessage{{Role: "user", Content: "hello"}},
	}
	require.NoError(t, aiStore.SetConversation("test-session", "conv-1", conv))

	_, found := aiStore.GetConversation("test-session", "conv-1")
	require.True(t, found, "conversation should exist before delete")

	handler := withSessionID("test-session", DeleteConversations(conf, aiStore))

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", handler).Methods("DELETE")
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=conv-1", nil)
	require.NoError(t, err)
	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	_, found = aiStore.GetConversation("test-session", "conv-1")
	assert.False(t, found, "conversation should be deleted")
}

func TestDeleteConversations_MultipleIDs(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	aiStore := ai.NewAIStore(context.Background(), nil)

	for _, id := range []string{"conv-1", "conv-2", "conv-3"} {
		conv := &aiTypes.Conversation{
			Conversation: []aiTypes.ConversationMessage{{Role: "user", Content: id}},
		}
		require.NoError(t, aiStore.SetConversation("test-session", id, conv))
	}

	handler := withSessionID("test-session", DeleteConversations(conf, aiStore))

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", handler).Methods("DELETE")
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=conv-1,conv-3", nil)
	require.NoError(t, err)
	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	_, found := aiStore.GetConversation("test-session", "conv-1")
	assert.False(t, found, "conv-1 should be deleted")

	_, found = aiStore.GetConversation("test-session", "conv-2")
	assert.True(t, found, "conv-2 should remain")

	_, found = aiStore.GetConversation("test-session", "conv-3")
	assert.False(t, found, "conv-3 should be deleted")
}

func TestDeleteConversations_MissingParam(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	aiStore := ai.NewAIStore(context.Background(), nil)

	handler := withSessionID("test-session", DeleteConversations(conf, aiStore))

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", handler).Methods("DELETE")
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations", nil)
	require.NoError(t, err)
	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestDeleteConversations_StoreDisabled(t *testing.T) {
	conf := config.NewConfig()
	aiStore := ai.NewAIStore(context.Background(), &ai.AiStoreConfig{Enabled: false})

	handler := withSessionID("test-session", DeleteConversations(conf, aiStore))

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", handler).Methods("DELETE")
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=conv-1", nil)
	require.NoError(t, err)
	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode, "disabled store should return 200 (no-op)")
}

func TestDeleteConversations_NilStore(t *testing.T) {
	conf := config.NewConfig()

	handler := withSessionID("test-session", DeleteConversations(conf, nil))

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", handler).Methods("DELETE")
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=conv-1", nil)
	require.NoError(t, err)
	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode, "nil store should return 200 (no-op)")
}

func TestDeleteConversations_NonexistentID(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	aiStore := ai.NewAIStore(context.Background(), nil)

	handler := withSessionID("test-session", DeleteConversations(conf, aiStore))

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", handler).Methods("DELETE")
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=nonexistent", nil)
	require.NoError(t, err)
	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode, "deleting nonexistent ID should succeed (idempotent)")
}

func TestDeleteConversations_PreservesTokenUsage(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	aiStore := ai.NewAIStore(context.Background(), nil)

	conv := &aiTypes.Conversation{
		Conversation: []aiTypes.ConversationMessage{{Role: "user", Content: "hello"}},
	}
	require.NoError(t, aiStore.SetConversation("test-session", "conv-1", conv))
	require.NoError(t, aiStore.RecordUsage("test-session", "openai", "gpt-4o", aiTypes.NewTokenUsage(10, 20, 30)))

	metricsBefore := aiStore.GetUsageMetrics("test-session")
	require.Len(t, metricsBefore, 1, "should have usage metrics before deletion")
	assert.Equal(t, int64(30), metricsBefore[0].TotalTokens)

	handler := withSessionID("test-session", DeleteConversations(conf, aiStore))

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", handler).Methods("DELETE")
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=conv-1", nil)
	require.NoError(t, err)
	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	_, found := aiStore.GetConversation("test-session", "conv-1")
	assert.False(t, found, "conversation should be deleted")

	metricsAfter := aiStore.GetUsageMetrics("test-session")
	require.Len(t, metricsAfter, 1, "token usage metrics must be preserved after conversation deletion")
	assert.Equal(t, int64(30), metricsAfter[0].TotalTokens, "token counts must remain unchanged")
	assert.Equal(t, "openai", metricsAfter[0].Provider)
	assert.Equal(t, "gpt-4o", metricsAfter[0].Model)
}

func TestDeleteConversations_SessionScoping(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	aiStore := ai.NewAIStore(context.Background(), nil)

	conv := &aiTypes.Conversation{
		Conversation: []aiTypes.ConversationMessage{{Role: "user", Content: "hello"}},
	}
	require.NoError(t, aiStore.SetConversation("session-A", "conv-1", conv))
	require.NoError(t, aiStore.SetConversation("session-B", "conv-1", conv))

	handler := withSessionID("session-A", DeleteConversations(conf, aiStore))

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", handler).Methods("DELETE")
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=conv-1", nil)
	require.NoError(t, err)
	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	_, found := aiStore.GetConversation("session-A", "conv-1")
	assert.False(t, found, "session-A conv-1 should be deleted")

	_, found = aiStore.GetConversation("session-B", "conv-1")
	assert.True(t, found, "session-B conv-1 should NOT be affected")
}

// ========================================================================
// ChatUsage handler tests
// ========================================================================

func setupChatUsageHandler(conf *config.Config, promClient prometheus.ClientInterface) http.Handler {
	return AIUsage(conf, nil, promClient)
}

func TestChatUsage_ChatAIDisabledReturns503(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = false
	conf.AI.ChatAI.Enabled = false
	conf.AI.Metrics = false

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["error"], "ChatAI is not enabled")
}

func TestChatUsage_MetricsDisabledReturns503(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = false

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["error"], "ChatAI metrics are not enabled")
}

func TestChatUsage_BothDisabledChatAICheckedFirst(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = false
	conf.AI.ChatAI.Enabled = false
	conf.AI.Metrics = false

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	// ChatAI.Enabled is checked first, so the error must reflect that
	assert.Contains(t, body["error"], "ChatAI is not enabled")
}

func TestChatUsage_InvalidWindowReturns400(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=notanumber")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["error"], "invalid window")
}

func TestChatUsage_InvalidStepReturns400(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=3600&step=notanumber")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["error"], "invalid step")
}

func TestChatUsage_StepGreaterThanWindowReturns400(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	// step (7200) > window (3600)
	resp, err := http.Get(ts.URL + "?window=3600&step=7200")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["error"], "step must be positive and not greater than window")
}

func TestChatUsage_EnabledReturnsValidResponse(t *testing.T) {
	internalmetrics.MarkAITokensSeedingComplete()
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=3600&step=300")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "millions", body["tokenUnit"])

	summary, ok := body["summary"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'summary' object")
	assert.Contains(t, summary, "byProvider")
	assert.Contains(t, summary, "byModel")

	ts2, ok := body["timeSeries"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'timeSeries' object")
	assert.Equal(t, "3600", ts2["window"])
	assert.Equal(t, "300", ts2["step"])
}

// ========================================================================
// ChatPrompts handler tests
// ========================================================================

func TestChatPrompts_ReturnsAllPrompts(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	cf := kubetest.NewFakeClientFactoryWithClient(conf, kubetest.NewFakeK8sClient())
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	handler := ChatPrompts(conf, kialiCache, cf)

	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var prompts []map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&prompts)
	require.NoError(t, err)
	assert.Greater(t, len(prompts), 0, "should return at least one prompt")

	for _, p := range prompts {
		assert.NotEmpty(t, p["name"], "prompt name should not be empty")
		assert.NotEmpty(t, p["title"], "prompt title should not be empty")
		assert.NotEmpty(t, p["category"], "prompt category should not be empty")
		assert.NotEmpty(t, p["query"], "prompt query should not be empty")
	}
}

func TestChatPrompts_FilterByCategory(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	cf := kubetest.NewFakeClientFactoryWithClient(conf, kubetest.NewFakeK8sClient())
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	handler := ChatPrompts(conf, kialiCache, cf)

	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?category=overview")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var prompts []map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&prompts)
	require.NoError(t, err)
	assert.Greater(t, len(prompts), 0, "should return prompts for overview category")

	for _, p := range prompts {
		assert.Equal(t, "overview", p["category"], "all prompts should be in the overview category")
	}
}

func TestChatPrompts_FilterByCategory_NoResults(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = true
	cf := kubetest.NewFakeClientFactoryWithClient(conf, kubetest.NewFakeK8sClient())
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	handler := ChatPrompts(conf, kialiCache, cf)

	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?category=nonexistent")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var prompts []map[string]string
	err = json.NewDecoder(resp.Body).Decode(&prompts)
	require.NoError(t, err)
	assert.Empty(t, prompts, "should return empty array for unknown category")
}

func TestChatPrompts_DisabledWhenChatAIOff(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.ChatAI.Enabled = false
	cf := kubetest.NewFakeClientFactoryWithClient(conf, kubetest.NewFakeK8sClient())
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)

	handler := ChatPrompts(conf, kialiCache, cf)

	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
}

func TestChatUsage_WeeklyRequiresPrometheusClient(t *testing.T) {
	internalmetrics.MarkAITokensSeedingComplete()
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=weekly&from=1672531200&since=1675209600")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["error"], "prometheus client not available")
}

func TestChatUsage_Weekly_Success(t *testing.T) {
	internalmetrics.MarkAITokensSeedingComplete()
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	// Mock the Prometheus Query
	// Query is: max_over_time(kiali_ai_tokens_weekly_total[2678400s])
	// Return some fake data
	ret := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"username":    "user1",
				"ai_provider": "openai",
				"ai_model":    "gpt-4",
				"request":     "chat",
				"year":        "2026",
				"week":        "36",
			},
			Value: 1500,
		},
	}
	promAPI.On("Query", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(ret, nil)

	ts := httptest.NewServer(setupChatUsageHandler(conf, promClient))
	t.Cleanup(ts.Close)

	// Jan 1 2026 to Oct 1 2026
	resp, err := http.Get(ts.URL + "?window=weekly&from=1767225600&since=1790812800")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	summary, ok := body["summary"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'summary' object")

	byProvider, ok := summary["byProvider"].([]interface{})
	require.True(t, ok)
	assert.Len(t, byProvider, 2) // openai + total

	openaiRow, ok := byProvider[0].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(0.0015), openaiRow["totalTokens"])
}

func TestChatUsage_Monthly_Success(t *testing.T) {
	internalmetrics.MarkAITokensSeedingComplete()
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	// Mock the Prometheus Query
	ret := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"username":    "user2",
				"ai_provider": "anthropic",
				"ai_model":    "claude",
				"request":     "chat",
				"year":        "2026",
				"month":       "9",
			},
			Value: 5000,
		},
	}
	promAPI.On("Query", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(ret, nil)

	ts := httptest.NewServer(setupChatUsageHandler(conf, promClient))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=monthly&from=1767225600&since=1790812800")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	summary, ok := body["summary"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'summary' object")

	byProvider, ok := summary["byProvider"].([]interface{})
	require.True(t, ok)
	assert.Len(t, byProvider, 2) // anthropic + total
}

func TestChatUsage_Weekly_MissingParamsDefaults(t *testing.T) {
	internalmetrics.MarkAITokensSeedingComplete()
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	ret := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"username":    "user1",
				"ai_provider": "openai",
				"ai_model":    "gpt-4",
				"request":     "chat",
				"year":        "2026",
				"week":        "36",
			},
			Value: 1500,
		},
	}
	promAPI.On("Query", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(ret, nil)

	ts := httptest.NewServer(setupChatUsageHandler(conf, promClient))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=weekly")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	summary, ok := body["summary"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'summary' object")

	byProvider, ok := summary["byProvider"].([]interface{})
	require.True(t, ok)
	assert.Len(t, byProvider, 2) // openai + total
}

func TestChatUsage_Weekly_InvalidFromReturns400(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=weekly&from=abc&since=123")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["error"], "invalid from parameter")
}

func TestChatUsage_Weekly_SinceBeforeFromReturns400(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	ts := httptest.NewServer(setupChatUsageHandler(conf, nil))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=weekly&from=200&since=100")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Contains(t, body["error"], "since must be after from")
}

func TestChatUsage_Weekly_WithConsumption_Success(t *testing.T) {
	internalmetrics.MarkAITokensSeedingComplete()
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	// Mock the Prometheus Query for Total, Prompt, and Completion
	// We need to mock all three because handleLongTermChatUsage queries them all.
	// For simplicity, we can just return the same vector for all three, or specific ones.

	// Let's create a helper to mock the queries
	mockQuery := func(metricName string, value float64) {
		ret := model.Vector{
			&model.Sample{
				Metric: model.Metric{
					"username":    "user1",
					"ai_provider": "openai",
					"ai_model":    "gpt-4o",
					"request":     "chat",
					"year":        "2026",
					"week":        "36",
				},
				Value: model.SampleValue(value),
			},
		}
		// Match the specific query string to return the correct vector
		promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
			return strings.Contains(q, metricName)
		}), mock.AnythingOfType("time.Time")).Return(ret, nil)
	}

	mockQuery("kiali_ai_tokens_weekly_total", 3000)
	mockQuery("kiali_ai_prompt_tokens_weekly_total", 2000)
	mockQuery("kiali_ai_completion_tokens_weekly_total", 1000)

	ts := httptest.NewServer(setupChatUsageHandler(conf, promClient))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=weekly&from=1767225600&since=1790812800&consumption=true")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	summary, ok := body["summary"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'summary' object")

	byProvider, ok := summary["byProvider"].([]interface{})
	require.True(t, ok)
	assert.Len(t, byProvider, 2) // openai + total

	openaiRow, ok := byProvider[0].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(3000)/1_000_000, openaiRow["totalTokens"])
	assert.Equal(t, float64(2000)/1_000_000, openaiRow["promptTokens"])
	assert.Equal(t, float64(1000)/1_000_000, openaiRow["completionTokens"])

	cost, ok := openaiRow["cost"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'cost' object")

	// gpt-4o prices: input: 2.50, output: 10.00
	// input cost: (2000 / 1_000_000) * 2.50 = 0.005
	// output cost: (1000 / 1_000_000) * 10.00 = 0.010
	// total cost: 0.015
	assert.Equal(t, 0.005, cost["input"])
	assert.Equal(t, 0.010, cost["output"])
	assert.Equal(t, 0.015, cost["total"])
	assert.Equal(t, "USD", cost["currency"])
}

func TestChatUsage_Monthly_WithConsumption_Success(t *testing.T) {
	internalmetrics.MarkAITokensSeedingComplete()
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	mockQuery := func(metricName string, value float64) {
		ret := model.Vector{
			&model.Sample{
				Metric: model.Metric{
					"username":    "user2",
					"ai_provider": "anthropic",
					"ai_model":    "claude-sonnet-4-6",
					"request":     "chat",
					"year":        "2026",
					"month":       "9",
				},
				Value: model.SampleValue(value),
			},
		}
		promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
			return strings.Contains(q, metricName)
		}), mock.AnythingOfType("time.Time")).Return(ret, nil)
	}

	mockQuery("kiali_ai_tokens_monthly_total", 5000)
	mockQuery("kiali_ai_prompt_tokens_monthly_total", 3000)
	mockQuery("kiali_ai_completion_tokens_monthly_total", 2000)

	ts := httptest.NewServer(setupChatUsageHandler(conf, promClient))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=monthly&from=1767225600&since=1790812800&consumption=true")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	summary, ok := body["summary"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'summary' object")

	byProvider, ok := summary["byProvider"].([]interface{})
	require.True(t, ok)
	assert.Len(t, byProvider, 2) // anthropic + total

	anthropicRow, ok := byProvider[0].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(5000)/1_000_000, anthropicRow["totalTokens"])
	assert.Equal(t, float64(3000)/1_000_000, anthropicRow["promptTokens"])
	assert.Equal(t, float64(2000)/1_000_000, anthropicRow["completionTokens"])

	cost, ok := anthropicRow["cost"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'cost' object")

	// claude-sonnet-4-6 prices: input: 3.00, output: 15.00
	// input cost: (3000 / 1_000_000) * 3.00 = 0.009
	// output cost: (2000 / 1_000_000) * 15.00 = 0.030
	// total cost: 0.039
	assert.Equal(t, 0.009, cost["input"])
	assert.Equal(t, 0.030, cost["output"])
	assert.Equal(t, 0.039, cost["total"])
	assert.Equal(t, "USD", cost["currency"])
}

func TestChatUsage_Weekly_TopSummary_Success(t *testing.T) {
	internalmetrics.MarkAITokensSeedingComplete()
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true

	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Usernames: []string{"user3"},
			Interval:  config.WeeklyBudget,
			MaxCost:   15.50,
			MaxTokens: 0.25,
		},
	}

	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	// Mock three vectors representing: total, prompt, completion tokens
	mockQuery := func(metricName string, samples []*model.Sample) {
		ret := model.Vector(samples)
		promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
			return strings.Contains(q, metricName)
		}), mock.AnythingOfType("time.Time")).Return(ret, nil)
	}

	// We have three users: user1, user2, user3
	// user1: openai gpt-4o total 500k, prompt 300k, completion 200k
	// user2: anthropic claude-sonnet-4-6 total 300k, prompt 100k, completion 200k
	// user3: openai gpt-4o total 200k, prompt 100k, completion 100k
	//        anthropic claude-sonnet-4-6 total 400k, prompt 200k, completion 200k

	totalSamples := []*model.Sample{
		{Metric: model.Metric{"username": "user1", "ai_provider": "openai", "ai_model": "gpt-4o", "request": "chat", "year": "2026", "week": "36"}, Value: 500000},
		{Metric: model.Metric{"username": "user2", "ai_provider": "anthropic", "ai_model": "claude-sonnet-4-6", "request": "chat", "year": "2026", "week": "36"}, Value: 300000},
		{Metric: model.Metric{"username": "user3", "ai_provider": "openai", "ai_model": "gpt-4o", "request": "chat", "year": "2026", "week": "36"}, Value: 200000},
		{Metric: model.Metric{"username": "user3", "ai_provider": "anthropic", "ai_model": "claude-sonnet-4-6", "request": "chat", "year": "2026", "week": "36"}, Value: 400000},
	}
	promptSamples := []*model.Sample{
		{Metric: model.Metric{"username": "user1", "ai_provider": "openai", "ai_model": "gpt-4o", "request": "chat", "year": "2026", "week": "36"}, Value: 300000},
		{Metric: model.Metric{"username": "user2", "ai_provider": "anthropic", "ai_model": "claude-sonnet-4-6", "request": "chat", "year": "2026", "week": "36"}, Value: 100000},
		{Metric: model.Metric{"username": "user3", "ai_provider": "openai", "ai_model": "gpt-4o", "request": "chat", "year": "2026", "week": "36"}, Value: 100000},
		{Metric: model.Metric{"username": "user3", "ai_provider": "anthropic", "ai_model": "claude-sonnet-4-6", "request": "chat", "year": "2026", "week": "36"}, Value: 200000},
	}
	completionSamples := []*model.Sample{
		{Metric: model.Metric{"username": "user1", "ai_provider": "openai", "ai_model": "gpt-4o", "request": "chat", "year": "2026", "week": "36"}, Value: 200000},
		{Metric: model.Metric{"username": "user2", "ai_provider": "anthropic", "ai_model": "claude-sonnet-4-6", "request": "chat", "year": "2026", "week": "36"}, Value: 200000},
		{Metric: model.Metric{"username": "user3", "ai_provider": "openai", "ai_model": "gpt-4o", "request": "chat", "year": "2026", "week": "36"}, Value: 100000},
		{Metric: model.Metric{"username": "user3", "ai_provider": "anthropic", "ai_model": "claude-sonnet-4-6", "request": "chat", "year": "2026", "week": "36"}, Value: 200000},
	}

	mockQuery("kiali_ai_tokens_weekly_total", totalSamples)
	mockQuery("kiali_ai_prompt_tokens_weekly_total", promptSamples)
	mockQuery("kiali_ai_completion_tokens_weekly_total", completionSamples)

	ts := httptest.NewServer(setupChatUsageHandler(conf, promClient))
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "?window=weekly&from=1767225600&since=1790812800&consumption=true&limit=2")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	topSummary, ok := body["topSummary"].(map[string]interface{})
	require.True(t, ok, "response should contain a 'topSummary' object")

	// Verify topUsers (limit=2, sorted: user3 600k, user1 500k)
	topUsers, ok := topSummary["topUsers"].([]interface{})
	require.True(t, ok)
	require.Len(t, topUsers, 2)

	firstUser := topUsers[0].(map[string]interface{})
	assert.Equal(t, "user3", firstUser["username"])
	assert.Equal(t, 0.6, firstUser["totalTokens"]) // 600k tokens in millions = 0.6
	firstUserCost := firstUser["cost"].(map[string]interface{})
	// user3 gpt-4o cost: input: 100k/1M * 2.50 = 0.25, output: 100k/1M * 10.0 = 1.0. Total = 1.25
	// user3 claude-sonnet-4-6 cost: input: 200k/1M * 3.0 = 0.60, output: 200k/1M * 15.0 = 3.0. Total = 3.60
	// Grand total cost = 1.25 + 3.60 = 4.85
	assert.Equal(t, 4.85, firstUserCost["total"])

	budget, ok := firstUser["budget"].(map[string]interface{})
	require.True(t, ok, "firstUser should have a budget object")
	assert.True(t, budget["has_budget"].(bool))
	assert.Equal(t, "weekly", budget["interval"])
	assert.Equal(t, 15.50, budget["max_cost"])
	assert.Equal(t, 0.25, budget["max_tokens"])
	assert.Equal(t, 0.0, budget["remaining_tokens"])

	secondUser := topUsers[1].(map[string]interface{})
	assert.Equal(t, "user1", secondUser["username"])
	assert.Equal(t, 0.5, secondUser["totalTokens"]) // 500k tokens in millions = 0.5
	secondUserCost := secondUser["cost"].(map[string]interface{})
	// user1 gpt-4o cost: input: 300k/1M * 2.50 = 0.75, output: 200k/1M * 10.0 = 2.0. Total = 2.75
	assert.Equal(t, 2.75, secondUserCost["total"])

	// Verify topModels (limit=2, sorted by tokens descending; anthropic/claude-sonnet-4-6 has 700k, openai/gpt-4o has 700k. sorted alphabetically by provider/model: anthropic/claude-sonnet-4-6 is first)
	topModels, ok := topSummary["topModels"].([]interface{})
	require.True(t, ok)
	require.Len(t, topModels, 2)

	firstModel := topModels[0].(map[string]interface{})
	assert.Equal(t, "claude-sonnet-4-6", firstModel["model"])
	assert.Equal(t, "anthropic", firstModel["provider"])
	assert.Equal(t, 0.7, firstModel["totalTokens"]) // 700k tokens in millions = 0.7
	firstModelCost := firstModel["cost"].(map[string]interface{})
	// claude-sonnet-4-6 cost: input: 300k/1M * 3.0 = 0.90, output: 400k/1M * 15.0 = 6.00. Total = 6.90
	assert.Equal(t, 6.90, firstModelCost["total"])

	secondModel := topModels[1].(map[string]interface{})
	assert.Equal(t, "gpt-4o", secondModel["model"])
	assert.Equal(t, "openai", secondModel["provider"])
	assert.Equal(t, 0.7, secondModel["totalTokens"]) // 700k tokens in millions = 0.7
	secondModelCost := secondModel["cost"].(map[string]interface{})
	// gpt-4o cost: input: 400k/1M * 2.50 = 1.00, output: 300k/1M * 10.0 = 3.00. Total = 4.00
	assert.Equal(t, 4.00, secondModelCost["total"])
}

func TestChatAI_BudgetDisallowedProvider(t *testing.T) {
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, openaiSSEResponse("should not be reached"))
	}))
	defer fakeAI.Close()

	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	conf.AI.Enabled = true
	conf.AI.Metrics = true

	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Usernames:        []string{"anonymous"},
			Interval:         config.WeeklyBudget,
			AllowedProviders: []config.ProviderType{config.AnthropicProvider}, // openai is not allowed
		},
	}

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/test-openai/gpt-4o/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	var payload map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	assert.Contains(t, payload["error"], "not allowed by your budget configuration")
}

func TestChatAI_BudgetDisallowedModel(t *testing.T) {
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, openaiSSEResponse("should not be reached"))
	}))
	defer fakeAI.Close()

	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	conf.AI.Enabled = true
	conf.AI.Metrics = true

	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Usernames:        []string{"anonymous"},
			Interval:         config.WeeklyBudget,
			AllowedProviders: []config.ProviderType{config.OpenAIProvider},
			AllowedModels:    []string{"gpt-3.5-turbo"}, // gpt-4o is not allowed
		},
	}

	handler, _, _ := setupChatAIHandlerForTest(t, conf)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/test-openai/gpt-4o/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	var payload map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	assert.Contains(t, payload["error"], "not allowed by your budget configuration")
}

func TestChatAI_BudgetCostLimitReached(t *testing.T) {
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, openaiSSEResponse("should not be reached"))
	}))
	defer fakeAI.Close()

	conf := chatAIConfWithFakeProvider(fakeAI.URL)
	conf.AI.Enabled = true
	conf.AI.Metrics = true

	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Usernames: []string{"anonymous"},
			Interval:  config.WeeklyBudget,
			MaxCost:   0.01, // extremely low cost limit
		},
	}
	// Setup pricing so we can calculate costs
	conf.AI.Consumption.ModelPricings = []config.ModelPricing{
		{
			Provider: config.OpenAIProvider,
			ModelID:  "gpt-4o",
			Currency: "USD",
			Prices: config.TokenPrices{
				InputCostPerMillion:  10.0,
				OutputCostPerMillion: 10.0,
			},
		},
	}

	// Record a massive amount of tokens to exceed the low 0.01 budget limit
	internalmetrics.RecordAITokens("anonymous", "openai", "gpt-4o", 50000, 50000, 100000)

	handler, promClient, _ := setupChatAIHandlerForTest(t, conf)
	promAPI := promClient.API().(*prometheustest.PromAPIMock)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_tokens_weekly_total")
	}), mock.Anything).Return(model.Vector{
		&model.Sample{
			Metric: model.Metric{"ai_provider": "openai", "ai_model": "gpt-4o"},
			Value:  100000,
		},
	}, nil)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_prompt_tokens_weekly_total")
	}), mock.Anything).Return(model.Vector{
		&model.Sample{
			Metric: model.Metric{"ai_provider": "openai", "ai_model": "gpt-4o"},
			Value:  50000,
		},
	}, nil)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_completion_tokens_weekly_total")
	}), mock.Anything).Return(model.Vector{
		&model.Sample{
			Metric: model.Metric{"ai_provider": "openai", "ai_model": "gpt-4o"},
			Value:  50000,
		},
	}, nil)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/{provider}/{model}/ai", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	body := bytes.NewBufferString(`{"query":"hello","conversation_id":"c1"}`)
	resp, err := http.Post(ts.URL+"/api/chat/test-openai/gpt-4o/ai", "application/json", body)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	var payload map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	assert.Contains(t, payload["error"], "AI request blocked: monetary budget reached")
}

func stubCurrentWeekRangeQueries(promAPI *prometheustest.PromAPIMock) {
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "increase(") || strings.Contains(q, "last_over_time(")
	}), mock.Anything).Return(model.Vector{}, nil)
	promAPI.On("QueryRange", mock.Anything, mock.Anything, mock.Anything).Return(model.Matrix{}, nil)
}

func TestAIUserUsage_ReturnsPersonaBudget(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true
	conf.Auth.Strategy = config.AuthStrategyToken

	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Usernames: []string{"session-budget-user"},
			Interval:  config.WeeklyBudget,
			MaxCost:   25.50,
			MaxTokens: 0.5,
		},
	}
	conf.AI.Consumption.ModelPricings = []config.ModelPricing{
		{
			Provider: config.OpenAIProvider,
			ModelID:  "gpt-4o",
			Currency: "USD",
			Prices: config.TokenPrices{
				InputCostPerMillion:  10.0,
				OutputCostPerMillion: 10.0,
			},
		},
	}

	aiStore := ai.NewAIStore(context.Background(), nil)

	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "max_over_time")
	}), mock.Anything).Return(model.Vector{}, nil)

	// First call expectations: return empty Vector
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_tokens_weekly_total") && strings.Contains(q, "sum by")
	}), mock.Anything).Return(model.Vector{}, nil).Once()

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_prompt_tokens_weekly_total") && strings.Contains(q, "sum by")
	}), mock.Anything).Return(model.Vector{}, nil).Once()

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_completion_tokens_weekly_total") && strings.Contains(q, "sum by")
	}), mock.Anything).Return(model.Vector{}, nil).Once()

	// Second call expectations: return 100k total, 50k prompt, 50k completion
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_tokens_weekly_total") && strings.Contains(q, "sum by")
	}), mock.Anything).Return(model.Vector{
		&model.Sample{
			Metric: model.Metric{"ai_provider": "openai", "ai_model": "gpt-4o"},
			Value:  100000,
		},
	}, nil).Once()

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_prompt_tokens_weekly_total") && strings.Contains(q, "sum by")
	}), mock.Anything).Return(model.Vector{
		&model.Sample{
			Metric: model.Metric{"ai_provider": "openai", "ai_model": "gpt-4o"},
			Value:  50000,
		},
	}, nil).Once()

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_completion_tokens_weekly_total") && strings.Contains(q, "sum by")
	}), mock.Anything).Return(model.Vector{
		&model.Sample{
			Metric: model.Metric{"ai_provider": "openai", "ai_model": "gpt-4o"},
			Value:  50000,
		},
	}, nil).Once()
	stubCurrentWeekRangeQueries(promAPI)

	handler := AIUserUsage(conf, aiStore, promClient)

	mr := mux.NewRouter()
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test", Username: "session-budget-user"}}
	mr.Handle("/api/ai/usage/user", WithAuthInfo(authInfo, handler))
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	// First call: 0 usage
	req, err := http.NewRequest(http.MethodGet, ts.URL+"/api/ai/usage/user", nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	var got struct {
		Session []aiTypes.UsageMetric `json:"session"`
		Metrics *aiUsageResponse      `json:"metrics"`
		Budget  *UserBudgetStatus     `json:"budget"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
	require.NotNil(t, got.Budget)
	assert.True(t, got.Budget.HasBudget)
	assert.Equal(t, config.WeeklyBudget, got.Budget.Interval)
	assert.Equal(t, 25.50, got.Budget.MaxCost)
	assert.Equal(t, 0.5, got.Budget.MaxTokens)
	assert.Equal(t, 25.50, got.Budget.RemainingCost)
	assert.Equal(t, 0.5, got.Budget.RemainingTokens)
	require.NotNil(t, got.Metrics)
	assert.Equal(t, "weekly", got.Metrics.TimeSeries.Window)
	assert.Empty(t, got.Session)

	// Record some usage: 100k tokens (cost = 1.00)
	internalmetrics.RecordAITokens("session-budget-user", "openai", "gpt-4o", 50000, 50000, 100000)

	// Second call: verify remaining budget is decremented
	req2, err := http.NewRequest(http.MethodGet, ts.URL+"/api/ai/usage/user", nil)
	require.NoError(t, err)
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusOK, resp2.StatusCode)
	var got2 struct {
		Session []aiTypes.UsageMetric `json:"session"`
		Metrics *aiUsageResponse      `json:"metrics"`
		Budget  *UserBudgetStatus     `json:"budget"`
	}
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&got2))
	require.NotNil(t, got2.Budget)
	assert.Equal(t, 24.50, got2.Budget.RemainingCost)
	assert.Equal(t, 0.4, got2.Budget.RemainingTokens)
}

func TestAIUserUsage_WeeklyMetricsFilteredToUserLastN(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true
	conf.Auth.Strategy = config.AuthStrategyToken
	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Usernames: []string{"session-budget-user"},
			Interval:  config.WeeklyBudget,
			MaxCost:   25.50,
			MaxTokens: 0.5,
		},
	}
	conf.AI.Consumption.ModelPricings = []config.ModelPricing{
		{
			Provider: config.OpenAIProvider,
			ModelID:  "gpt-4o",
			Currency: "USD",
			Prices: config.TokenPrices{
				InputCostPerMillion:  10.0,
				OutputCostPerMillion: 10.0,
			},
		},
	}

	aiStore := ai.NewAIStore(context.Background(), nil)
	require.NoError(t, aiStore.RecordUsage("session-budget-user", "openai", "gpt-4o", aiTypes.TokenUsage{
		PromptTokens:     10,
		CompletionTokens: 5,
		TotalTokens:      15,
	}))

	now := time.Now().UTC()
	year, week := now.ISOWeek()
	oldYear, oldWeek := now.AddDate(0, 0, -7*8).UTC().ISOWeek()

	currentSample := &model.Sample{
		Metric: model.Metric{
			"username":    "session-budget-user",
			"ai_provider": "openai",
			"ai_model":    "gpt-4o",
			"request":     "chat",
			"year":        model.LabelValue(strconv.Itoa(year)),
			"week":        model.LabelValue(strconv.Itoa(week)),
		},
		Value: 2000,
	}
	otherUserSample := &model.Sample{
		Metric: model.Metric{
			"username":    "someone-else",
			"ai_provider": "anthropic",
			"ai_model":    "claude",
			"request":     "chat",
			"year":        model.LabelValue(strconv.Itoa(year)),
			"week":        model.LabelValue(strconv.Itoa(week)),
		},
		Value: 9000,
	}
	oldSample := &model.Sample{
		Metric: model.Metric{
			"username":    "session-budget-user",
			"ai_provider": "openai",
			"ai_model":    "gpt-4o",
			"request":     "chat",
			"year":        model.LabelValue(strconv.Itoa(oldYear)),
			"week":        model.LabelValue(strconv.Itoa(oldWeek)),
		},
		Value: 50000,
	}

	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "sum by")
	}), mock.Anything).Return(model.Vector{}, nil)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "max_over_time") && strings.Contains(q, "kiali_ai_tokens_weekly_total")
	}), mock.Anything).Return(model.Vector{currentSample, otherUserSample, oldSample}, nil)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "max_over_time") && strings.Contains(q, "kiali_ai_prompt_tokens_weekly_total")
	}), mock.Anything).Return(model.Vector{
		&model.Sample{
			Metric: currentSample.Metric,
			Value:  1500,
		},
	}, nil)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "max_over_time") && strings.Contains(q, "kiali_ai_completion_tokens_weekly_total")
	}), mock.Anything).Return(model.Vector{
		&model.Sample{
			Metric: currentSample.Metric,
			Value:  500,
		},
	}, nil)
	stubCurrentWeekRangeQueries(promAPI)

	handler := AIUserUsage(conf, aiStore, promClient)
	mr := mux.NewRouter()
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test", Username: "session-budget-user"}}
	mr.Handle("/api/ai/usage/user", WithAuthInfo(authInfo, handler))
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodGet, ts.URL+"/api/ai/usage/user?n=4", nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	var got struct {
		Session []aiTypes.UsageMetric `json:"session"`
		Metrics *struct {
			Summary struct {
				ByProvider []map[string]interface{} `json:"byProvider"`
			} `json:"summary"`
			TimeSeries struct {
				Window string `json:"window"`
				Series []struct {
					Provider string `json:"provider"`
					Model    string `json:"model"`
					Points   []struct {
						TotalTokens float64 `json:"totalTokens"`
					} `json:"points"`
				} `json:"series"`
			} `json:"timeSeries"`
		} `json:"metrics"`
		Budget *UserBudgetStatus `json:"budget"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
	require.Len(t, got.Session, 1)
	assert.Equal(t, int64(15), got.Session[0].TotalTokens)
	require.NotNil(t, got.Metrics)
	assert.Equal(t, "weekly", got.Metrics.TimeSeries.Window)
	require.Len(t, got.Metrics.TimeSeries.Series, 1)
	assert.Equal(t, "openai", got.Metrics.TimeSeries.Series[0].Provider)
	assert.Equal(t, "gpt-4o", got.Metrics.TimeSeries.Series[0].Model)
	require.Len(t, got.Metrics.TimeSeries.Series[0].Points, 1)
	assert.InDelta(t, 2000.0/1_000_000.0, got.Metrics.TimeSeries.Series[0].Points[0].TotalTokens, 1e-12)

	var openaiRow map[string]interface{}
	for _, row := range got.Metrics.Summary.ByProvider {
		if row["provider"] == "openai" {
			openaiRow = row
			break
		}
	}
	require.NotNil(t, openaiRow)
	assert.InDelta(t, 2000.0/1_000_000.0, openaiRow["totalTokens"], 1e-12)
}

func TestAIUserUsage_MonthlyBudgetUsesMonthlyMetrics(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true
	conf.Auth.Strategy = config.AuthStrategyToken
	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Usernames: []string{"monthly-user"},
			Interval:  config.MonthlyBudget,
			MaxCost:   10,
			MaxTokens: 1,
		},
	}

	aiStore := ai.NewAIStore(context.Background(), nil)
	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "sum by")
	}), mock.Anything).Return(model.Vector{}, nil)

	now := time.Now().UTC()
	monthSample := &model.Sample{
		Metric: model.Metric{
			"username":    "monthly-user",
			"ai_provider": "openai",
			"ai_model":    "gpt-4o",
			"request":     "chat",
			"year":        model.LabelValue(strconv.Itoa(now.Year())),
			"month":       model.LabelValue(strconv.Itoa(int(now.Month()))),
		},
		Value: 4000,
	}

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "max_over_time") && strings.Contains(q, "kiali_ai_tokens_monthly_total")
	}), mock.Anything).Return(model.Vector{monthSample}, nil)
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "max_over_time") && strings.Contains(q, "kiali_ai_prompt_tokens_monthly_total")
	}), mock.Anything).Return(model.Vector{}, nil)
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "max_over_time") && strings.Contains(q, "kiali_ai_completion_tokens_monthly_total")
	}), mock.Anything).Return(model.Vector{}, nil)
	stubCurrentWeekRangeQueries(promAPI)

	handler := AIUserUsage(conf, aiStore, promClient)
	mr := mux.NewRouter()
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test", Username: "monthly-user"}}
	mr.Handle("/api/ai/usage/user", WithAuthInfo(authInfo, handler))
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodGet, ts.URL+"/api/ai/usage/user", nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	var got struct {
		Metrics *struct {
			TimeSeries struct {
				Window string `json:"window"`
			} `json:"timeSeries"`
		} `json:"metrics"`
		Budget *UserBudgetStatus `json:"budget"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
	require.NotNil(t, got.Budget)
	assert.Equal(t, config.MonthlyBudget, got.Budget.Interval)
	require.NotNil(t, got.Metrics)
	assert.Equal(t, "monthly", got.Metrics.TimeSeries.Window)
}

func TestAIUserUsage_AnonymousSessionQueriesPrometheusUsername(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true
	conf.Auth.Strategy = config.AuthStrategyAnonymous
	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Usernames: []string{"anonymous"},
			Interval:  config.WeeklyBudget,
			MaxCost:   5,
			MaxTokens: 2.5,
		},
	}

	aiStore := ai.NewAIStore(context.Background(), nil)
	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	now := time.Now().UTC()
	year, week := now.ISOWeek()
	sample := &model.Sample{
		Metric: model.Metric{
			"username":    "anonymous",
			"ai_provider": "openai",
			"ai_model":    "gpt-4o",
			"request":     "chat",
			"year":        model.LabelValue(strconv.Itoa(year)),
			"week":        model.LabelValue(strconv.Itoa(week)),
		},
		Value: 2000,
	}

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		if strings.Contains(q, `username="anonymous-shared"`) {
			t.Errorf("prometheus query used session ID as username: %s", q)
		}
		return strings.Contains(q, `username="anonymous"`)
	}), mock.Anything).Return(model.Vector{sample}, nil)
	promAPI.On("QueryRange", mock.Anything, mock.Anything, mock.Anything).Return(model.Matrix{}, nil)

	handler := withSessionID(AnonymousSessionID, AIUserUsage(conf, aiStore, promClient))
	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var got struct {
		Session []aiTypes.UsageMetric `json:"session"`
		Metrics *struct {
			Summary struct {
				ByProvider []map[string]interface{} `json:"byProvider"`
			} `json:"summary"`
			TimeSeries struct {
				Window string `json:"window"`
				Series []struct {
					Provider string `json:"provider"`
				} `json:"series"`
			} `json:"timeSeries"`
		} `json:"metrics"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
	assert.Empty(t, got.Session)
	require.NotNil(t, got.Metrics)
	assert.Equal(t, "weekly", got.Metrics.TimeSeries.Window)
	require.NotEmpty(t, got.Metrics.TimeSeries.Series)
	assert.Equal(t, "openai", got.Metrics.TimeSeries.Series[0].Provider)
}

func TestAIUserUsage_CurrentPeriodHourlyFromWeekStart(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true
	conf.Auth.Strategy = config.AuthStrategyToken
	conf.AI.Consumption.Budgets = []config.UserBudgetConfig{
		{
			Interval:  config.WeeklyBudget,
			MaxCost:   10,
			MaxTokens: 0.5,
			Usernames: []string{"week-chart-user"},
		},
	}
	conf.AI.Consumption.ModelPricings = []config.ModelPricing{
		{
			Currency: "USD",
			ModelID:  "gpt-4o",
			Prices: config.TokenPrices{
				InputCostPerMillion:  10.0,
				OutputCostPerMillion: 10.0,
			},
			Provider: config.OpenAIProvider,
		},
	}

	aiStore := ai.NewAIStore(context.Background(), nil)
	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)

	promAPI.On("Query", mock.Anything, mock.Anything, mock.Anything).Return(model.Vector{}, nil)

	now := time.Now().UTC()
	year, week := now.ISOWeek()
	weekStart := isoWeekToTime(year, week)
	metric := model.Metric{
		"ai_model":    "gpt-4o",
		"ai_provider": "openai",
		"request":     "chat",
		"username":    "week-chart-user",
	}

	buildPairs := func(perHour float64) []model.SamplePair {
		var pairs []model.SamplePair
		for i := 0; i < 36; i++ {
			ts := weekStart.Add(time.Duration(i) * time.Hour)
			if !ts.Before(now) {
				break
			}
			pairs = append(pairs, model.SamplePair{
				Timestamp: model.TimeFromUnix(ts.Unix()),
				Value:     model.SampleValue(perHour),
			})
		}
		return pairs
	}

	totalPairs := buildPairs(20000)
	require.NotEmpty(t, totalPairs)

	promAPI.On("QueryRange", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_tokens_weekly_total") && strings.Contains(q, "week=")
	}), mock.Anything).Return(model.Matrix{&model.SampleStream{Metric: metric, Values: totalPairs}}, nil)
	promAPI.On("QueryRange", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_prompt_tokens_weekly_total")
	}), mock.Anything).Return(model.Matrix{&model.SampleStream{Metric: metric, Values: buildPairs(12000)}}, nil)
	promAPI.On("QueryRange", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "kiali_ai_completion_tokens_weekly_total")
	}), mock.Anything).Return(model.Matrix{&model.SampleStream{Metric: metric, Values: buildPairs(8000)}}, nil)

	handler := AIUserUsage(conf, aiStore, promClient)
	mr := mux.NewRouter()
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test", Username: "week-chart-user"}}
	mr.Handle("/api/ai/usage/user", WithAuthInfo(authInfo, handler))
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodGet, ts.URL+"/api/ai/usage/user", nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	var got struct {
		CurrentPeriod *struct {
			TimeSeries struct {
				Series []struct {
					Model  string `json:"model"`
					Points []struct {
						Timestamp   time.Time `json:"timestamp"`
						TotalTokens float64   `json:"totalTokens"`
					} `json:"points"`
					Provider string `json:"provider"`
				} `json:"series"`
				Step   string `json:"step"`
				Window string `json:"window"`
			} `json:"timeSeries"`
		} `json:"currentPeriod"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
	require.NotNil(t, got.CurrentPeriod)
	assert.Equal(t, "weekly", got.CurrentPeriod.TimeSeries.Window)
	assert.Equal(t, "3600", got.CurrentPeriod.TimeSeries.Step)
	require.Len(t, got.CurrentPeriod.TimeSeries.Series, 1)
	assert.Equal(t, "openai", got.CurrentPeriod.TimeSeries.Series[0].Provider)
	assert.Equal(t, "gpt-4o", got.CurrentPeriod.TimeSeries.Series[0].Model)
	require.NotEmpty(t, got.CurrentPeriod.TimeSeries.Series[0].Points)
	first := got.CurrentPeriod.TimeSeries.Series[0].Points[0].Timestamp.UTC()
	assert.False(t, first.Before(weekStart.Add(-time.Hour)))
	assert.True(t, first.Before(weekStart.Add(2*time.Hour)))
	assert.InDelta(t, 20000.0/1_000_000.0, got.CurrentPeriod.TimeSeries.Series[0].Points[0].TotalTokens, 1e-12)
}

func TestAIUserUsage_CurrentPeriodIncludesLiveEvents(t *testing.T) {
	conf := config.NewConfig()
	conf.AI.Enabled = true
	conf.AI.ChatAI.Enabled = true
	conf.AI.Metrics = true
	conf.Auth.Strategy = config.AuthStrategyToken

	username := "live-week-chart-user"
	internalmetrics.RecordAITokens(username, "openai", "gpt-4o", 12000, 8000, 20000)

	aiStore := ai.NewAIStore(context.Background(), nil)
	promAPI := new(prometheustest.PromAPIMock)
	promClient := new(prometheustest.PromClientMock)
	promClient.On("API").Return(promAPI)
	promAPI.On("Query", mock.Anything, mock.Anything, mock.Anything).Return(model.Vector{}, nil)
	stubCurrentWeekRangeQueries(promAPI)

	handler := AIUserUsage(conf, aiStore, promClient)
	mr := mux.NewRouter()
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test", Username: username}}
	mr.Handle("/api/ai/usage/user", WithAuthInfo(authInfo, handler))
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodGet, ts.URL+"/api/ai/usage/user", nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	var got struct {
		CurrentPeriod *struct {
			TimeSeries struct {
				Series []struct {
					Model  string `json:"model"`
					Points []struct {
						Timestamp   time.Time `json:"timestamp"`
						TotalTokens float64   `json:"totalTokens"`
					} `json:"points"`
					Provider string `json:"provider"`
				} `json:"series"`
			} `json:"timeSeries"`
		} `json:"currentPeriod"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
	require.NotNil(t, got.CurrentPeriod)
	require.Len(t, got.CurrentPeriod.TimeSeries.Series, 1)
	assert.Equal(t, "openai", got.CurrentPeriod.TimeSeries.Series[0].Provider)
	assert.Equal(t, "gpt-4o", got.CurrentPeriod.TimeSeries.Series[0].Model)
	require.NotEmpty(t, got.CurrentPeriod.TimeSeries.Series[0].Points)
	last := got.CurrentPeriod.TimeSeries.Series[0].Points[len(got.CurrentPeriod.TimeSeries.Series[0].Points)-1]
	assert.InDelta(t, 20000.0/1_000_000.0, last.TotalTokens, 1e-12)
	assert.False(t, last.Timestamp.Before(time.Now().UTC().Truncate(time.Hour).Add(-time.Hour)))
}
