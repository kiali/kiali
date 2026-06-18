package google_provider

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/genai"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
)

// --- test store ---

type googleTestStore struct {
	enabled       bool
	conversations map[string]*types.Conversation
}

func (s *googleTestStore) GenerateConversationID() string                 { return "test-conv-id" }
func (s *googleTestStore) DeleteConversations(_ string, _ []string) error { return nil }
func (s *googleTestStore) Enabled() bool                                  { return s.enabled }
func (s *googleTestStore) ReduceWithAI() bool                             { return false }
func (s *googleTestStore) ReduceThreshold() int                           { return 0 }

func (s *googleTestStore) GetConversation(sessionID, conversationID string) (*types.Conversation, bool) {
	if s.conversations == nil {
		return nil, false
	}
	c, ok := s.conversations[sessionID+":"+conversationID]
	return c, ok
}

func (s *googleTestStore) SetConversation(sessionID, conversationID string, c *types.Conversation) error {
	if s.conversations == nil {
		s.conversations = map[string]*types.Conversation{}
	}
	s.conversations[sessionID+":"+conversationID] = c
	return nil
}

func (s *googleTestStore) RecordUsage(_ string, _ string, _ string, _ types.TokenUsage) error {
	return nil
}
func (s *googleTestStore) GetUsageMetrics(_ string) []types.UsageMetric { return nil }

func newGoogleTestKialiInterface(sessionID string) *mcputil.KialiInterface {
	req := httptest.NewRequest(http.MethodPost, "/api/chat/google/gemini-pro/ai", nil)
	req = req.WithContext(authentication.SetSessionIDContext(req.Context(), sessionID))
	return &mcputil.KialiInterface{
		Request: req,
		Conf:    config.NewConfig(),
	}
}

// --- GetName ---

func TestGoogle_GetName(t *testing.T) {
	p := &GoogleAIProvider{}
	assert.Equal(t, "Google", p.GetName())
}

// --- InitializeConversation ---

func TestGoogle_InitializeConversation_NilPointer(t *testing.T) {
	p := &GoogleAIProvider{}
	// Must not panic
	p.InitializeConversation(nil, types.AIRequest{Query: "query"})
}

func TestGoogle_InitializeConversation_NewConversation(t *testing.T) {
	p := &GoogleAIProvider{}
	ptr := &types.Conversation{}
	p.InitializeConversation(ptr, types.AIRequest{Query: "hello"})

	require.Len(t, ptr.Conversation, 2)
	assert.Equal(t, "system", ptr.Conversation[0].Role)
	assert.Equal(t, types.SystemInstruction, ptr.Conversation[0].Content)
	assert.Equal(t, "user", ptr.Conversation[1].Role)
	assert.Equal(t, "hello", ptr.Conversation[1].Content)
}

func TestGoogle_InitializeConversation_NewConversation_TroubleshootMode(t *testing.T) {
	p := &GoogleAIProvider{}
	ptr := &types.Conversation{}
	p.InitializeConversation(ptr, types.AIRequest{Query: "diagnose my mesh", InteractionMode: types.ChatInteractionModeTroubleshoot})

	require.Len(t, ptr.Conversation, 2)
	assert.Equal(t, "system", ptr.Conversation[0].Role)
	assert.Equal(t, types.TroubleshootSystemInstruction, ptr.Conversation[0].Content)
	assert.Equal(t, "user", ptr.Conversation[1].Role)
	assert.Equal(t, "diagnose my mesh", ptr.Conversation[1].Content)
}

func TestGoogle_InitializeConversation_ExistingConversation(t *testing.T) {
	p := &GoogleAIProvider{}
	ptr := &types.Conversation{
		Conversation: []types.ConversationMessage{
			{Role: "system", Content: types.SystemInstruction},
			{Role: "user", Content: "previous question"},
		},
	}
	p.InitializeConversation(ptr, types.AIRequest{Query: "follow-up"})

	require.Len(t, ptr.Conversation, 3)
	assert.Equal(t, types.SystemInstruction, ptr.Conversation[0].Content)
	assert.Equal(t, "follow-up", ptr.Conversation[2].Content)
	assert.Equal(t, "user", ptr.Conversation[2].Role)
}

func TestGoogle_InitializeConversation_ModeSwitchUpdatesSystemMessage(t *testing.T) {
	p := &GoogleAIProvider{}
	ptr := &types.Conversation{
		Conversation: []types.ConversationMessage{
			{Role: "system", Content: types.SystemInstruction},
			{Role: "user", Content: "first question"},
			{Role: "assistant", Content: "first answer"},
		},
	}
	p.InitializeConversation(ptr, types.AIRequest{Query: "diagnose now", InteractionMode: types.ChatInteractionModeTroubleshoot})

	require.Len(t, ptr.Conversation, 4)
	assert.Equal(t, types.TroubleshootSystemInstruction, ptr.Conversation[0].Content, "system message must be updated to troubleshoot")
	assert.Equal(t, "first question", ptr.Conversation[1].Content, "history preserved")
	assert.Equal(t, "diagnose now", ptr.Conversation[3].Content)
}

