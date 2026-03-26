package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/perses"
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
	// - get_referenced_docs (no header): uses MCPToolHandlers, returns 200
	// - get_action_ui (no header): uses MCPToolHandlers, returns 200
	// - get_referenced_docs + kiali_chatbot header: uses DefaultToolHandlers, tool not in default → 404
	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			var tool string
			var body map[string]interface{}
			withChatbotHeader := false
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
				withChatbotHeader = true
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
			if withChatbotHeader {
				req.Header.Set("kiali_chatbot", "true")
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
	// when kiali_chatbot header is set (get_referenced_docs not in default), depending on env.
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

func TestChatMCP_UsesDefaultHandlersWhenKialiChatbotHeaderSet(t *testing.T) {
	require := require.New(t)
	require.NoError(mcp.LoadTools())

	handler, _ := SetupChatMCPHandlerForTest(t)
	mr := mux.NewRouter()
	mr.Handle("/api/chat/mcp/{tool_name}", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	// Tool with toolset: [mcp] only (e.g. get_referenced_docs) is in MCPToolHandlers but not in DefaultToolHandlers.
	// Without header: should be found (MCPToolHandlers). With header kiali_chatbot: should be 404 (DefaultToolHandlers).
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
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Without kiali_chatbot header, tool should be found (MCPToolHandlers)")

	body2 := bytes.NewBufferString(`{}`)
	req2, err := http.NewRequest(http.MethodPost, ts.URL+"/api/chat/mcp/"+excludedTool, body2)
	require.NoError(err)
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("kiali_chatbot", "true")
	resp2, err := ts.Client().Do(req2)
	require.NoError(err)
	t.Cleanup(func() { resp2.Body.Close() })
	assert.Equal(t, http.StatusNotFound, resp2.StatusCode, "With kiali_chatbot header, tool should not be found (DefaultToolHandlers)")
}
