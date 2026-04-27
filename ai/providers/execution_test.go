package providers

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

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
	toolCalls := []mcp.ToolsProcessor{
		{Name: "nonexistent_tool", Args: map[string]any{}, ToolCallID: "tc-1"},
	}

	results := ExecuteToolCallsInParallel(ki, toolCalls)

	require.Len(t, results, 1)
	require.Error(t, results[0].Error)
	assert.Contains(t, results[0].Error.Error(), "tool handler not found")
	assert.Equal(t, http.StatusInternalServerError, results[0].Code)
}

func TestExecuteToolCallsInParallel_ContextCanceledBefore(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ki := newTestKialiInterfaceWithContext(t, ctx)

	toolCalls := []mcp.ToolsProcessor{
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "test"}, ToolCallID: "tc-1"},
	}

	results := ExecuteToolCallsInParallel(ki, toolCalls)

	require.Len(t, results, 1)
	require.Error(t, results[0].Error)
	assert.Contains(t, results[0].Error.Error(), "context canceled before executing tool")
	assert.Equal(t, http.StatusRequestTimeout, results[0].Code)
}

func TestExecuteToolCallsInParallel_ExcludedToolGetReferencedDocs(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []mcp.ToolsProcessor{
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "istio,kiali"}, ToolCallID: "tc-1"},
	}

	results := ExecuteToolCallsInParallel(ki, toolCalls)

	require.Len(t, results, 1)
	require.NoError(t, results[0].Error)
	assert.Equal(t, http.StatusOK, results[0].Code)
	assert.Equal(t, "tool", results[0].Message.Role)
	assert.Equal(t, "get_referenced_docs", results[0].Message.Name)
	assert.Greater(t, len(results[0].ReferencedDocs), 0, "get_referenced_docs should produce referenced docs")
	assert.Contains(t, results[0].Message.Content, "Documentation links")
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
	toolCalls := []mcp.ToolsProcessor{
		{
			Name: "get_action_ui",
			Args: map[string]any{
				"resourceType": "workload",
				"namespaces":   "does-not-exist",
			},
			ToolCallID: "tc-1",
		},
	}

	results := ExecuteToolCallsInParallel(ki, toolCalls)

	require.Len(t, results, 1)
	require.NoError(t, results[0].Error)
	assert.Equal(t, http.StatusOK, results[0].Code)
	assert.Empty(t, results[0].Actions)
	assert.Contains(t, results[0].Message.Content, "does-not-exist")
	assert.Contains(t, results[0].Message.Content, "Cannot generate UI actions")
}

func TestExecuteToolCallsInParallel_MultipleToolsInParallel(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []mcp.ToolsProcessor{
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "istio"}, ToolCallID: "tc-1"},
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "kiali"}, ToolCallID: "tc-2"},
	}

	results := ExecuteToolCallsInParallel(ki, toolCalls)

	require.Len(t, results, 2)
	for i, r := range results {
		require.NoError(t, r.Error, "tool %d should not error", i)
		assert.Equal(t, http.StatusOK, r.Code, "tool %d should return 200", i)
	}
	assert.Equal(t, "get_referenced_docs", results[0].Message.Name)
	assert.Equal(t, "get_referenced_docs", results[1].Message.Name)
}

func TestExecuteToolCallsInParallel_EmptyToolCalls(t *testing.T) {
	ki := newTestKialiInterface(t)
	results := ExecuteToolCallsInParallel(ki, []mcp.ToolsProcessor{})
	assert.Empty(t, results)
}

func TestExecuteToolCallsInParallel_MixedValidAndInvalid(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []mcp.ToolsProcessor{
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "test"}, ToolCallID: "tc-valid"},
		{Name: "nonexistent_tool", Args: map[string]any{}, ToolCallID: "tc-invalid"},
	}

	results := ExecuteToolCallsInParallel(ki, toolCalls)

	require.Len(t, results, 2)
	assert.NoError(t, results[0].Error, "valid tool should succeed")
	assert.Error(t, results[1].Error, "invalid tool should fail")
	assert.Contains(t, results[1].Error.Error(), "tool handler not found")
}

func TestExecuteToolCallsInParallel_PreservesResultOrder(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ki := newTestKialiInterface(t)
	toolCalls := []mcp.ToolsProcessor{
		{Name: "nonexistent_a", Args: map[string]any{}, ToolCallID: "tc-a"},
		{Name: "get_referenced_docs", Args: map[string]any{"keywords": "test"}, ToolCallID: "tc-b"},
		{Name: "nonexistent_c", Args: map[string]any{}, ToolCallID: "tc-c"},
	}

	results := ExecuteToolCallsInParallel(ki, toolCalls)

	require.Len(t, results, 3)
	assert.Error(t, results[0].Error, "first should be error (nonexistent_a)")
	assert.NoError(t, results[1].Error, "second should succeed (get_referenced_docs)")
	assert.Error(t, results[2].Error, "third should be error (nonexistent_c)")
}