// --- ConversationToProvider ---

func TestGoogle_ConversationToProvider_MapsAllRoles(t *testing.T) {
	p := &GoogleAIProvider{}
	conversation := []types.ConversationMessage{
		{Role: "system", Content: "system message"},
		{Role: "user", Content: "user message"},
		{Role: "tool", Content: "tool result"},
		{Role: "assistant", Content: "assistant response"},
	}
	result := p.ConversationToProvider(conversation)
	contents, ok := result.([]*genai.Content)
	require.True(t, ok)
	require.Len(t, contents, 4)

	// system → model
	assert.Equal(t, genai.RoleModel, contents[0].Role)
	assert.Equal(t, "system message", contents[0].Parts[0].Text)

	// user → user
	assert.Equal(t, genai.RoleUser, contents[1].Role)
	assert.Equal(t, "user message", contents[1].Parts[0].Text)

	// tool → model
	assert.Equal(t, genai.RoleModel, contents[2].Role)

	// assistant (default) → model
	assert.Equal(t, genai.RoleModel, contents[3].Role)
}

func TestGoogle_ConversationToProvider_EmptyConversation(t *testing.T) {
	p := &GoogleAIProvider{}
	result := p.ConversationToProvider([]types.ConversationMessage{})
	contents, ok := result.([]*genai.Content)
	require.True(t, ok)
	assert.Len(t, contents, 0)
}

// --- ProviderToConversation ---

func TestGoogle_ProviderToConversation_InvalidType(t *testing.T) {
	p := &GoogleAIProvider{}
	result := p.ProviderToConversation("not a genai response")
	assert.Equal(t, types.ConversationMessage{}, result)
}

// --- TransformToolCallToToolsProcessor ---

func TestGoogle_TransformToolCallToToolsProcessor_ValidInput(t *testing.T) {
	p := &GoogleAIProvider{}
	calls := []*genai.FunctionCall{
		{
			Name: "get_logs",
			ID:   "fc-1",
			Args: map[string]any{"namespace": "bookinfo"},
		},
		{
			Name: "list_services",
			ID:   "fc-2",
			Args: map[string]any{"cluster": "local"},
		},
	}
	tools, names, err := p.TransformToolCallToToolsProcessor(calls)

	require.NoError(t, err)
	require.Len(t, tools, 2)
	require.Len(t, names, 2)

	assert.Equal(t, "get_logs", tools[0].Name)
	assert.Equal(t, "fc-1", tools[0].ID)
	assert.Equal(t, "tool_call", tools[0].Type)
	assert.Equal(t, map[string]any{"namespace": "bookinfo"}, tools[0].Args)

	assert.Equal(t, "list_services", names[1])
}

func TestGoogle_TransformToolCallToToolsProcessor_InvalidType(t *testing.T) {
	p := &GoogleAIProvider{}
	// Non-[]*genai.FunctionCall type → returns empty slices, no error
	tools, names, err := p.TransformToolCallToToolsProcessor("not function calls")

	require.NoError(t, err)
	assert.Empty(t, tools)
	assert.Empty(t, names)
}

func TestGoogle_TransformToolCallToToolsProcessor_EmptySlice(t *testing.T) {
	p := &GoogleAIProvider{}
	calls := []*genai.FunctionCall{}
	tools, names, err := p.TransformToolCallToToolsProcessor(calls)

	require.NoError(t, err)
	assert.Empty(t, tools)
	assert.Empty(t, names)
}

// --- GetToolDefinitions ---

func TestGoogle_GetToolDefinitions_ReturnsToolList(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	p := &GoogleAIProvider{conf: config.NewConfig()}
	result := p.GetToolDefinitions()

	toolList, ok := result.([]*genai.Tool)
	require.True(t, ok)
	require.Len(t, toolList, 1)
	assert.NotEmpty(t, toolList[0].FunctionDeclarations)
}

func TestGoogle_GetToolDefinitions_FiltersTraceToolsWhenDisabled(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	confWithTracing := config.NewConfig()
	confWithTracing.ExternalServices.Tracing.Enabled = true
	confWithoutTracing := config.NewConfig()
	confWithoutTracing.ExternalServices.Tracing.Enabled = false

	pWithTracing := &GoogleAIProvider{conf: confWithTracing}
	pWithoutTracing := &GoogleAIProvider{conf: confWithoutTracing}

	withTracing := pWithTracing.GetToolDefinitions().([]*genai.Tool)[0].FunctionDeclarations
	withoutTracing := pWithoutTracing.GetToolDefinitions().([]*genai.Tool)[0].FunctionDeclarations

	// With tracing disabled, trace tools should be filtered out
	assert.Less(t, len(withoutTracing), len(withTracing))
}

