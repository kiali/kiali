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
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
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

func (f *fakeProvider) InitializeConversation(_ *[]types.ConversationMessage, _ types.AIRequest) {}

func (f *fakeProvider) ReduceConversation(_ context.Context, _ []types.ConversationMessage, _ int) []types.ConversationMessage {
	f.reduceCalled = true
	return []types.ConversationMessage{{Content: "reduced", Role: "system"}}
}

func (f *fakeProvider) GetToolDefinitions() interface{} {
	return nil
}

func (f *fakeProvider) TransformToolCallToToolsProcessor(_ any) ([]mcp.ToolsProcessor, []string) {
	return nil, nil
}

func (f *fakeProvider) ConversationToProvider(_ []types.ConversationMessage) interface{} {
	return nil
}

func (f *fakeProvider) ProviderToConversation(_ interface{}) types.ConversationMessage {
	return types.ConversationMessage{}
}

func (f *fakeProvider) SendChat(_ *http.Request, _ types.AIRequest, _ *business.Layer, _ prometheus.ClientInterface, _ kubernetes.ClientFactory, _ cache.KialiCache, _ types.AIStore, _ *config.Config, _ *grafana.Service, _ *perses.Service, _ *istio.Discovery) (*types.AIResponse, int) {
	return nil, 0
}

func TestShouldGenerateAnswer(t *testing.T) {
	response := &types.AIResponse{}

	shouldGenerate, message := ShouldGenerateAnswer(response, []string{"custom_tool"})
	assert.True(t, shouldGenerate)
	assert.Equal(t, "", message)

	response.Actions = []get_action_ui.Action{{Title: "action", Kind: get_action_ui.ActionKindNavigation, Payload: "/"}}
	shouldGenerate, message = ShouldGenerateAnswer(response, []string{"get_action_ui"})
	assert.False(t, shouldGenerate)
	assert.Equal(t, "I have found the following actions: ", message)

	response.Actions = nil
	response.ReferencedDocuments = []types.ReferencedDocument{{DocTitle: "title", DocURL: "url"}}
	shouldGenerate, message = ShouldGenerateAnswer(response, []string{"get_citations"})
	assert.False(t, shouldGenerate)
	assert.Equal(t, "I have found the following referenced documents: ", message)

	response.ReferencedDocuments = nil
	shouldGenerate, message = ShouldGenerateAnswer(response, []string{"get_action_ui"})
	assert.True(t, shouldGenerate)
	assert.Equal(t, "", message)
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

func TestGetStoreConversation(t *testing.T) {
	store := &fakeStore{enabled: true, conversations: map[string]*types.Conversation{}}
	sessionID := "session-1"
	conversationID := "conv-1"
	store.conversations[sessionID+":"+conversationID] = &types.Conversation{
		Conversation: []types.ConversationMessage{{Role: "user", Content: "hi"}},
	}

	req := httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	req = req.WithContext(authentication.SetSessionIDContext(req.Context(), sessionID))
	ptr, gotSessionID, conversation := GetStoreConversation(req, types.AIRequest{ConversationID: conversationID}, store)

	require.NotNil(t, ptr)
	assert.Equal(t, sessionID, gotSessionID)
	require.Len(t, conversation, 1)
	assert.Equal(t, "hi", conversation[0].Content)
}

func TestStoreConversation_CleansAndStores(t *testing.T) {
	store := &fakeStore{enabled: true}
	conversation := []types.ConversationMessage{
		{Role: "user", Content: "hello"},
		{Role: "tool", Name: "get_citations", Content: "citations"},
		{Role: "tool", Name: "custom_tool", Content: "custom"},
	}
	ptr := &types.Conversation{}
	req := types.AIRequest{ConversationID: "conv-1"}

	StoreConversation(&fakeProvider{}, context.Background(), store, ptr, "session-1", req, conversation)

	require.Equal(t, 1, store.setCalls)
	stored := store.conversations["session-1:conv-1"]
	require.NotNil(t, stored)
	require.Len(t, stored.Conversation, 2)
	assert.Equal(t, "custom_tool", stored.Conversation[1].Name)
}

func TestStoreConversation_ReduceWithAI(t *testing.T) {
	store := &fakeStore{enabled: true, reduceWithAI: true, reduceThresh: 1}
	provider := &fakeProvider{}
	ptr := &types.Conversation{}
	req := types.AIRequest{ConversationID: "conv-1"}

	StoreConversation(provider, context.Background(), store, ptr, "session-1", req, []types.ConversationMessage{{Role: "user", Content: "hi"}})

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

	StoreConversation(&fakeProvider{}, ctx, store, ptr, "session-1", req, []types.ConversationMessage{{Role: "user", Content: "hi"}})

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