// --- ProcessToolResults tests ---

func TestProcessToolResults_NoResults(t *testing.T) {
	result := ProcessToolResults(nil, nil)
	assert.NotNil(t, result.Response)
	assert.False(t, result.ShouldReturnEarly)
	assert.Empty(t, result.Response.Error)
}

func TestProcessToolResults_WithError(t *testing.T) {
	toolResults := []mcp.ToolCallResult{
		{Error: fmt.Errorf("tool execution failed"), Code: http.StatusInternalServerError},
	}

	result := ProcessToolResults(toolResults, nil)
	assert.True(t, result.ShouldReturnEarly)
	assert.Equal(t, "tool execution failed", result.Response.Error)
}

func TestProcessToolResults_ErrorStopsProcessing(t *testing.T) {
	toolResults := []mcp.ToolCallResult{
		{Error: fmt.Errorf("first error"), Code: http.StatusInternalServerError},
		{
			Message: types.ConversationMessage{Content: "should not be reached", Role: "tool"},
			Code:    http.StatusOK,
		},
	}

	result := ProcessToolResults(toolResults, nil)
	assert.True(t, result.ShouldReturnEarly)
	assert.Equal(t, "first error", result.Response.Error)
}

func TestProcessToolResults_CollectsActions(t *testing.T) {
	toolResults := []mcp.ToolCallResult{
		{
			Code:    http.StatusOK,
			Actions: []get_action_ui.Action{{Title: "Navigate", Kind: get_action_ui.ActionKindNavigation, Payload: "/test"}},
		},
	}

	result := ProcessToolResults(toolResults, nil)
	assert.False(t, result.ShouldReturnEarly)
	require.Len(t, result.Response.Actions, 1)
	assert.Equal(t, "/test", result.Response.Actions[0].Payload)
}

func TestProcessToolResults_CollectsReferencedDocs(t *testing.T) {
	toolResults := []mcp.ToolCallResult{
		{
			Code:           http.StatusOK,
			ReferencedDocs: []types.ReferencedDoc{{DocURL: "https://istio.io", DocTitle: "Istio Docs"}},
		},
	}

	result := ProcessToolResults(toolResults, nil)
	assert.False(t, result.ShouldReturnEarly)
	require.Len(t, result.Response.ReferencedDocs, 1)
	assert.Equal(t, "https://istio.io", result.Response.ReferencedDocs[0].DocURL)
}

func TestProcessToolResults_ActionsSkipConversation(t *testing.T) {
	conversation := []types.ConversationMessage{{Role: "user", Content: "hi"}}
	toolResults := []mcp.ToolCallResult{
		{
			Message: types.ConversationMessage{Content: "action content", Role: "tool"},
			Code:    http.StatusOK,
			Actions: []get_action_ui.Action{{Title: "Go", Kind: get_action_ui.ActionKindNavigation, Payload: "/test"}},
		},
	}

	result := ProcessToolResults(toolResults, conversation)
	assert.False(t, result.ShouldReturnEarly)
	assert.Len(t, result.Conversation, 1, "actions should not add messages to conversation")
}

func TestProcessToolResults_AppendsToolMessages(t *testing.T) {
	conversation := []types.ConversationMessage{{Role: "user", Content: "hi"}}
	toolResults := []mcp.ToolCallResult{
		{
			Message: types.ConversationMessage{Content: "tool output", Name: "test_tool", Role: "tool"},
			Code:    http.StatusOK,
		},
	}

	result := ProcessToolResults(toolResults, conversation)
	assert.False(t, result.ShouldReturnEarly)
	require.Len(t, result.Conversation, 2)
	assert.Equal(t, "tool output", result.Conversation[1].Content)
	assert.Equal(t, "test_tool", result.Conversation[1].Name)
}

func TestProcessToolResults_EmptyContentNotAppended(t *testing.T) {
	conversation := []types.ConversationMessage{{Role: "user", Content: "hi"}}
	toolResults := []mcp.ToolCallResult{
		{
			Message: types.ConversationMessage{Content: "", Role: "tool"},
			Code:    http.StatusOK,
		},
	}

	result := ProcessToolResults(toolResults, conversation)
	assert.Len(t, result.Conversation, 1, "empty tool content should not be appended")
}

