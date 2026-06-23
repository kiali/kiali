package anthropic_provider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
)

type anthropicTestStore struct {
	enabled       bool
	conversations map[string]*types.Conversation
}

func (s *anthropicTestStore) GenerateConversationID() string {
	return "test-id"
}

func (s *anthropicTestStore) DeleteConversations(_ string, _ []string) error {
	return nil
}

func (s *anthropicTestStore) Enabled() bool {
	return s.enabled
}

func (s *anthropicTestStore) ReduceWithAI() bool {
	return false
}

func (s *anthropicTestStore) ReduceThreshold() int {
	return 0
}

func (s *anthropicTestStore) GetConversation(sessionID string, conversationID string) (*types.Conversation, bool) {
	if s.conversations == nil {
		return nil, false
	}
	conversation, found := s.conversations[sessionID+":"+conversationID]
	return conversation, found
}

func (s *anthropicTestStore) SetConversation(sessionID string, conversationID string, conversation *types.Conversation) error {
	if s.conversations == nil {
		s.conversations = map[string]*types.Conversation{}
	}
	s.conversations[sessionID+":"+conversationID] = conversation
	return nil
}

func (s *anthropicTestStore) RecordUsage(_ string, _ string, _ string, _ types.TokenUsage) error {
	return nil
}

func (s *anthropicTestStore) GetUsageMetrics(_ string) []types.UsageMetric {
	return nil
}

type anthropicRequestRecorder struct {
	mu     sync.Mutex
	bodies []string
	paths  []string
}

func (r *anthropicRequestRecorder) append(path string, body string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.paths = append(r.paths, path)
	r.bodies = append(r.bodies, body)
}

func (r *anthropicRequestRecorder) Bodies() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.bodies...)
}

func (r *anthropicRequestRecorder) Paths() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.paths...)
}

func newAnthropicSequenceServer(t *testing.T, responses []string) (*httptest.Server, *anthropicRequestRecorder) {
	t.Helper()
	recorder := &anthropicRequestRecorder{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request body: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		recorder.append(r.URL.Path, string(body))

		requestNumber := len(recorder.Bodies())
		if requestNumber > len(responses) {
			t.Errorf("received unexpected Anthropic request #%d", requestNumber)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		_, _ = w.Write([]byte(responses[requestNumber-1]))
	}))

	return server, recorder
}

func newAnthropicTestProvider(serverURL string) *AnthropicProvider {
	return &AnthropicProvider{
		client: anthropic.NewClient(
			option.WithoutEnvironmentDefaults(),
			option.WithBaseURL(serverURL),
			option.WithAPIKey("test-key"),
			option.WithMaxRetries(0),
		),
		conf:  config.NewConfig(),
		model: "claude-sonnet-4-5",
	}
}

func newAnthropicTestKialiInterface(sessionID string) *mcputil.KialiInterface {
	req := httptest.NewRequest(http.MethodPost, "/api/chat/anthropic/claude/ai", nil)
	req = req.WithContext(authentication.SetSessionIDContext(req.Context(), sessionID))
	return &mcputil.KialiInterface{
		Request: req,
		Conf:    config.NewConfig(),
	}
}

func anthropicTextResponse(t *testing.T, id string, stopReason anthropic.StopReason, text string) string {
	t.Helper()
	return `event: message_start
data: {"type": "message_start", "message": {"id": "` + id + `", "type": "message", "role": "assistant", "model": "claude-sonnet-4-5", "content": [], "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 1, "output_tokens": 1}}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "` + text + `"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "` + string(stopReason) + `", "stop_sequence": null}}

event: message_stop
data: {"type": "message_stop"}
`
}

func anthropicToolUseResponse(t *testing.T, id string, toolUseID string, toolName string, input map[string]any) string {
	t.Helper()
	inputJSON, err := json.Marshal(input)
	require.NoError(t, err)

	return `event: message_start
data: {"type": "message_start", "message": {"id": "` + id + `", "type": "message", "role": "assistant", "model": "claude-sonnet-4-5", "content": [], "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 1, "output_tokens": 1}}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "tool_use", "id": "` + toolUseID + `", "name": "` + toolName + `", "input": {}}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "input_json_delta", "partial_json": "` + strings.ReplaceAll(string(inputJSON), `"`, `\"`) + `"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "` + string(anthropic.StopReasonToolUse) + `", "stop_sequence": null}}

event: message_stop
data: {"type": "message_stop"}
`
}

