package anthropic_provider

import (
	"encoding/json"
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

func (s *anthropicTestStore) GetConversationIDs(_ string) []string {
	return nil
}

func (s *anthropicTestStore) DeleteConversations(_ string, _ []string) error {
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
		model:          "claude-sonnet-4-5",
		tracingEnabled: true,
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

func mustMarshalJSON(t *testing.T, value any) string {
	t.Helper()
	payload, err := json.Marshal(value)
	require.NoError(t, err)
	return string(payload)
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
	provider.SendChat(onChunk, kialiInterface.Request, types.AIRequest{
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
