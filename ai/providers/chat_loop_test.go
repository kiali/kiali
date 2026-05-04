package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/types"
)

// --- RunChatLoop tests ---

// collectChunks returns an onChunk callback that appends every received SSE
// string into the slice pointed to by out.
func collectChunks(out *[]string) func(string) {
	return func(s string) { *out = append(*out, s) }
}

// hasErrorEvent returns true when at least one collected chunk is a
// well-formed LLM_ERROR_EVENT JSON payload.
func hasErrorEvent(chunks []string) bool {
	for _, c := range chunks {
		if strings.Contains(c, LLM_ERROR_EVENT) {
			return true
		}
	}
	return false
}

// nopPrepare is a PrepareNextTurnFunc that must never be called.  It fails
// the test immediately if it is invoked.
func nopPrepare(t *testing.T) PrepareNextTurnFunc {
	t.Helper()
	return func(_ context.Context, _ []types.StreamToolCallData, _ []types.StreamToolResultData, _ bool, _ func(string)) (bool, string) {
		t.Fatal("prepareNextTurn must not be called in this scenario")
		return false, ""
	}
}

// alwaysStopPrepare is a PrepareNextTurnFunc that unconditionally stops the
// loop (shouldContinue=false) and returns optional extra text.
func alwaysStopPrepare(extraText string) PrepareNextTurnFunc {
	return func(_ context.Context, _ []types.StreamToolCallData, _ []types.StreamToolResultData, _ bool, _ func(string)) (bool, string) {
		return false, extraText
	}
}

// alwaysContinuePrepare is a PrepareNextTurnFunc that unconditionally
// continues the loop.
func alwaysContinuePrepare() PrepareNextTurnFunc {
	return func(_ context.Context, _ []types.StreamToolCallData, _ []types.StreamToolResultData, _ bool, _ func(string)) (bool, string) {
		return true, ""
	}
}

// get_referenced_docs call - always succeeds without a business layer, is
// excluded (no SSE events emitted), and produces referenced docs.
func referencedDocsCall(id string) types.StreamToolCallData {
	return types.StreamToolCallData{
		Name: "get_referenced_docs",
		Args: map[string]any{"keywords": "istio"},
		ID:   id,
	}
}

// TestRunChatLoop_NoToolCalls verifies that when streamTurn returns text with
// no tool calls the loop exits immediately after one iteration.
func TestRunChatLoop_NoToolCalls(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamCalls := 0
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		streamCalls++
		return "hello world", nil, nil
	}

	var chunks []string
	content, actions, docs, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(&chunks), streamTurn, nopPrepare(t),
	)

	assert.False(t, aborted)
	assert.Equal(t, "hello world", content)
	assert.Empty(t, actions)
	assert.Empty(t, docs)
	assert.Equal(t, 1, streamCalls, "streamTurn should be called exactly once")
	assert.Empty(t, chunks, "no SSE events should be emitted by the loop itself")
}

// TestRunChatLoop_ParseMarkdownApplied verifies that ParseMarkdownResponse is
// applied to the final text (backtick code fences are normalised).
func TestRunChatLoop_ParseMarkdownApplied(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		return "see ```code```", nil, nil
	}

	content, _, _, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(new([]string)), streamTurn, nopPrepare(t),
	)

	assert.False(t, aborted)
	assert.NotContains(t, content, "```", "backtick fences must be converted by ParseMarkdownResponse")
}

// TestRunChatLoop_StreamTurnError verifies that a hard error from streamTurn
// causes an immediate abort with an error SSE event.
func TestRunChatLoop_StreamTurnError(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		return "", nil, fmt.Errorf("upstream model error")
	}

	var chunks []string
	content, _, _, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(&chunks), streamTurn, nopPrepare(t),
	)

	assert.True(t, aborted)
	assert.Empty(t, content)
	require.True(t, hasErrorEvent(chunks), "an error SSE event must be emitted")
	assert.Contains(t, chunks[0], "upstream model error")
}

// TestRunChatLoop_ContextCanceled verifies that a canceled context detected
// after streamTurn completes causes an abort with an error SSE event.
func TestRunChatLoop_ContextCanceled(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // already canceled

	ki := newTestKialiInterfaceWithContext(t, ctx)

	// streamTurn returns successfully but the context is already done.
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		return "partial text", nil, nil
	}

	var chunks []string
	_, _, _, aborted := RunChatLoop(
		dummyProvider{}, ctx, ki,
		collectChunks(&chunks), streamTurn, nopPrepare(t),
	)

	assert.True(t, aborted)
	assert.True(t, hasErrorEvent(chunks), "a context-canceled error event must be emitted")
}