func TestSendChat_ReturnsAssistantAnswerAndStoresConversation(t *testing.T) {
	server, recorder := newAnthropicSequenceServer(t, []string{
		anthropicTextResponse(t, "msg_1", anthropic.StopReasonEndTurn, "Hello from Claude"),
	})
	defer server.Close()

	provider := newAnthropicTestProvider(server.URL)
	store := &anthropicTestStore{enabled: true}
	kialiInterface := newAnthropicTestKialiInterface("session-1")

	var chunks []string
	onChunk := func(chunk string) {
		chunks = append(chunks, chunk)
	}
	usage := provider.SendChat(onChunk, kialiInterface.Request, types.AIRequest{
		ConversationID: "conv-1",
		Query:          "hello",
	}, kialiInterface, store)

	assert.Equal(t, []string{"/v1/messages"}, recorder.Paths())
	assert.Len(t, recorder.Bodies(), 1)

	stored := store.conversations["session-1:conv-1"]
	require.NotNil(t, stored)
	require.Len(t, stored.Conversation, 3)
	assert.Equal(t, "system", stored.Conversation[0].Role)
	assert.Equal(t, "hello", stored.Conversation[1].Content)
	assert.Equal(t, "assistant", stored.Conversation[2].Role)
	assert.Equal(t, "Hello from Claude", stored.Conversation[2].Content)
	assert.Equal(t, types.NewTokenUsage(1, 0, 1), usage)
}

func TestSendChat_ExecutesToolCallsAndReturnsReferencedDocs(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	server, recorder := newAnthropicSequenceServer(t, []string{
		anthropicToolUseResponse(t, "msg_tool", "toolu_1", "get_referenced_docs", map[string]any{
			"keywords": "istio",
		}),
		anthropicTextResponse(t, "msg_final", anthropic.StopReasonEndTurn, "I found the relevant documentation."),
	})
	defer server.Close()

	provider := newAnthropicTestProvider(server.URL)
	store := &anthropicTestStore{enabled: true}
	kialiInterface := newAnthropicTestKialiInterface("session-1")

	var chunks []string
	onChunk := func(chunk string) {
		chunks = append(chunks, chunk)
	}
	provider.SendChat(onChunk, kialiInterface.Request, types.AIRequest{
		ConversationID: "conv-tools",
		Query:          "show me docs for istio",
	}, kialiInterface, store)

	requestBodies := recorder.Bodies()
	require.Len(t, requestBodies, 1)
	assert.Equal(t, []string{"/v1/messages"}, recorder.Paths())

	stored := store.conversations["session-1:conv-tools"]
	require.NotNil(t, stored)
	require.Len(t, stored.Conversation, 2)
}

func TestSendChat_ContinuesPausedTurnUntilFinalAnswer(t *testing.T) {
	server, recorder := newAnthropicSequenceServer(t, []string{
		anthropicTextResponse(t, "msg_pause", anthropic.StopReasonPauseTurn, "Still thinking"),
		anthropicTextResponse(t, "msg_final", anthropic.StopReasonEndTurn, "All set now."),
	})
	defer server.Close()

	provider := newAnthropicTestProvider(server.URL)
	store := &anthropicTestStore{enabled: true}
	kialiInterface := newAnthropicTestKialiInterface("session-1")

	var chunks []string
	onChunk := func(chunk string) {
		chunks = append(chunks, chunk)
	}
	provider.SendChat(onChunk, kialiInterface.Request, types.AIRequest{
		ConversationID: "conv-pause",
		Query:          "continue",
	}, kialiInterface, store)

	requestBodies := recorder.Bodies()
	require.Len(t, requestBodies, 2)
	assert.Contains(t, requestBodies[1], "Still thinking")

	stored := store.conversations["session-1:conv-pause"]
	require.NotNil(t, stored)
	require.Len(t, stored.Conversation, 3)
	assert.Equal(t, "All set now.", stored.Conversation[2].Content)
}

// ========================================================================
// GetName, InitializeConversation, ConversationToProvider, ProviderToConversation
// ========================================================================

func TestAnthropic_GetName(t *testing.T) {
	p := &AnthropicProvider{model: "claude-sonnet-4-5"}
	assert.Equal(t, "Anthropic", p.GetName())
}

