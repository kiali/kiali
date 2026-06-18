package openai_provider

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
)

// --- test store ---

type openaiTestStore struct {
	enabled       bool
	conversations map[string]*types.Conversation
}

func (s *openaiTestStore) GenerateConversationID() string                 { return "test-conv-id" }
func (s *openaiTestStore) DeleteConversations(_ string, _ []string) error { return nil }
func (s *openaiTestStore) Enabled() bool                                  { return s.enabled }
func (s *openaiTestStore) ReduceWithAI() bool                             { return false }
func (s *openaiTestStore) ReduceThreshold() int                           { return 0 }

func (s *openaiTestStore) GetConversation(sessionID, conversationID string) (*types.Conversation, bool) {
	if s.conversations == nil {
		return nil, false
	}
	c, ok := s.conversations[sessionID+":"+conversationID]
	return c, ok
}

func (s *openaiTestStore) SetConversation(sessionID, conversationID string, c *types.Conversation) error {
	if s.conversations == nil {
		s.conversations = map[string]*types.Conversation{}
	}
	s.conversations[sessionID+":"+conversationID] = c
	return nil
}

func (s *openaiTestStore) RecordUsage(_ string, _ string, _ string, _ types.TokenUsage) error {
	return nil
}
func (s *openaiTestStore) GetUsageMetrics(_ string) []types.UsageMetric { return nil }

// --- fake OpenAI HTTP server ---

type openaiRequestRecorder struct {
	mu    sync.Mutex
	count int
}

func (r *openaiRequestRecorder) inc() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.count++
	return r.count
}

func newOpenAISequenceServer(t *testing.T, responses []string) (*httptest.Server, *openaiRequestRecorder) {
	t.Helper()
	rec := &openaiRequestRecorder{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		n := rec.inc()
		if n > len(responses) {
			t.Errorf("unexpected OpenAI request #%d", n)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		fmt.Fprint(w, responses[n-1])
	}))
	return server, rec
}

func newOpenAITestProvider(serverURL string) *OpenAIProvider {
	return &OpenAIProvider{
		client: openai.NewClient(
			option.WithAPIKey("test-key"),
			option.WithBaseURL(serverURL),
			option.WithMaxRetries(0),
		),
		conf:  config.NewConfig(),
		model: "gpt-4o",
	}
}

func newOpenAITestKialiInterface(sessionID string) *mcputil.KialiInterface {
	req := httptest.NewRequest(http.MethodPost, "/api/chat/openai/gpt-4o/ai", nil)
	req = req.WithContext(authentication.SetSessionIDContext(req.Context(), sessionID))
	return &mcputil.KialiInterface{
		Request: req,
		Conf:    config.NewConfig(),
	}
}

// openaiTextSSE returns a minimal SSE stream with a single text response.
func openaiTextSSE(id, content string) string {
	chunk1 := fmt.Sprintf(
		`{"id":%q,"object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":%q},"finish_reason":null}]}`,
		id, content,
	)
	chunk2 := fmt.Sprintf(
		`{"id":%q,"object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`,
		id,
	)
	return "data: " + chunk1 + "\n\n" +
		"data: " + chunk2 + "\n\n" +
		"data: [DONE]\n\n"
}

// --- unit tests for simple methods ---

func TestOpenAI_GetName(t *testing.T) {
	p := &OpenAIProvider{}
	assert.Equal(t, "OpenAI", p.GetName())
}

func TestOpenAI_InitializeConversation_NilPointer(t *testing.T) {
	p := &OpenAIProvider{}
	// Must not panic
	p.InitializeConversation(nil, types.AIRequest{Query: "hello"})
}

func TestOpenAI_InitializeConversation_NewConversation(t *testing.T) {
	p := &OpenAIProvider{}
	ptr := &types.Conversation{}
	p.InitializeConversation(ptr, types.AIRequest{Query: "hello world"})

	require.Len(t, ptr.Conversation, 2)
	assert.Equal(t, "system", ptr.Conversation[0].Role)
	assert.Equal(t, types.SystemInstruction, ptr.Conversation[0].Content)
	assert.Equal(t, "user", ptr.Conversation[1].Role)
	assert.Equal(t, "hello world", ptr.Conversation[1].Content)
}

func TestOpenAI_InitializeConversation_NewConversation_TroubleshootMode(t *testing.T) {
	p := &OpenAIProvider{}
	ptr := &types.Conversation{}
	p.InitializeConversation(ptr, types.AIRequest{Query: "why is my service down?", InteractionMode: types.ChatInteractionModeTroubleshoot})

	require.Len(t, ptr.Conversation, 2)
	assert.Equal(t, "system", ptr.Conversation[0].Role)
	assert.Equal(t, types.TroubleshootSystemInstruction, ptr.Conversation[0].Content)
	assert.Equal(t, "user", ptr.Conversation[1].Role)
	assert.Equal(t, "why is my service down?", ptr.Conversation[1].Content)
}

