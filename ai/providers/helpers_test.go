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
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
)

type fakeStore struct {
	enabled       bool
	reduceWithAI  bool
	reduceThresh  int
	getCalls      int
	setCalls      int
	conversations map[string]*types.Conversation
}

func (f *fakeStore) Enabled() bool {
	return f.enabled
}

func (f *fakeStore) ReduceWithAI() bool {
	return f.reduceWithAI
}

func (f *fakeStore) ReduceThreshold() int {
	return f.reduceThresh
}

func (f *fakeStore) GenerateConversationID() string {
	return "generated-conv-id"
}

func (f *fakeStore) GetConversation(sessionID string, conversationID string) (*types.Conversation, bool) {
	f.getCalls++
	key := fmt.Sprintf("%s:%s", sessionID, conversationID)
	conv, ok := f.conversations[key]
	return conv, ok
}

func (f *fakeStore) SetConversation(sessionID string, conversationID string, conversation *types.Conversation) error {
	f.setCalls++
	key := fmt.Sprintf("%s:%s", sessionID, conversationID)
	if f.conversations == nil {
		f.conversations = map[string]*types.Conversation{}
	}
	f.conversations[key] = conversation
	return nil
}

func (f *fakeStore) GetConversationIDs(_ string) []string {
	return nil
}

func (f *fakeStore) DeleteConversations(_ string, _ []string) error {
	return nil
}

type fakeProvider struct {
	reduceCalled bool
}

func (f *fakeProvider) InitializeConversation(_ *types.Conversation, _ string) {}

func (f *fakeProvider) ReduceConversation(_ context.Context, ptr *types.Conversation, reduceThreshold int) {
	f.reduceCalled = true
	if ptr == nil {
		return
	}
	_, _, _, ok := SplitConversationForReduction(ptr.Conversation, reduceThreshold, 4)
	if !ok {
		return
	}
	ptr.Mu.Lock()
	ptr.Conversation = []types.ConversationMessage{{Content: "reduced", Role: "system"}}
	ptr.Mu.Unlock()
}

func (f *fakeProvider) GetToolDefinitions() interface{} {
	return nil
}

func (f *fakeProvider) TransformToolCallToToolsProcessor(_ any) ([]mcp.ToolsProcessor, []string, error) {
	return nil, nil, nil
}

func (f *fakeProvider) ConversationToProvider(_ []types.ConversationMessage) interface{} {
	return nil
}

func (f *fakeProvider) ProviderToConversation(_ interface{}) types.ConversationMessage {
	return types.ConversationMessage{}
}

func (f *fakeProvider) SendChat(_ *mcputil.KialiInterface, _ types.AIRequest, _ types.AIStore) (*types.AIResponse, int) {
	return nil, 0
}

func TestParseMarkdownResponse(t *testing.T) {
	input := "Here is code:\n```go\nfmt.Println(\"hi\")\n```"
	expected := "Here is code:\n~~~go\nfmt.Println(\"hi\")\n~~~"
	assert.Equal(t, expected, ParseMarkdownResponse(input))
}

func TestNewContextCanceledResponse(t *testing.T) {
	resp, code := NewContextCanceledResponse(context.Canceled)
	assert.Equal(t, http.StatusRequestTimeout, code)
	assert.Equal(t, context.Canceled.Error(), resp.Error)

	resp, code = NewContextCanceledResponse(context.DeadlineExceeded)
	assert.Equal(t, http.StatusRequestTimeout, code)
	assert.Equal(t, context.DeadlineExceeded.Error(), resp.Error)

	resp, code = NewContextCanceledResponse(fmt.Errorf("other error"))
	assert.Equal(t, http.StatusRequestTimeout, code)
	assert.Equal(t, "request cancelled", resp.Error)
}

func TestCleanConversation_RemovesExcludedTools(t *testing.T) {
	conversation := []types.ConversationMessage{
		{Role: "user", Content: "hello"},
		{Role: "tool", Name: "get_action_ui", Content: "actions"},
		{Role: "tool", Name: "custom_tool", Content: "custom"},
	}

	CleanConversation(&conversation)

	require.Len(t, conversation, 2)
	assert.Equal(t, "user", conversation[0].Role)
	assert.Equal(t, "custom_tool", conversation[1].Name)
}

func TestFormatToolContent(t *testing.T) {
	out, err := FormatToolContent("value")
	require.NoError(t, err)
	assert.Equal(t, "value", out)

	out, err = FormatToolContent([]byte("bytes"))
	require.NoError(t, err)
	assert.Equal(t, "bytes", out)

	out, err = FormatToolContent(map[string]any{"a": "b"})
	require.NoError(t, err)
	assert.Contains(t, out, `"a":"b"`)
}

func TestSplitConversationForReduction_PreservesTwoLeadingSystemMessages(t *testing.T) {
	conversation := []types.ConversationMessage{
		{Role: "system", Content: "base"},
		{Role: "system", Content: "summary"},
		{Role: "user", Content: "u1"},
		{Role: "assistant", Content: "a1"},
		{Role: "user", Content: "u2"},
		{Role: "assistant", Content: "a2"},
		{Role: "user", Content: "u3"},
		{Role: "assistant", Content: "a3"},
	}

	instructions, toSummarize, recentMessages, ok := SplitConversationForReduction(conversation, 6, 4)

	require.True(t, ok)
	require.Len(t, instructions, 2)
	assert.Equal(t, []string{"base", "summary"}, []string{instructions[0].Content, instructions[1].Content})
	assert.Len(t, toSummarize, 2)
	assert.Equal(t, []string{"u1", "a1"}, []string{toSummarize[0].Content, toSummarize[1].Content})
	assert.Len(t, recentMessages, 4)
	assert.Equal(t, []string{"u2", "a2", "u3", "a3"}, []string{
		recentMessages[0].Content,
		recentMessages[1].Content,
		recentMessages[2].Content,
		recentMessages[3].Content,
	})
}

