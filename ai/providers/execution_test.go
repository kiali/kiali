package providers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
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
func (d dummyProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) {
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