func TestOpenAI_InitializeConversation_ExistingConversation(t *testing.T) {
	p := &OpenAIProvider{}
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

func TestOpenAI_InitializeConversation_ModeSwitchUpdatesSystemMessage(t *testing.T) {
	p := &OpenAIProvider{}
	ptr := &types.Conversation{
		Conversation: []types.ConversationMessage{
			{Role: "system", Content: types.SystemInstruction},
			{Role: "user", Content: "first question"},
			{Role: "assistant", Content: "first answer"},
		},
	}
	// Switching to troubleshoot mid-conversation must update the system message in place.
	p.InitializeConversation(ptr, types.AIRequest{Query: "diagnose now", InteractionMode: types.ChatInteractionModeTroubleshoot})

	require.Len(t, ptr.Conversation, 4)
	assert.Equal(t, types.TroubleshootSystemInstruction, ptr.Conversation[0].Content, "system message must be updated to troubleshoot")
	assert.Equal(t, "first question", ptr.Conversation[1].Content, "history preserved")
	assert.Equal(t, "diagnose now", ptr.Conversation[3].Content)
}

func TestOpenAI_ConversationToProvider_MapsAllRoles(t *testing.T) {
	p := &OpenAIProvider{}
	conversation := []types.ConversationMessage{
		{Role: "system", Content: "system message"},
		{Role: "user", Content: "user message"},
		{Role: "tool", Content: "tool result"},
		{Role: "assistant", Content: "assistant response"},
		{Role: "unknown", Content: "unknown role"},
	}
	result := p.ConversationToProvider(conversation)
	params, ok := result.([]openai.ChatCompletionMessageParamUnion)
	require.True(t, ok)
	assert.Len(t, params, 5)
}

func TestOpenAI_ProviderToConversation_InvalidType(t *testing.T) {
	p := &OpenAIProvider{}
	result := p.ProviderToConversation("not an openai.ChatCompletion")
	assert.Equal(t, types.ConversationMessage{}, result)
}

func TestOpenAI_ProviderToConversation_ValidChatCompletion(t *testing.T) {
	p := &OpenAIProvider{}
	completion := openai.ChatCompletion{
		ID:    "chatcmpl-test",
		Model: "gpt-4o",
		Choices: []openai.ChatCompletionChoice{
			{
				Message: openai.ChatCompletionMessage{
					Content: "test response",
					Role:    "assistant",
				},
			},
		},
	}
	result := p.ProviderToConversation(completion)
	assert.Equal(t, "test response", result.Content)
	assert.Equal(t, "assistant", result.Role)
	assert.Equal(t, "chatcmpl-test", result.Name)
	assert.NotNil(t, result.Param)
}

// --- SendChat integration tests ---

func TestOpenAI_SendChat_EmptyQuery(t *testing.T) {
	p := newOpenAITestProvider("http://localhost:1") // will not be contacted
	store := &openaiTestStore{enabled: true}
	kialiInterface := newOpenAITestKialiInterface("session-1")

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

func TestOpenAI_SendChat_ReturnsAssistantAnswerAndStoresConversation(t *testing.T) {
	server, rec := newOpenAISequenceServer(t, []string{
		openaiTextSSE("chatcmpl-1", "Hello from OpenAI"),
	})
	defer server.Close()

	provider := newOpenAITestProvider(server.URL)
	store := &openaiTestStore{enabled: true}
	kialiInterface := newOpenAITestKialiInterface("session-1")

	var chunks []string
	usage := provider.SendChat(
		func(chunk string) { chunks = append(chunks, chunk) },
		kialiInterface.Request,
		types.AIRequest{ConversationID: "conv-1", Query: "hello"},
		kialiInterface, store,
	)

	assert.Equal(t, 1, rec.count)

	stored := store.conversations["session-1:conv-1"]
	require.NotNil(t, stored)
	require.Len(t, stored.Conversation, 3)
	assert.Equal(t, "system", stored.Conversation[0].Role)
	assert.Equal(t, "hello", stored.Conversation[1].Content)
	assert.Equal(t, "user", stored.Conversation[1].Role)
	assert.Equal(t, "assistant", stored.Conversation[2].Role)
	assert.Equal(t, "Hello from OpenAI", stored.Conversation[2].Content)
	assert.Equal(t, types.NewTokenUsage(10, 5, 15), usage)
}

func TestOpenAI_SendChat_MultiTurnPreservesHistory(t *testing.T) {
	server, rec := newOpenAISequenceServer(t, []string{
		openaiTextSSE("chatcmpl-2", "Second answer"),
	})
	defer server.Close()

	provider := newOpenAITestProvider(server.URL)
	store := &openaiTestStore{
		enabled: true,
		conversations: map[string]*types.Conversation{
			"session-1:conv-multi": {
				Conversation: []types.ConversationMessage{
					{Role: "system", Content: types.SystemInstruction},
					{Role: "user", Content: "first question"},
					{Role: "assistant", Content: "first answer"},
				},
			},
		},
	}
	kialiInterface := newOpenAITestKialiInterface("session-1")

	var chunks []string
	provider.SendChat(
		func(chunk string) { chunks = append(chunks, chunk) },
		kialiInterface.Request,
		types.AIRequest{ConversationID: "conv-multi", Query: "second question"},
		kialiInterface, store,
	)

	assert.Equal(t, 1, rec.count)
	stored := store.conversations["session-1:conv-multi"]
	require.NotNil(t, stored)
	// system + first user + first assistant + second user + second assistant
	require.Len(t, stored.Conversation, 5)
	assert.Equal(t, "Second answer", stored.Conversation[4].Content)
}

// openaiNonStreamingResponse builds a plain JSON completion response (for ReduceConversation).
func openaiNonStreamingResponse(id, content string) string {
	return fmt.Sprintf(
		`{"id":%q,"object":"chat.completion","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":%q},"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150}}`,
		id, content,
	)
}

// openaiNonStreamingJSONServer returns a test server serving plain JSON (not SSE).
func openaiNonStreamingJSONServer(t *testing.T, response string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, response)
	}))
}

