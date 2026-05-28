package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

type dummyProvider struct{}

func (d dummyProvider) GetName() string                                              { return "dummy" }
func (d dummyProvider) InitializeConversation(ptr *types.Conversation, query string) {}
func (d dummyProvider) ReduceConversation(ctx context.Context, ptr *types.Conversation, reduceThreshold int) {
}
func (d dummyProvider) GetToolDefinitions() interface{} { return nil }
func (d dummyProvider) TransformToolCallToToolsProcessor(toolCall any) ([]types.StreamToolCallData, []string, error) {
	return nil, nil, nil
}
func (d dummyProvider) ConversationToProvider(conversation []types.ConversationMessage) interface{} {
	return nil
}
func (d dummyProvider) ProviderToConversation(providerMessage interface{}) types.ConversationMessage {
	return types.ConversationMessage{}
}
func (d dummyProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) types.TokenUsage {
	return types.TokenUsage{}
}

func newTestKialiInterface(t *testing.T) *mcputil.KialiInterface {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/", nil)
	conf := config.NewConfig()
	return &mcputil.KialiInterface{
		Request: r,
		Conf:    conf,
	}
}

func newTestKialiInterfaceWithContext(t *testing.T, ctx context.Context) *mcputil.KialiInterface {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/", nil).WithContext(ctx)
	conf := config.NewConfig()
	return &mcputil.KialiInterface{
		Request: r,
		Conf:    conf,
	}
}

// --- ExecuteToolCallsInParallel tests ---

func TestExecuteToolCallsInParallel_UnknownToolHandler(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []types.StreamToolCallData{
		{Name: "nonexistent_tool", Args: map[string]any{}, ID: "tc-1"},
	}

	results, _, _ := ExecuteToolCallsInParallel(dummyProvider{}, func(chunk string) {}, ki, toolCalls)

	require.Len(t, results, 1)
	require.Equal(t, "error", results[0].Status)
	assert.Contains(t, results[0].Content, "tool handler not found")

}

func TestExecuteToolCallsInParallel_ContextCanceledBefore(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ki := newTestKialiInterfaceWithContext(t, ctx)

	toolCalls := []types.StreamToolCallData{
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "test"}, ID: "tc-1"},
	}

	results, _, _ := ExecuteToolCallsInParallel(dummyProvider{}, func(chunk string) {}, ki, toolCalls)

	require.Len(t, results, 1)
	require.Equal(t, "error", results[0].Status)
	assert.Contains(t, results[0].Content, "context canceled before executing tool")

}

func TestExecuteToolCallsInParallel_ExcludedToolGetReferencedDocs(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []types.StreamToolCallData{
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "istio,kiali"}, ID: "tc-1"},
	}

	results, _, docs := ExecuteToolCallsInParallel(dummyProvider{}, func(chunk string) {}, ki, toolCalls)

	require.Len(t, results, 1)
	require.Equal(t, "success", results[0].Status)
	assert.Greater(t, len(docs), 0, "get_referenced_docs should produce referenced docs")
	assert.Contains(t, results[0].Content, "Documentation links")
}

func TestExecuteToolCallsInParallel_ExcludedToolGetActionUIErrorIsSurfaced(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient()).Build()
	ki := &mcputil.KialiInterface{
		Request:       httptest.NewRequest(http.MethodPost, "/", nil),
		Conf:          conf,
		BusinessLayer: businessLayer,
	}
	toolCalls := []types.StreamToolCallData{
		{
			Name: "get_action_ui",
			Args: map[string]any{
				"resourceType": "workload",
				"namespaces":   "does-not-exist",
			},
			ID: "tc-1",
		},
	}

	results, _, _ := ExecuteToolCallsInParallel(dummyProvider{}, func(chunk string) {}, ki, toolCalls)

	require.Len(t, results, 1)
	require.Equal(t, "success", results[0].Status)

	assert.Contains(t, results[0].Content, "does-not-exist")
	assert.Contains(t, results[0].Content, "Cannot generate UI actions")
}

func TestExecuteToolCallsInParallel_MultipleToolsInParallel(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []types.StreamToolCallData{
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "istio"}, ID: "tc-1"},
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "kiali"}, ID: "tc-2"},
	}

	results, _, _ := ExecuteToolCallsInParallel(dummyProvider{}, func(chunk string) {}, ki, toolCalls)

	require.Len(t, results, 2)
	for i, r := range results {
		require.Equal(t, "success", r.Status, "tool %d should not error", i)

	}

}

func TestExecuteToolCallsInParallel_EmptyToolCalls(t *testing.T) {
	ki := newTestKialiInterface(t)
	results, _, _ := ExecuteToolCallsInParallel(dummyProvider{}, func(chunk string) {}, ki, []types.StreamToolCallData{})
	assert.Empty(t, results)
}

func TestExecuteToolCallsInParallel_MixedValidAndInvalid(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []types.StreamToolCallData{
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "test"}, ID: "tc-valid"},
		{Name: "nonexistent_tool", Args: map[string]any{}, ID: "tc-invalid"},
	}

	results, _, _ := ExecuteToolCallsInParallel(dummyProvider{}, func(chunk string) {}, ki, toolCalls)

	require.Len(t, results, 2)
	assert.Equal(t, "success", results[0].Status, "valid tool should succeed")
	assert.Equal(t, "error", results[1].Status, "invalid tool should fail")
	assert.Contains(t, results[1].Content, "tool handler not found")
}