func TestSplitConversationForReduction_SkipsShortConversation(t *testing.T) {
	conversation := []types.ConversationMessage{
		{Role: "system", Content: "base"},
		{Role: "user", Content: "u1"},
		{Role: "assistant", Content: "a1"},
	}

	_, _, _, ok := SplitConversationForReduction(conversation, 10, 4)

	assert.False(t, ok)
}

func TestGetStoreConversation(t *testing.T) {
	store := &fakeStore{enabled: true, conversations: map[string]*types.Conversation{}}
	sessionID := "session-1"
	conversationID := "conv-1"
	store.conversations[sessionID+":"+conversationID] = &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}

	req := httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	req = req.WithContext(authentication.SetSessionIDContext(req.Context(), sessionID))
	aiReq := types.AIRequest{ConversationID: conversationID}
	ptr, gotSessionID := GetStoreConversation(req, &aiReq, store, nil)

	require.NotNil(t, ptr)
	assert.Equal(t, sessionID, gotSessionID)
	require.Len(t, ptr.Conversation, 1)
	assert.Equal(t, "hi", ptr.Conversation[0].Content)
}

func TestStoreConversation_CleansAndStores(t *testing.T) {
	store := &fakeStore{enabled: true}
	conversation := []types.ConversationMessage{
		{Role: "user", Content: "hello"},
		{Role: "tool", Name: "get_referenced_docs", Content: "referenced_docs"},
		{Role: "tool", Name: "custom_tool", Content: "custom"},
	}
	ptr := &types.Conversation{Conversation: append([]types.ConversationMessage(nil), conversation...)}
	req := types.AIRequest{ConversationID: "conv-1"}

	StoreConversation(&fakeProvider{}, context.Background(), store, ptr, "session-1", req)

	require.Equal(t, 1, store.setCalls)
	stored := store.conversations["session-1:conv-1"]
	require.NotNil(t, stored)
	require.Len(t, stored.Conversation, 2)
	assert.Equal(t, "custom_tool", stored.Conversation[1].Name)
}

func TestStoreConversation_ReduceWithAI(t *testing.T) {
	store := &fakeStore{enabled: true, reduceWithAI: true, reduceThresh: 6}
	provider := &fakeProvider{}
	ptr := &types.Conversation{Conversation: []types.ConversationMessage{
		{Role: "system", Content: "base"},
		{Role: "system", Content: "ctx"},
		{Role: "user", Content: "u1"},
		{Role: "assistant", Content: "a1"},
		{Role: "user", Content: "u2"},
		{Role: "assistant", Content: "a2"},
		{Role: "user", Content: "u3"},
		{Role: "assistant", Content: "a3"},
	}}
	req := types.AIRequest{ConversationID: "conv-1"}

	StoreConversation(provider, context.Background(), store, ptr, "session-1", req)

	require.True(t, provider.reduceCalled)
	stored := store.conversations["session-1:conv-1"]
	require.NotNil(t, stored)
	require.Len(t, stored.Conversation, 1)
	assert.Equal(t, "reduced", stored.Conversation[0].Content)
}

func TestStoreConversation_ContextCanceled(t *testing.T) {
	store := &fakeStore{enabled: true}
	ptr := &types.Conversation{}
	req := types.AIRequest{ConversationID: "conv-1"}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	StoreConversation(&fakeProvider{}, ctx, store, ptr, "session-1", req)

	assert.Equal(t, 0, store.setCalls)
}

func TestResolveProviderKey_NilConfig(t *testing.T) {
	_, err := ResolveProviderKey(nil, &config.ProviderConfig{}, &config.AIModel{})
	require.Error(t, err)
}

func TestResolveProviderKey_ModelKeyTakesPrecedence(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-provider",
		Type:   config.OpenAIProvider,
		Config: config.DefaultProviderConfigType,
		Key:    "provider-key-value",
	}
	model := &config.AIModel{
		Name:  "test-model",
		Model: "gpt-4",
		Key:   "model-key-value",
	}

	key, err := ResolveProviderKey(conf, provider, model)
	require.NoError(t, err)

	// Verify model key was used, not provider key
	assert.Equal(t, "model-key-value", key,
		"Model key should take precedence over provider key")
}

func TestResolveProviderKey_FallbackToProviderKey(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-provider",
		Type:   config.OpenAIProvider,
		Config: config.DefaultProviderConfigType,
		Key:    "provider-key-value",
	}
	model := &config.AIModel{
		Name:  "test-model",
		Model: "gpt-4",
		Key:   "", // Empty - should fall back to provider key
	}

	key, err := ResolveProviderKey(conf, provider, model)
	require.NoError(t, err)

	// Verify provider key was used as fallback
	assert.Equal(t, "provider-key-value", key,
		"Should fall back to provider key when model key is empty")
}

func TestResolveProviderKey_BothKeysEmpty(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-provider",
		Type:   config.OpenAIProvider,
		Config: config.DefaultProviderConfigType,
		Key:    "",
	}
	model := &config.AIModel{
		Name:  "test-model",
		Model: "gpt-4",
		Key:   "",
	}

	_, err := ResolveProviderKey(conf, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "requires a key")
}
