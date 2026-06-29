package providers

import (
	"context"
	"fmt"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
)

// StreamTurnFunc performs one LLM streaming iteration.
// It sends LLM_TOKEN_EVENT chunks to onChunk as text arrives, and returns the
// full accumulated text and any tool calls the model requested.  err must be
// non-nil only for hard failures; benign SDK-internal context cleanup should be
// swallowed and handled by the shared loop's ctx.Err() check.
type StreamTurnFunc func(ctx context.Context, onChunk func(string)) (
	text string,
	toolCalls []types.StreamToolCallData,
	err error,
)

// PrepareNextTurnFunc applies successful tool results to the provider's internal
// message state so that the next call to StreamTurnFunc includes them.
//
//   - hasNonExcluded is true when at least one non-excluded tool was called.
//   - shouldContinue=false ends the loop (e.g. all tools were excluded helpers).
//   - extraText carries any additional text the provider generated while
//     acknowledging excluded-tool results — currently only used by Google/Gemini,
//     which must send function responses back before stopping.
type PrepareNextTurnFunc func(
	ctx context.Context,
	toolCalls []types.StreamToolCallData,
	toolResults []types.StreamToolResultData,
	hasNonExcluded bool,
	onChunk func(string),
) (shouldContinue bool, extraText string)

// RunChatLoop is the shared streaming orchestration used by every LLM provider.
//
// Each iteration:
//  1. Calls streamTurn to get text + tool calls from the model.
//  2. Executes tool calls in parallel.
//  3. Logs tool result errors and forwards them to the LLM as content so it can
//     compose a coherent partial-failure response (MCP protocol convention).
//  4. Calls prepareNextTurn to apply results to the provider's state.
//
// Returns (responseContent, actions, docs, aborted).  aborted=true means an
// error was already streamed to onChunk and the caller should return immediately.
func RunChatLoop(
	provider AIProvider,
	ctx context.Context,
	kialiInterface *mcputil.KialiInterface,
	onChunk func(string),
	streamTurn StreamTurnFunc,
	prepareNextTurn PrepareNextTurnFunc,
) (responseContent string, actions []get_action_ui.Action, docs []types.ReferencedDoc, aborted bool) {
	actions = []get_action_ui.Action{}
	docs = []types.ReferencedDoc{}

	const maxToolIterations = 5
	for iter := 0; iter < maxToolIterations; iter++ {
		text, toolCalls, err := streamTurn(ctx, onChunk)
		if err != nil {
			Log(provider, LogLevelError, "Error", "stream error (iter=%d): %v", iter, err)
			StreamError(onChunk, err.Error())
			return responseContent, actions, docs, true
		}
		if ctx.Err() != nil {
			NewContextCanceledResponse(onChunk, ctx.Err())
			return responseContent, actions, docs, true
		}

		responseContent += text

		if len(toolCalls) == 0 {
			responseContent = ParseMarkdownResponse(responseContent)
			break
		}

		if iter == maxToolIterations-1 {
			Log(provider, LogLevelError, "Error",
				"%s reached max tool iterations (%d)", provider.GetName(), maxToolIterations)
			StreamError(onChunk, fmt.Sprintf("%s reached max tool iterations (%d)",
				provider.GetName(), maxToolIterations))
			return responseContent, actions, docs, true
		}

		LogToolCalls(provider, iter, toolCalls)
		toolResults, acts, docList := ExecuteToolCallsInParallel(provider, onChunk, kialiInterface, toolCalls)
		actions = append(actions, acts...)
		docs = append(docs, docList...)

		if ctx.Err() != nil {
			NewContextCanceledResponse(onChunk, ctx.Err())
			return responseContent, actions, docs, true
		}

		// Tool result errors are logged for observability but forwarded to the LLM
		// so it can reason about partial failures (e.g. one cluster unreachable out
		// of two) and compose a coherent response.  This follows the MCP protocol
		// convention where tool errors are content, not fatal exceptions.
		for _, tr := range toolResults {
			if tr.Status == "error" {
				Log(provider, LogLevelWarn, "ToolResult", "Tool returned error (forwarded to LLM): %v", tr.Content)
			}
		}

		// Determine whether any non-excluded (real) tools were called.
		hasNonExcluded := false
		for _, tc := range toolCalls {
			if !mcp.ExcludedToolNames[tc.Name] {
				hasNonExcluded = true
				break
			}
		}

		shouldContinue, extraText := prepareNextTurn(ctx, toolCalls, toolResults, hasNonExcluded, onChunk)
		responseContent += extraText

		if !shouldContinue {
			break
		}
	}

	return responseContent, actions, docs, false
}