func TestAnthropic_InitializeConversation_NilPointer(t *testing.T) {
	p := &AnthropicProvider{}
	p.InitializeConversation(nil, types.AIRequest{Query: "hello"}) // must not panic
}

func TestAnthropic_InitializeConversation_NewConversation(t *testing.T) {
	p := &AnthropicProvider{}
	ptr := &types.Conversation{}
	p.InitializeConversation(ptr, types.AIRequest{Query: "hello world"})

	require.Len(t, ptr.Conversation, 2)
	assert.Equal(t, "system", ptr.Conversation[0].Role)
	assert.Equal(t, types.SystemInstruction, ptr.Conversation[0].Content)
	assert.Equal(t, "user", ptr.Conversation[1].Role)
	assert.Equal(t, "hello world", ptr.Conversation[1].Content)
}

func TestAnthropic_InitializeConversation_NewConversation_TroubleshootMode(t *testing.T) {
	p := &AnthropicProvider{}
	ptr := &types.Conversation{}
	p.InitializeConversation(ptr, types.AIRequest{Query: "why is my service down?", InteractionMode: types.ChatInteractionModeTroubleshoot})

	require.Len(t, ptr.Conversation, 2)
	assert.Equal(t, "system", ptr.Conversation[0].Role)
	assert.Equal(t, types.TroubleshootSystemInstruction, ptr.Conversation[0].Content)
	assert.Equal(t, "user", ptr.Conversation[1].Role)
	assert.Equal(t, "why is my service down?", ptr.Conversation[1].Content)
}

func TestAnthropic_InitializeConversation_ExistingConversation(t *testing.T) {
	p := &AnthropicProvider{}
	ptr := &types.Conversation{
		Conversation: []types.ConversationMessage{
			{Role: "system", Content: types.SystemInstruction},
			{Role: "user", Content: "previous"},
		},
	}
	p.InitializeConversation(ptr, types.AIRequest{Query: "follow-up"})

	require.Len(t, ptr.Conversation, 3)
	assert.Equal(t, types.SystemInstruction, ptr.Conversation[0].Content)
	assert.Equal(t, "follow-up", ptr.Conversation[2].Content)
}