func TestExecuteToolCallsInParallel_PreservesResultOrder(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []types.StreamToolCallData{
		{Name: "nonexistent_a", Args: map[string]any{}, ID: "tc-a"},
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "test"}, ID: "tc-b"},
		{Name: "nonexistent_c", Args: map[string]any{}, ID: "tc-c"},
	}

	results, _, _ := ExecuteToolCallsInParallel(dummyProvider{}, func(chunk string) {}, ki, toolCalls)

	require.Len(t, results, 3)
	assert.Equal(t, "error", results[0].Status, "first should be error (nonexistent_a)")
	assert.Equal(t, "success", results[1].Status, "second should succeed (get_referenced_docs)")
	assert.Equal(t, "error", results[2].Status, "third should be error (nonexistent_c)")
}

// TestExecuteToolCallsInParallel_SSEWritesSerialized verifies that concurrent
// goroutines never interleave bytes in the SSE output.  Every chunk emitted
// via onChunk must be independently parseable as a valid StreamEvent JSON
// object.  Running the test with -race will additionally catch any
// unsynchronised access to the underlying writer.
func TestExecuteToolCallsInParallel_SSEWritesSerialized(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	// Nonexistent tools trigger the "tool handler not found" error path, which
	// is the goroutine-internal SendStreamEvent(safeOnChunk, …) call we want to
	// exercise.  Use a large batch so many goroutines race to write.
	const n = 10
	calls := make([]types.StreamToolCallData, n)
	for i := 0; i < n; i++ {
		calls[i] = types.StreamToolCallData{
			Name: fmt.Sprintf("nonexistent_tool_%d", i),
			Args: map[string]any{},
			ID:   fmt.Sprintf("tc-%d", i),
		}
	}

	// Collect via a mutex-protected slice so the test itself is race-free.
	var mu sync.Mutex
	var received []string
	onChunk := func(chunk string) {
		mu.Lock()
		defer mu.Unlock()
		received = append(received, chunk)
	}

	results, _, _ := ExecuteToolCallsInParallel(dummyProvider{}, onChunk, ki, calls)

	require.Len(t, results, n)
	for _, r := range results {
		assert.Equal(t, "error", r.Status)
		assert.Contains(t, r.Content, "tool handler not found")
	}

	// n tool_call events (sequential) + n tool_result events (concurrent).
	require.Len(t, received, n*2,
		"expected %d tool_call + %d tool_result chunks", n, n)

	for _, chunk := range received {
		var event types.StreamEvent
		assert.NoError(t, json.Unmarshal([]byte(chunk), &event),
			"chunk is not valid JSON (interleaved bytes indicate a race): %q", chunk)
	}
}

// TestExecuteToolCallsInParallel_ManageIstioConfigPreviewExtractsActions
// verifies that when manage_istio_config is called with confirmed=false:
//   - the preview actions are extracted into the returned actions slice
//   - the tool_result content is the short "PREVIEW READY" summary text, not
//     the full JSON payload (the anonymous-struct type assertion must succeed)
//   - the tool_result SSE event is emitted with just the summary text
func TestExecuteToolCallsInParallel_ManageIstioConfigPreviewExtractsActions(t *testing.T) {
	// The fake k8s/Istio stores are separate so cache-wait polls would time
	// out (default 5 s).  Speed them up to keep the test fast.
	kubernetes.CacheWaitTimeout = 1 * time.Millisecond
	t.Cleanup(func() { kubernetes.CacheWaitTimeout = 5 * time.Second })

	require.NoError(t, mcp.LoadTools())

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	r := httptest.NewRequest(http.MethodPost, "/", nil)
	ki := &mcputil.KialiInterface{
		Request:       r,
		BusinessLayer: businessLayer,
		Conf:          conf,
	}

	toolCalls := []types.StreamToolCallData{
		{
			Name: "manage_istio_config",
			Args: map[string]any{
				"action":    "create",
				"confirmed": false,
				"namespace": "bookinfo",
				"group":     "networking.istio.io",
				"version":   "v1",
				"kind":      "DestinationRule",
				"object":    "reviews",
				"data": `apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: reviews
  namespace: bookinfo
spec:
  host: reviews
`,
			},
			ID: "tc-preview",
		},
	}

	var received []string
	results, actions, _ := ExecuteToolCallsInParallel(
		dummyProvider{}, collectChunks(&received), ki, toolCalls,
	)

	require.Len(t, results, 1)
	assert.Equal(t, "success", results[0].Status)

	// The content must be the short summary text — NOT the raw JSON struct.
	assert.Contains(t, results[0].Content, "PREVIEW READY",
		"tool_result content must be the summary text, not the JSON struct")
	assert.NotContains(t, results[0].Content, `"actions"`,
		"full JSON payload must not be returned to the model as tool_result content")

	// Actions must be extracted into the dedicated slice.
	require.NotEmpty(t, actions, "preview actions must be extracted from the tool result")
	assert.Equal(t, "DestinationRule", actions[0].KindName)
	assert.Equal(t, "create", actions[0].Operation)

	// The SSE tool_result event must also carry only the summary text.
	require.NotEmpty(t, received, "a tool_result SSE event must be emitted")
	toolResultFound := false
	for _, chunk := range received {
		var event types.StreamEvent
		require.NoError(t, json.Unmarshal([]byte(chunk), &event))
		if event.Event == LLM_TOOL_RESULT_EVENT {
			toolResultFound = true
			var tr types.StreamToolResultData
			require.NoError(t, json.Unmarshal(event.Data, &tr))
			assert.Contains(t, tr.Content, "PREVIEW READY")
			assert.NotContains(t, tr.Content, `"actions"`)
		}
	}
	assert.True(t, toolResultFound, "a tool_result SSE event must have been sent")
}