func TestOpenAI_ReduceConversation_BelowThreshold(t *testing.T) {
	p := newOpenAITestProvider("http://localhost:1") // will not be called
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

func TestOpenAI_ReduceConversation_SummarizesLongConversation(t *testing.T) {
	server := openaiNonStreamingJSONServer(t,
		openaiNonStreamingResponse("chatcmpl-summary", "This is the summary."),
	)
	defer server.Close()

	p := newOpenAITestProvider(server.URL)
	messages := []types.ConversationMessage{
		{Role: "system", Content: types.SystemInstruction},
	}
	for i := 0; i < 5; i++ {
		messages = append(messages,
			types.ConversationMessage{Role: "user", Content: fmt.Sprintf("question %d", i)},
			types.ConversationMessage{Role: "assistant", Content: fmt.Sprintf("answer %d", i)},
		)
	}
	ptr := &types.Conversation{Conversation: messages}
	p.ReduceConversation(context.Background(), ptr, 5)

	// Summary should be injected
	summaryFound := false
	for _, msg := range ptr.Conversation {
		if msg.Role == "system" && msg.Content != types.SystemInstruction && len(msg.Content) > 10 {
			assert.Contains(t, msg.Content, "Summary")
			summaryFound = true
		}
	}
	assert.True(t, summaryFound, "expected summary message injected")
}

func TestOpenAI_ReduceConversation_EmptyChoices(t *testing.T) {
	// Server returns no choices — ReduceConversation should return without modification
	server := openaiNonStreamingJSONServer(t,
		`{"id":"chatcmpl-1","object":"chat.completion","created":1700000000,"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":0,"total_tokens":10}}`,
	)
	defer server.Close()

	p := newOpenAITestProvider(server.URL)
	messages := []types.ConversationMessage{
		{Role: "system", Content: types.SystemInstruction},
	}
	for i := 0; i < 5; i++ {
		messages = append(messages,
			types.ConversationMessage{Role: "user", Content: fmt.Sprintf("q%d", i)},
			types.ConversationMessage{Role: "assistant", Content: fmt.Sprintf("a%d", i)},
		)
	}
	originalLen := len(messages)
	ptr := &types.Conversation{Conversation: messages}
	p.ReduceConversation(context.Background(), ptr, 5)

	// With empty choices, nothing should change
	assert.Len(t, ptr.Conversation, originalLen)
}

func TestOpenAI_SendChat_StreamError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, `{"error":{"message":"internal server error","type":"server_error"}}`)
	}))
	defer server.Close()

	provider := newOpenAITestProvider(server.URL)
	store := &openaiTestStore{enabled: true}
	kialiInterface := newOpenAITestKialiInterface("session-1")

	var chunks []string
	provider.SendChat(
		func(chunk string) { chunks = append(chunks, chunk) },
		kialiInterface.Request,
		types.AIRequest{ConversationID: "conv-err", Query: "hello"},
		kialiInterface, store,
	)

	// Should surface an error chunk
	allChunks := fmt.Sprintf("%v", chunks)
	assert.Contains(t, allChunks, "error")
}