func TestAnthropic_InitializeConversation_ModeSwitchUpdatesSystemMessage(t *testing.T) {
	p := &AnthropicProvider{}
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

func TestAnthropic_ConversationToProvider_MapsAllRoles(t *testing.T) {
	p := &AnthropicProvider{}
	conversation := []types.ConversationMessage{
		{Role: "system", Content: "system message"},
		{Role: "user", Content: "user message"},
		{Role: "tool", Content: "tool result"},
		{Role: "assistant", Content: "assistant response"},
		{Role: "unknown", Content: "unknown role"},
	}
	result := p.ConversationToProvider(conversation)
	conv, ok := result.(anthropicConversation)
	require.True(t, ok)

	// "system" → System slice
	assert.Len(t, conv.System, 1)
	assert.Equal(t, "system message", conv.System[0].Text)

	// user, tool (→ assistant), assistant (→ assistant), unknown (→ assistant)
	assert.Len(t, conv.Messages, 4)
}

func TestAnthropic_ConversationToProvider_EmptyConversation(t *testing.T) {
	p := &AnthropicProvider{}
	result := p.ConversationToProvider([]types.ConversationMessage{})
	conv, ok := result.(anthropicConversation)
	require.True(t, ok)
	assert.Empty(t, conv.System)
	assert.Empty(t, conv.Messages)
}

// contentBlockUnionFromJSON parses a ContentBlockUnion from a JSON string so that
// the SDK's internal JSON metadata is correctly populated (required for AsAny() to work).
func contentBlockUnionFromJSON(t *testing.T, raw string) anthropic.ContentBlockUnion {
	t.Helper()
	var block anthropic.ContentBlockUnion
	require.NoError(t, json.Unmarshal([]byte(raw), &block))
	return block
}

// messageFromJSON parses an anthropic.Message from a JSON string.
func messageFromJSON(t *testing.T, raw string) anthropic.Message {
	t.Helper()
	var msg anthropic.Message
	require.NoError(t, json.Unmarshal([]byte(raw), &msg))
	return msg
}

func TestAnthropic_ProviderToConversation_InvalidType(t *testing.T) {
	p := &AnthropicProvider{}
	result := p.ProviderToConversation("not an anthropic message")
	assert.Equal(t, types.ConversationMessage{}, result)
}

func TestAnthropic_ProviderToConversation_NilPointer(t *testing.T) {
	p := &AnthropicProvider{}
	result := p.ProviderToConversation((*anthropic.Message)(nil))
	assert.Equal(t, types.ConversationMessage{}, result)
}

func TestAnthropic_ProviderToConversation_AnthropicMessage(t *testing.T) {
	p := &AnthropicProvider{}
	msg := messageFromJSON(t, `{"id":"msg-test","type":"message","role":"assistant","content":[{"type":"text","text":"hello response"}],"model":"claude-sonnet-4-5","stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}`)
	result := p.ProviderToConversation(msg)
	assert.Equal(t, "hello response", result.Content)
	assert.Equal(t, "assistant", result.Role)
	assert.Equal(t, "msg-test", result.Name)
}

func TestAnthropic_ProviderToConversation_PointerToMessage(t *testing.T) {
	p := &AnthropicProvider{}
	msg := messageFromJSON(t, `{"id":"msg-ptr","type":"message","role":"assistant","content":[{"type":"text","text":"pointer response"}],"model":"claude-sonnet-4-5","stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1}}`)
	result := p.ProviderToConversation(&msg)
	assert.Equal(t, "pointer response", result.Content)
	assert.Equal(t, "msg-ptr", result.Name)
}

// ========================================================================
// TransformToolCallToToolsProcessor
// ========================================================================

func TestAnthropic_TransformToolCallToToolsProcessor_InvalidType(t *testing.T) {
	p := &AnthropicProvider{}
	tools, names, err := p.TransformToolCallToToolsProcessor("not content blocks")
	require.NoError(t, err)
	assert.Empty(t, tools)
	assert.Empty(t, names)
}

func TestAnthropic_TransformToolCallToToolsProcessor_ValidToolUse(t *testing.T) {
	p := &AnthropicProvider{}
	blocks := []anthropic.ContentBlockUnion{
		contentBlockUnionFromJSON(t, `{"type":"tool_use","id":"toolu-1","name":"get_logs","input":{"namespace":"bookinfo"}}`),
	}
	tools, names, err := p.TransformToolCallToToolsProcessor(blocks)
	require.NoError(t, err)
	require.Len(t, tools, 1)
	assert.Equal(t, "get_logs", names[0])
	assert.Equal(t, "toolu-1", tools[0].ID)
	assert.Equal(t, "tool_call", tools[0].Type)
	assert.Equal(t, map[string]any{"namespace": "bookinfo"}, tools[0].Args)
}

func TestAnthropic_TransformToolCallToToolsProcessor_SkipsNonToolUseBlocks(t *testing.T) {
	p := &AnthropicProvider{}
	blocks := []anthropic.ContentBlockUnion{
		contentBlockUnionFromJSON(t, `{"type":"text","text":"some text"}`),
		contentBlockUnionFromJSON(t, `{"type":"tool_use","id":"toolu-1","name":"get_logs","input":{"namespace":"bookinfo"}}`),
	}
	tools, names, err := p.TransformToolCallToToolsProcessor(blocks)
	require.NoError(t, err)
	require.Len(t, tools, 1)
	require.Len(t, names, 1)
	assert.Equal(t, "get_logs", tools[0].Name)
	assert.Equal(t, "toolu-1", tools[0].ID)
	assert.Equal(t, map[string]any{"namespace": "bookinfo"}, tools[0].Args)
}

// ========================================================================
// ReduceConversation
// ========================================================================

// newAnthropicJSONServer creates a test HTTP server that returns plain JSON responses
// (non-streaming), suitable for testing ReduceConversation which uses client.Messages.New.
func newAnthropicJSONServer(t *testing.T, responses []string) *httptest.Server {
	t.Helper()
	idx := 0
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if idx >= len(responses) {
			t.Errorf("unexpected request #%d", idx+1)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, responses[idx])
		idx++
	}))
}

func anthropicNonStreamingTextResponse(id, text string) string {
	return fmt.Sprintf(
		`{"id":%q,"type":"message","role":"assistant","content":[{"type":"text","text":%q}],"model":"claude-sonnet-4-5","stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":100,"output_tokens":50}}`,
		id, text,
	)
}

