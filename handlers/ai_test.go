package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gorilla/mux"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
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
	grafanaSvc := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	persesSvc := perses.NewService(conf, cf.GetSAHomeClusterClient())

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
	grafanaSvc := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	persesSvc := perses.NewService(conf, cf.GetSAHomeClusterClient())
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

func setupChatAIHandlerForTest(t *testing.T, conf *config.Config) (http.Handler, *config.Config, aiTypes.AIStore) {
	t.Helper()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)
	prom := &prometheustest.PromClientMock{}
	grafanaSvc := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	persesSvc := perses.NewService(conf, cf.GetSAHomeClusterClient())

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

	return WithFakeAuthInfo(conf, handler), conf, aiStore
}

func TestChatAI_DisabledReturnsError(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = false

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
	conf.ChatAI.Enabled = true
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
}

func TestChatAI_ProviderNotFound(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = true
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
// ChatConversations and DeleteChatConversations handler tests
// ========================================================================

func setupConversationHandlersForTest(t *testing.T) (*mux.Router, aiTypes.AIStore) {
	t.Helper()
	conf := config.NewConfig()
	conf.ChatAI.Enabled = true

	aiStore := ai.NewAIStore(context.Background(), nil)

	listHandler := ChatConversations(conf, aiStore)
	deleteHandler := DeleteChatConversations(conf, aiStore)

	mr := mux.NewRouter()
	mr.Handle("/api/chat/conversations", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := authentication.SetSessionIDContext(r.Context(), "test-session")
		switch r.Method {
		case http.MethodGet:
			listHandler(w, r.WithContext(ctx))
		case http.MethodDelete:
			deleteHandler(w, r.WithContext(ctx))
		}
	}))

	return mr, aiStore
}

func TestChatConversations_ListEmpty(t *testing.T) {
	mr, _ := setupConversationHandlersForTest(t)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "/api/chat/conversations")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var ids []string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&ids))
	assert.Empty(t, ids)
}

func TestChatConversations_ListAfterSet(t *testing.T) {
	mr, aiStore := setupConversationHandlersForTest(t)

	conv := &aiTypes.Conversation{
		Conversation: []aiTypes.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, aiStore.SetConversation("test-session", "conv-1", conv))
	require.NoError(t, aiStore.SetConversation("test-session", "conv-2", conv))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "/api/chat/conversations")
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var ids []string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&ids))
	assert.Len(t, ids, 2)
	assert.ElementsMatch(t, []string{"conv-1", "conv-2"}, ids)
}

func TestDeleteChatConversations_MissingParam(t *testing.T) {
	mr, _ := setupConversationHandlersForTest(t)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations", nil)
	require.NoError(t, err)

	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "missing conversationIDs should return 400")
}

func TestDeleteChatConversations_Success(t *testing.T) {
	mr, aiStore := setupConversationHandlersForTest(t)

	conv := &aiTypes.Conversation{
		Conversation: []aiTypes.ConversationMessage{{Role: "user", Content: "hi"}},
	}
	require.NoError(t, aiStore.SetConversation("test-session", "conv-1", conv))
	require.NoError(t, aiStore.SetConversation("test-session", "conv-2", conv))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=conv-1", nil)
	require.NoError(t, err)

	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	ids := aiStore.GetConversationIDs("test-session")
	assert.Equal(t, []string{"conv-2"}, ids, "conv-1 should be deleted")
}

func TestChatConversations_DisabledReturnsError(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = false

	aiStore := ai.NewAIStore(context.Background(), nil)
	handler := ChatConversations(conf, aiStore)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/chat/conversations", nil)
	handler(w, r)

	assert.Equal(t, http.StatusInternalServerError, w.Code, "disabled ChatAI should return error")
}

func TestDeleteChatConversations_DisabledReturnsError(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = false

	aiStore := ai.NewAIStore(context.Background(), nil)
	handler := DeleteChatConversations(conf, aiStore)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodDelete, "/api/chat/conversations?conversationIDs=c1", nil)
	handler(w, r)

	assert.Equal(t, http.StatusInternalServerError, w.Code, "disabled ChatAI should return error")
}

func TestDeleteChatConversations_MultipleIDs(t *testing.T) {
	mr, aiStore := setupConversationHandlersForTest(t)

	for _, id := range []string{"conv-a", "conv-b", "conv-c", "conv-d"} {
		conv := &aiTypes.Conversation{
			Conversation: []aiTypes.ConversationMessage{{Role: "user", Content: id}},
		}
		require.NoError(t, aiStore.SetConversation("test-session", id, conv))
	}

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/api/chat/conversations?conversationIDs=conv-a,conv-c,conv-d", nil)
	require.NoError(t, err)

	resp, err := ts.Client().Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	ids := aiStore.GetConversationIDs("test-session")
	assert.Equal(t, []string{"conv-b"}, ids, "only conv-b should remain")
}

func TestChatAI_AuthInfoMissingClusterName(t *testing.T) {
	conf := config.NewConfig()
	conf.ChatAI.Enabled = true
	conf.Auth.Strategy = config.AuthStrategyToken
	conf.KubernetesConfig.ClusterName = "primary-cluster"

	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)
	prom := &prometheustest.PromClientMock{}
	grafanaSvc := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	persesSvc := perses.NewService(conf, cf.GetSAHomeClusterClient())
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
	conf.ChatAI.Enabled = true
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
	conf.ChatAI.Enabled = false

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
	conf.ChatAI.Enabled = true
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