// --- getProviderOptions ---

func TestGoogle_GetProviderOptions_GeminiConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-google",
		Type:   config.GoogleProvider,
		Config: config.ProviderConfigGemini,
		Key:    "test-api-key",
	}
	model := &config.AIModel{
		Name:  "gemini-pro",
		Model: "gemini-1.5-pro",
	}

	opts, err := getProviderOptions(conf, provider, model)
	require.NoError(t, err)
	assert.Equal(t, "test-api-key", opts.APIKey)
	assert.Equal(t, genai.BackendGeminiAPI, opts.Backend)
}

func TestGoogle_GetProviderOptions_DefaultConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-google",
		Type:   config.GoogleProvider,
		Config: config.DefaultProviderConfigType,
		Key:    "test-api-key",
	}
	model := &config.AIModel{
		Name:  "gemini-pro",
		Model: "gemini-1.5-pro",
	}

	opts, err := getProviderOptions(conf, provider, model)
	require.NoError(t, err)
	assert.Equal(t, "test-api-key", opts.APIKey)
	assert.Equal(t, genai.BackendGeminiAPI, opts.Backend)
}

func TestGoogle_GetProviderOptions_UnsupportedConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "test-google",
		Config: "unsupported-type",
		Key:    "test-api-key",
	}
	model := &config.AIModel{
		Name:  "some-model",
		Model: "some-model",
	}

	_, err := getProviderOptions(conf, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported provider config type")
}

// --- shared test-server helpers ---

// googleSSEResponse returns one Gemini SSE event (data: {...}\n\n) containing text.
func googleSSEResponse(text string) string {
	return fmt.Sprintf("data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":%q}],\"role\":\"model\"},\"finishReason\":\"STOP\",\"index\":0}],\"usageMetadata\":{\"candidatesTokenCount\":1,\"promptTokenCount\":5,\"totalTokenCount\":6}}\n\n", text)
}

// googleJSONResponse returns a non-streaming Gemini API response body.
func googleJSONResponse(text string) string {
	return fmt.Sprintf("{\"candidates\":[{\"content\":{\"parts\":[{\"text\":%q}],\"role\":\"model\"},\"finishReason\":\"STOP\",\"index\":0}],\"usageMetadata\":{\"candidatesTokenCount\":1,\"promptTokenCount\":5,\"totalTokenCount\":6}}", text)
}

// newGoogleFakeServer creates a test HTTP server that dispatches on path:
//   - paths containing "streamGenerateContent" → SSE (text/event-stream)
//   - everything else (generateContent) → JSON
func newGoogleFakeServer(t *testing.T, sseBody, jsonBody string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "streamGenerateContent") {
			w.Header().Set("Content-Type", "text/event-stream")
			fmt.Fprint(w, sseBody)
		} else {
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, jsonBody)
		}
	}))
}

// newGoogleTestClientForServer creates a genai.Client pointed at serverURL.
func newGoogleTestClientForServer(t *testing.T, serverURL string) *genai.Client {
	t.Helper()
	client, err := genai.NewClient(context.Background(), &genai.ClientConfig{
		APIKey:  "test-key",
		Backend: genai.BackendGeminiAPI,
		HTTPOptions: genai.HTTPOptions{
			BaseURL: serverURL,
		},
	})
	require.NoError(t, err)
	return client
}

// --- SendChat early return (empty query) ---

func TestGoogle_SendChat_EmptyQuery(t *testing.T) {
	// client is nil — lazy init only happens after query check,
	// so empty query returns before touching the client
	p := &GoogleAIProvider{}
	store := &googleTestStore{enabled: true}
	kialiInterface := newGoogleTestKialiInterface("session-1")

	var chunks []string
	p.SendChat(
		func(chunk string) { chunks = append(chunks, chunk) },
		kialiInterface.Request,
		types.AIRequest{ConversationID: "conv-1", Query: ""},
		kialiInterface, store,
	)

	require.Len(t, chunks, 1)
	assert.Contains(t, chunks[0], "error")
	assert.Contains(t, chunks[0], "query is required")
}

func TestGoogle_SendChat_LazyClientCreationError(t *testing.T) {
	// p.client is nil; config has no API key so genai.NewClient returns an error
	p := &GoogleAIProvider{
		config: genai.ClientConfig{
			Backend: genai.BackendGeminiAPI,
			// APIKey intentionally empty → NewClient fails
		},
		model: "gemini-1.5-pro",
	}
	store := &googleTestStore{enabled: true}
	ki := newGoogleTestKialiInterface("session-1")

	var chunks []string
	p.SendChat(
		func(chunk string) { chunks = append(chunks, chunk) },
		ki.Request,
		types.AIRequest{ConversationID: "conv-1", Query: "hello"},
		ki, store,
	)

	require.NotEmpty(t, chunks)
	allChunks := strings.Join(chunks, "")
	assert.Contains(t, allChunks, "error")
}