// TestRunChatLoop_ToolResultError verifies that an error status in any tool
// result causes an immediate abort.  prepareNextTurn must not be called.
func TestRunChatLoop_ToolResultError(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamCalls := 0
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		streamCalls++
		if streamCalls > 1 {
			t.Fatal("streamTurn must not be called a second time when a tool result errors")
		}
		return "", []types.StreamToolCallData{
			{Name: "nonexistent_tool", Args: map[string]any{}, ID: "tc-err"},
		}, nil
	}

	prepareCalled := false
	prepare := func(_ context.Context, _ []types.StreamToolCallData, _ []types.StreamToolResultData, _ bool, _ func(string)) (bool, string) {
		prepareCalled = true
		return false, ""
	}

	var chunks []string
	_, _, _, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(&chunks), streamTurn, prepare,
	)

	assert.True(t, aborted)
	assert.False(t, prepareCalled, "prepareNextTurn must not run after a tool error")
	assert.True(t, hasErrorEvent(chunks))
}

// TestRunChatLoop_PrepareNextTurnFalseStopsLoop verifies that when
// prepareNextTurn returns shouldContinue=false the loop ends without calling
// streamTurn a second time.  Extra text returned by prepareNextTurn must be
// appended to responseContent.
func TestRunChatLoop_PrepareNextTurnFalseStopsLoop(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamCalls := 0
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		streamCalls++
		if streamCalls > 1 {
			t.Fatal("streamTurn must not be called after prepareNextTurn returns false")
		}
		return "intro text", []types.StreamToolCallData{referencedDocsCall("tc-1")}, nil
	}

	prepareCalled := false
	prepare := func(_ context.Context, _ []types.StreamToolCallData, _ []types.StreamToolResultData, _ bool, _ func(string)) (bool, string) {
		prepareCalled = true
		return false, " + extra"
	}

	content, _, docs, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(new([]string)), streamTurn, prepare,
	)

	assert.False(t, aborted)
	assert.True(t, prepareCalled)
	assert.Equal(t, 1, streamCalls)
	assert.Contains(t, content, "intro text")
	assert.Contains(t, content, "+ extra")
	assert.Greater(t, len(docs), 0, "get_referenced_docs should produce referenced docs")
}

// TestRunChatLoop_PrepareNextTurnTrueContinuesLoop verifies that when
// prepareNextTurn returns shouldContinue=true the loop calls streamTurn again.
// On the second iteration, no tool calls are returned and the loop exits
// normally.
func TestRunChatLoop_PrepareNextTurnTrueContinuesLoop(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamCalls := 0
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		streamCalls++
		switch streamCalls {
		case 1:
			return "first", []types.StreamToolCallData{referencedDocsCall("tc-1")}, nil
		case 2:
			return " second", nil, nil // no tools → loop exits
		default:
			t.Fatalf("streamTurn called %d times (expected at most 2)", streamCalls)
			return "", nil, nil
		}
	}

	prepareCalls := 0
	prepare := func(_ context.Context, _ []types.StreamToolCallData, _ []types.StreamToolResultData, _ bool, _ func(string)) (bool, string) {
		prepareCalls++
		return true, "" // keep going
	}

	content, _, docs, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(new([]string)), streamTurn, prepare,
	)

	assert.False(t, aborted)
	assert.Equal(t, 2, streamCalls)
	assert.Equal(t, 1, prepareCalls)
	assert.Equal(t, "first second", content)
	assert.Greater(t, len(docs), 0)
}

// TestRunChatLoop_MaxToolIterationsAborts verifies that the loop is
// force-aborted with an error event when tool calls are returned on every
// iteration up to the maximum.
func TestRunChatLoop_MaxToolIterationsAborts(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamCalls := 0
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		streamCalls++
		// Always return a tool call so the loop never exits naturally.
		return "", []types.StreamToolCallData{referencedDocsCall(fmt.Sprintf("tc-%d", streamCalls))}, nil
	}

	var chunks []string
	_, _, _, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(&chunks), streamTurn, alwaysContinuePrepare(),
	)

	assert.True(t, aborted, "loop must abort after reaching maxToolIterations")
	assert.True(t, hasErrorEvent(chunks), "a max-iterations error event must be emitted")
	// 5 iterations: tools execute on 0..3 (iter 4 aborts before executing)
	// streamTurn is called on each of the 5 iterations.
	assert.Equal(t, 5, streamCalls)
}