func TestAnthropic_ReduceConversation_BelowThreshold(t *testing.T) {
	p := newAnthropicTestProvider("http://localhost:1") // will not be called
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

func TestAnthropic_ReduceConversation_SummarizesLongConversation(t *testing.T) {
	server := newAnthropicJSONServer(t, []string{
		anthropicNonStreamingTextResponse("msg-summary", "This is the summary."),
	})
	defer server.Close()

	p := newAnthropicTestProvider(server.URL)
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

	summaryFound := false
	for _, msg := range ptr.Conversation {
		if msg.Role == "system" && msg.Content != types.SystemInstruction && len(msg.Content) > 10 {
			assert.Contains(t, msg.Content, "Summary")
			summaryFound = true
		}
	}
	assert.True(t, summaryFound, "expected a summary system message to be injected")
}

// ========================================================================
// Private helper function tests
// ========================================================================

func TestAnthropicHasToolUse_WithToolUse(t *testing.T) {
	content := []anthropic.ContentBlockUnion{
		contentBlockUnionFromJSON(t, `{"type":"text","text":"some text"}`),
		contentBlockUnionFromJSON(t, `{"type":"tool_use","id":"tu-1","name":"get_logs","input":{}}`),
	}
	assert.True(t, anthropicHasToolUse(content))
}

func TestAnthropicHasToolUse_WithoutToolUse(t *testing.T) {
	content := []anthropic.ContentBlockUnion{
		contentBlockUnionFromJSON(t, `{"type":"text","text":"just text"}`),
	}
	assert.False(t, anthropicHasToolUse(content))
}

func TestAnthropicHasToolUse_Empty(t *testing.T) {
	assert.False(t, anthropicHasToolUse([]anthropic.ContentBlockUnion{}))
}

func TestAnthropicTextContent_ExtractsText(t *testing.T) {
	content := []anthropic.ContentBlockUnion{
		contentBlockUnionFromJSON(t, `{"type":"text","text":"hello"}`),
		contentBlockUnionFromJSON(t, `{"type":"tool_use","id":"tu-1","name":"tool","input":{}}`),
		contentBlockUnionFromJSON(t, `{"type":"text","text":"world"}`),
	}
	result := anthropicTextContent(content)
	assert.Equal(t, "hello\nworld", result)
}

func TestAnthropicTextContent_EmptyContent(t *testing.T) {
	result := anthropicTextContent([]anthropic.ContentBlockUnion{})
	assert.Equal(t, "", result)
}

func TestAnthropicMessagePreview_AllVariants(t *testing.T) {
	msg := anthropic.MessageParam{
		Role: anthropic.MessageParamRoleUser,
		Content: []anthropic.ContentBlockParamUnion{
			{OfText: &anthropic.TextBlockParam{Text: "hello"}},
			{OfToolResult: &anthropic.ToolResultBlockParam{ToolUseID: "tu-1"}},
			{OfToolUse: &anthropic.ToolUseBlockParam{ID: "tu-2", Name: "get_logs"}},
		},
	}
	result := anthropicMessagePreview(msg)
	assert.Contains(t, result, "hello")
	assert.Contains(t, result, "[tool_result]")
	assert.Contains(t, result, "[tool_use]")
}

func TestAnthropicMessagePreview_UnknownBlock(t *testing.T) {
	msg := anthropic.MessageParam{
		Role:    anthropic.MessageParamRoleUser,
		Content: []anthropic.ContentBlockParamUnion{{}},
	}
	result := anthropicMessagePreview(msg)
	assert.Contains(t, result, "[non-text block]")
}

// ========================================================================
// SendChat additional paths
// ========================================================================

func TestAnthropic_SendChat_EmptyQuery(t *testing.T) {
	p := newAnthropicTestProvider("http://localhost:1") // will not be contacted
	store := &anthropicTestStore{enabled: true}
	kialiInterface := newAnthropicTestKialiInterface("session-1")

	var chunks []string
	p.SendChat(
		func(chunk string) { chunks = append(chunks, chunk) },
		&http.Request{},
		types.AIRequest{ConversationID: "conv-1", Query: ""},
		kialiInterface, store,
	)

	require.Len(t, chunks, 1)
	assert.Contains(t, chunks[0], "error")
	assert.Contains(t, chunks[0], "query is required")
}
