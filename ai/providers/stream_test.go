package providers

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/types"
)

func TestSendStreamEvent_ValidData(t *testing.T) {
	var received []string
	onChunk := func(chunk string) { received = append(received, chunk) }

	data := types.StreamTokenData{ID: 1, Token: "hello"}
	SendStreamEvent(onChunk, LLM_TOKEN_EVENT, data)

	require.Len(t, received, 1)

	var event types.StreamEvent
	require.NoError(t, json.Unmarshal([]byte(received[0]), &event))
	assert.Equal(t, LLM_TOKEN_EVENT, event.Event)

	var tokenData types.StreamTokenData
	require.NoError(t, json.Unmarshal(event.Data, &tokenData))
	assert.Equal(t, 1, tokenData.ID)
	assert.Equal(t, "hello", tokenData.Token)
}

func TestSendStreamEvent_StartEvent(t *testing.T) {
	var received []string
	onChunk := func(chunk string) { received = append(received, chunk) }

	data := types.StreamStartData{ConversationID: "conv-123"}
	SendStreamEvent(onChunk, LLM_START_EVENT, data)

	require.Len(t, received, 1)

	var event types.StreamEvent
	require.NoError(t, json.Unmarshal([]byte(received[0]), &event))
	assert.Equal(t, LLM_START_EVENT, event.Event)

	var startData types.StreamStartData
	require.NoError(t, json.Unmarshal(event.Data, &startData))
	assert.Equal(t, "conv-123", startData.ConversationID)
}

func TestSendStreamEvent_EndEvent(t *testing.T) {
	var received []string
	onChunk := func(chunk string) { received = append(received, chunk) }

	endData := types.StreamEndData{Truncated: true}
	SendStreamEvent(onChunk, LLM_END_EVENT, endData)

	require.Len(t, received, 1)

	var event types.StreamEvent
	require.NoError(t, json.Unmarshal([]byte(received[0]), &event))
	assert.Equal(t, LLM_END_EVENT, event.Event)
}

func TestStreamError_SendsErrorEvent(t *testing.T) {
	var received []string
	onChunk := func(chunk string) { received = append(received, chunk) }

	StreamError(onChunk, "something went wrong")

	require.Len(t, received, 1)
	assert.Contains(t, received[0], LLM_ERROR_EVENT)
	assert.Contains(t, received[0], "something went wrong")
}

func TestStreamError_EmptyMessage(t *testing.T) {
	var received []string
	onChunk := func(chunk string) { received = append(received, chunk) }

	StreamError(onChunk, "")

	require.Len(t, received, 1)
	assert.Contains(t, received[0], LLM_ERROR_EVENT)
}

func TestSendStreamEvent_UnmarshalableData_IsDropped(t *testing.T) {
	var received []string
	onChunk := func(chunk string) { received = append(received, chunk) }

	// channels cannot be marshalled to JSON — this covers the json.Marshal error branch
	ch := make(chan int)
	SendStreamEvent(onChunk, LLM_ERROR_EVENT, ch)

	// The error is logged and the chunk is dropped; onChunk must NOT be called
	assert.Empty(t, received, "unmarshalable data should not produce a chunk")
}

func TestSendStreamEvent_EventConstants(t *testing.T) {
	// Verify all event constants are non-empty strings and distinct
	constants := []string{
		LLM_START_EVENT,
		LLM_TOKEN_EVENT,
		LLM_END_EVENT,
		LLM_ERROR_EVENT,
		LLM_REASONING_EVENT,
		LLM_TOOL_CALL_EVENT,
		LLM_TOOL_RESULT_EVENT,
		LLM_HISTORY_COMPRESSION_START_EVENT,
		LLM_HISTORY_COMPRESSION_END_EVENT,
	}
	seen := map[string]bool{}
	for _, c := range constants {
		assert.True(t, strings.TrimSpace(c) != "", "event constant must not be empty")
		assert.False(t, seen[c], "duplicate event constant: %q", c)
		seen[c] = true
	}
}