func TestProcessToolResults_MultipleToolResults(t *testing.T) {
	conversation := []types.ConversationMessage{{Role: "user", Content: "hi"}}
	toolResults := []mcp.ToolCallResult{
		{
			Message: types.ConversationMessage{Content: "tool-1 output", Name: "tool1", Role: "tool"},
			Code:    http.StatusOK,
		},
		{
			Message:        types.ConversationMessage{Content: "action content", Role: "tool"},
			Code:           http.StatusOK,
			Actions:        []get_action_ui.Action{{Title: "View", Kind: get_action_ui.ActionKindNavigation, Payload: "/view"}},
			ReferencedDocs: []types.ReferencedDoc{{DocURL: "https://docs.example.com", DocTitle: "Example"}},
		},
		{
			Message: types.ConversationMessage{Content: "tool-3 output", Name: "tool3", Role: "tool"},
			Code:    http.StatusOK,
		},
	}

	result := ProcessToolResults(toolResults, conversation)
	assert.False(t, result.ShouldReturnEarly)
	require.Len(t, result.Conversation, 3, "should append 2 tool messages (action-only skipped)")
	assert.Len(t, result.Response.Actions, 1)
	assert.Len(t, result.Response.ReferencedDocs, 1)
}

// --- AddContextToConversation tests ---

func TestAddContextToConversation_EmptyConversation(t *testing.T) {
	result := AddContextToConversation(nil, types.AIRequest{})
	assert.Nil(t, result)

	result = AddContextToConversation([]types.ConversationMessage{}, types.AIRequest{})
	assert.Empty(t, result)
}

func TestAddContextToConversation_InsertsAfterSystem(t *testing.T) {
	conversation := []types.ConversationMessage{
		{Role: "system", Content: "You are an assistant."},
		{Role: "user", Content: "Hello"},
	}
	req := types.AIRequest{
		Context: types.AIContext{
			PageURL:         "/kiali/graph",
			PageDescription: "Traffic Graph",
		},
	}

	result := AddContextToConversation(conversation, req)

	require.Len(t, result, 3)
	assert.Equal(t, "system", result[0].Role, "first should be system instruction")
	assert.Equal(t, "system", result[1].Role, "second should be context")
	assert.Contains(t, result[1].Content, "CONTEXT (JSON)")
	assert.Contains(t, result[1].Content, "Traffic Graph")
	assert.Equal(t, "user", result[2].Role, "third should be user message")
}

func TestAddContextToConversation_DoesNotModifyOriginal(t *testing.T) {
	original := []types.ConversationMessage{
		{Role: "system", Content: "instruction"},
		{Role: "user", Content: "query"},
	}
	req := types.AIRequest{Context: types.AIContext{PageURL: "/test"}}

	result := AddContextToConversation(original, req)

	assert.Len(t, original, 2, "original should not be modified")
	assert.Len(t, result, 3, "result should have context inserted")
}

// --- CleanConversation additional tests ---

func TestCleanConversation_RemovesGetLogsToolMessages(t *testing.T) {
	conversation := []types.ConversationMessage{
		{Role: "user", Content: "show logs"},
		{Role: "tool", Name: "get_logs", Content: "log line 1\nlog line 2"},
		{Role: "assistant", Content: "Here are the logs"},
	}

	CleanConversation(&conversation)

	require.Len(t, conversation, 2)
	assert.Equal(t, "user", conversation[0].Role)
	assert.Equal(t, "assistant", conversation[1].Role)
}

func TestCleanConversation_RemovesLogLikeToolMessages(t *testing.T) {
	logContent := "~~~\n" + "2024-01-15 10:00:00 " + makeString(1600) + "\n~~~\n"
	conversation := []types.ConversationMessage{
		{Role: "user", Content: "check logs"},
		{Role: "tool", Name: "some_tool", Content: logContent},
		{Role: "assistant", Content: "analysis"},
	}

	CleanConversation(&conversation)

	require.Len(t, conversation, 2)
	assert.Equal(t, "user", conversation[0].Role)
	assert.Equal(t, "assistant", conversation[1].Role)
}

func TestCleanConversation_RemovesLargeLogLikeAssistantMessages(t *testing.T) {
	logContent := "~~~\n" + "2024-01-15 10:00:00 " + makeString(4100) + "\n~~~\n"
	conversation := []types.ConversationMessage{
		{Role: "user", Content: "show me logs"},
		{Role: "assistant", Content: logContent},
	}

	CleanConversation(&conversation)

	require.Len(t, conversation, 1)
	assert.Equal(t, "user", conversation[0].Role)
}

func TestCleanConversation_KeepsNormalMessages(t *testing.T) {
	conversation := []types.ConversationMessage{
		{Role: "system", Content: "instruction"},
		{Role: "user", Content: "hello"},
		{Role: "tool", Name: "get_mesh_status", Content: "mesh is healthy"},
		{Role: "assistant", Content: "Everything looks good"},
	}

	CleanConversation(&conversation)

	assert.Len(t, conversation, 4, "normal messages should be preserved")
}