func TestGoogle_SendChat_TextResponse(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	server := newGoogleFakeServer(t,
		googleSSEResponse("Hello from Gemini"),
		"",
	)
	defer server.Close()

	p := &GoogleAIProvider{
		client: newGoogleTestClientForServer(t, server.URL),
		conf:   config.NewConfig(),
		model:  "gemini-1.5-pro",
	}
	store := &googleTestStore{enabled: true}
	ki := newGoogleTestKialiInterface("session-1")

	var chunks []string
	usage := p.SendChat(
		func(chunk string) { chunks = append(chunks, chunk) },
		ki.Request,
		types.AIRequest{ConversationID: "conv-1", Query: "hello"},
		ki, store,
	)

	allChunks := strings.Join(chunks, "")
	assert.Contains(t, allChunks, `"event":"start"`)
	assert.Contains(t, allChunks, "Hello from Gemini")
	assert.Contains(t, allChunks, `"event":"end"`)
	assert.Equal(t, types.NewTokenUsage(5, 1, 6), usage)
}

func TestGoogle_SendChat_StoresConversation(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	server := newGoogleFakeServer(t, googleSSEResponse("Response text"), "")
	defer server.Close()

	p := &GoogleAIProvider{
		client: newGoogleTestClientForServer(t, server.URL),
		conf:   config.NewConfig(),
		model:  "gemini-1.5-pro",
	}
	store := &googleTestStore{enabled: true}
	ki := newGoogleTestKialiInterface("session-1")

	p.SendChat(
		func(_ string) {},
		ki.Request,
		types.AIRequest{ConversationID: "conv-store", Query: "hello"},
		ki, store,
	)

	stored := store.conversations["session-1:conv-store"]
	require.NotNil(t, stored)
	// system + user + assistant
	require.GreaterOrEqual(t, len(stored.Conversation), 2)
	assert.Equal(t, "user", stored.Conversation[1].Role)
	assert.Equal(t, "hello", stored.Conversation[1].Content)
}

// --- ProviderToConversation positive case ---

func TestGoogle_ProviderToConversation_ValidResponse(t *testing.T) {
	p := &GoogleAIProvider{}

	// Build a minimal GenerateContentResponse via the server path
	server := newGoogleFakeServer(t, "", googleJSONResponse("summary text"))
	defer server.Close()

	client := newGoogleTestClientForServer(t, server.URL)
	chat, err := client.Chats.Create(context.Background(), "gemini-1.5-pro", nil, nil)
	require.NoError(t, err)

	resp, err := chat.SendMessage(context.Background(), genai.Part{Text: "summarize"})
	require.NoError(t, err)
	require.NotNil(t, resp)

	result := p.ProviderToConversation(resp)
	assert.Equal(t, "summary text", result.Content)
	assert.Equal(t, genai.RoleModel, result.Role)
}

// --- ReduceConversation ---

func TestGoogle_ReduceConversation_BelowThreshold(t *testing.T) {
	p := &GoogleAIProvider{}
	ptr := &types.Conversation{
		Conversation: []types.ConversationMessage{
			{Role: "system", Content: "system"},
			{Role: "user", Content: "q1"},
		},
	}
	originalLen := len(ptr.Conversation)
	p.ReduceConversation(context.Background(), ptr, 10)
	assert.Len(t, ptr.Conversation, originalLen)
}

func TestGoogle_ReduceConversation_SummarizesLongConversation(t *testing.T) {
	server := newGoogleFakeServer(t, "", googleJSONResponse("This is the summary."))
	defer server.Close()

	p := &GoogleAIProvider{
		client: newGoogleTestClientForServer(t, server.URL),
		model:  "gemini-1.5-pro",
	}
	messages := []types.ConversationMessage{{Role: "system", Content: types.SystemInstruction}}
	for i := 0; i < 5; i++ {
		messages = append(messages,
			types.ConversationMessage{Role: "user", Content: fmt.Sprintf("q%d", i)},
			types.ConversationMessage{Role: "assistant", Content: fmt.Sprintf("a%d", i)},
		)
	}
	ptr := &types.Conversation{Conversation: messages}

	p.ReduceConversation(context.Background(), ptr, 5)

	summaryFound := false
	for _, msg := range ptr.Conversation {
		if msg.Role == "system" && msg.Content != types.SystemInstruction && len(msg.Content) > 10 {
			assert.Contains(t, msg.Content, "Summary")
			summaryFound = true
		}
	}
	assert.True(t, summaryFound, "expected a summary system message to be injected")
}