// TestRunChatLoop_DocsAccumulatedAcrossIterations verifies that referenced
// docs collected across multiple tool-call iterations are all returned.
func TestRunChatLoop_DocsAccumulatedAcrossIterations(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamCalls := 0
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		streamCalls++
		switch streamCalls {
		case 1:
			return "", []types.StreamToolCallData{referencedDocsCall("tc-iter1")}, nil
		case 2:
			return "", []types.StreamToolCallData{referencedDocsCall("tc-iter2")}, nil
		default:
			return "done", nil, nil
		}
	}

	prepareCallCount := 0
	prepare := func(_ context.Context, _ []types.StreamToolCallData, _ []types.StreamToolResultData, _ bool, _ func(string)) (bool, string) {
		prepareCallCount++
		return true, "" // continue until streamTurn stops returning tool calls
	}

	_, _, docs, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(new([]string)), streamTurn, prepare,
	)

	assert.False(t, aborted)
	assert.Equal(t, 2, prepareCallCount)
	assert.Greater(t, len(docs), 0, "docs from both iterations must be accumulated")
}

// TestRunChatLoop_ContextCanceledAfterToolExecution verifies that a context
// cancellation occurring right after parallel tool execution is detected and
// causes an abort.
func TestRunChatLoop_ContextCanceledAfterToolExecution(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	ctx, cancel := context.WithCancel(context.Background())
	ki := newTestKialiInterfaceWithContext(t, ctx)

	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		// Cancel the context while tools are "running" (simulated here by
		// canceling before returning tool calls; the check fires after
		// ExecuteToolCallsInParallel returns).
		cancel()
		return "", []types.StreamToolCallData{referencedDocsCall("tc-1")}, nil
	}

	var chunks []string
	_, _, _, aborted := RunChatLoop(
		dummyProvider{}, ctx, ki,
		collectChunks(&chunks), streamTurn, alwaysStopPrepare(""),
	)

	assert.True(t, aborted)
	assert.True(t, hasErrorEvent(chunks))
}

// TestRunChatLoop_SSEChunksAreValidJSON verifies that every SSE chunk emitted
// by the loop (error events, tool_call events, etc.) is well-formed JSON.
func TestRunChatLoop_SSEChunksAreValidJSON(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	// Use a nonexistent tool so the loop aborts — we just want to collect the
	// error SSE event and verify it is valid JSON.
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		return "", []types.StreamToolCallData{
			{Name: "nonexistent_tool", Args: map[string]any{}, ID: "tc-1"},
		}, nil
	}

	var chunks []string
	RunChatLoop( //nolint:errcheck
		dummyProvider{}, context.Background(), ki,
		collectChunks(&chunks), streamTurn, alwaysStopPrepare(""),
	)

	require.NotEmpty(t, chunks)
	for _, chunk := range chunks {
		var event types.StreamEvent
		assert.NoError(t, json.Unmarshal([]byte(chunk), &event),
			"SSE chunk is not valid JSON: %q", chunk)
	}
}

// TestRunChatLoop_EmptyTextIsNotAccumulated verifies that empty strings
// returned by streamTurn do not pollute the final response content.
func TestRunChatLoop_EmptyTextIsNotAccumulated(t *testing.T) {
	require.NoError(t, mcp.LoadTools())
	ki := newTestKialiInterface(t)

	streamCalls := 0
	streamTurn := func(_ context.Context, _ func(string)) (string, []types.StreamToolCallData, error) {
		streamCalls++
		if streamCalls == 1 {
			return "", []types.StreamToolCallData{referencedDocsCall("tc-1")}, nil
		}
		return "final answer", nil, nil
	}

	content, _, _, aborted := RunChatLoop(
		dummyProvider{}, context.Background(), ki,
		collectChunks(new([]string)), streamTurn, alwaysContinuePrepare(),
	)

	assert.False(t, aborted)
	assert.Equal(t, "final answer", content, "empty text from first iteration must not be included")
}