// --- FormatToolContent additional tests ---

func TestFormatToolContent_Struct(t *testing.T) {
	input := struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}{"test", 42}

	out, err := FormatToolContent(input)
	require.NoError(t, err)
	assert.Contains(t, out, `"name":"test"`)
	assert.Contains(t, out, `"count":42`)
}

func TestFormatToolContent_Nil(t *testing.T) {
	out, err := FormatToolContent(nil)
	require.NoError(t, err)
	assert.Equal(t, "null", out)
}

// --- ResolveProviderKey additional tests ---

func TestResolveProviderKey_ProviderAndModelNameInError(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{Name: "my-provider", Key: ""}
	model := &config.AIModel{Name: "my-model", Key: ""}

	_, err := ResolveProviderKey(conf, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "my-provider")
	assert.Contains(t, err.Error(), "my-model")
}

// --- ParseMarkdownResponse additional tests ---

func TestParseMarkdownResponse_SanitizesPseudoToolTags(t *testing.T) {
	input := "Here is <execute_browse>some content</execute_browse>"
	result := ParseMarkdownResponse(input)
	assert.NotContains(t, result, "<execute_browse>")
	assert.NotContains(t, result, "</execute_browse>")
	assert.Contains(t, result, "some content")
}

func TestParseMarkdownResponse_MultipleCodeBlocks(t *testing.T) {
	input := "```go\nfmt.Println(\"a\")\n```\n\n```yaml\nkey: val\n```"
	expected := "~~~go\nfmt.Println(\"a\")\n~~~\n\n~~~yaml\nkey: val\n~~~"
	assert.Equal(t, expected, ParseMarkdownResponse(input))
}

// --- GetStoreConversation: disabled store ---

func TestGetStoreConversation_DisabledStore(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/", nil)
	r = r.WithContext(authentication.SetSessionIDContext(r.Context(), "test-session"))

	store := &fakeStore{enabled: false}
	req := types.AIRequest{ConversationID: "c1", Query: "hello"}

	ptr, sessionID, conversation := GetStoreConversation(r, req, store)
	assert.Nil(t, ptr, "ptr should be nil when store is disabled")
	assert.Equal(t, "test-session", sessionID)
	assert.Nil(t, conversation, "conversation should be nil when store is disabled")
	assert.Equal(t, 0, store.getCalls, "should not call GetConversation when disabled")
}

func TestGetStoreConversation_EnabledStoreNewConversation(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/", nil)
	r = r.WithContext(authentication.SetSessionIDContext(r.Context(), "test-session"))

	store := &fakeStore{enabled: true, conversations: map[string]*types.Conversation{}}
	req := types.AIRequest{ConversationID: "new-conv", Query: "hello"}

	ptr, sessionID, conversation := GetStoreConversation(r, req, store)
	assert.NotNil(t, ptr, "ptr should be created for new conversation")
	assert.Equal(t, "test-session", sessionID)
	assert.Nil(t, conversation, "conversation should be empty for new conversation")
}

// --- StoreConversation: disabled store ---

func TestStoreConversation_DisabledStore(t *testing.T) {
	store := &fakeStore{enabled: false}
	ptr := &types.Conversation{}
	req := types.AIRequest{ConversationID: "c1"}
	conversation := []types.ConversationMessage{{Role: "user", Content: "hello"}}

	StoreConversation(&fakeProvider{}, context.Background(), store, ptr, "s1", req, conversation)

	assert.Equal(t, 0, store.setCalls, "should not call SetConversation when store is disabled")
}

// --- CleanConversation: small log-like messages are kept ---

func TestCleanConversation_KeepsSmallToolMessages(t *testing.T) {
	smallLogContent := "~~~\n2024-01-15 10:00:00 short log\n~~~\n"
	conversation := []types.ConversationMessage{
		{Role: "user", Content: "check logs"},
		{Role: "tool", Name: "some_tool", Content: smallLogContent},
		{Role: "assistant", Content: "here"},
	}

	CleanConversation(&conversation)

	assert.Len(t, conversation, 3, "small log-like messages (< 1500 bytes) should be kept")
}

func TestCleanConversation_KeepsSmallAssistantMessages(t *testing.T) {
	smallContent := "~~~\n2024-01-15 10:00:00 short\n~~~\n"
	conversation := []types.ConversationMessage{
		{Role: "user", Content: "hi"},
		{Role: "assistant", Content: smallContent},
	}

	CleanConversation(&conversation)

	assert.Len(t, conversation, 2, "small assistant messages (< 4000 bytes) should be kept")
}

func makeString(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = 'x'
	}
	return string(b)
}
