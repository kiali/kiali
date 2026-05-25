package providers

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcp/get_referenced_docs"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/types"
)

// ExecuteToolCallsInParallel executes all tool calls in parallel and returns results in order
func ExecuteToolCallsInParallel(
	p AIProvider,
	onChunk func(chunk string),
	kialiInterface *mcputil.KialiInterface,
	toolCalls []types.StreamToolCallData,
) ([]types.StreamToolResultData, []get_action_ui.Action, []types.ReferencedDoc) {
	results := make([]types.StreamToolResultData, len(toolCalls))
	actions := []get_action_ui.Action{}
	referencedDocuments := []types.ReferencedDoc{}
	var wg sync.WaitGroup
	var mu sync.Mutex    // guards actions, referencedDocuments
	var sseMu sync.Mutex // guards onChunk — http.ResponseWriter is not concurrency-safe

	// safeOnChunk serializes SSE writes from goroutines so that concurrent tool
	// results never interleave bytes in the HTTP chunked response (which would
	// produce HPE_INVALID_CHUNK_SIZE at the proxy and cancel the request context).
	safeOnChunk := func(chunk string) {
		sseMu.Lock()
		defer sseMu.Unlock()
		onChunk(chunk)
	}

	Log(p, LogLevelDebug, "ToolCalls", "Executing %d tool calls in parallel", len(toolCalls))
	// Execute all tool calls in parallel
	for i, toolCall := range toolCalls {
		if !mcp.ExcludedToolNames[toolCall.Name] {
			Log(p, LogLevelDebug, "ToolCall", "Sending tool_call event: %s  id=%s", toolCall.Name, toolCall.ID)
			SendStreamEvent(onChunk, LLM_TOOL_CALL_EVENT, toolCall) // sequential — no lock needed
		}
		wg.Add(1)
		go func(index int, call types.StreamToolCallData) {
			defer wg.Done()
			if err := kialiInterface.Request.Context().Err(); err != nil {
				toolResult := types.StreamToolResultData{
					Content: fmt.Errorf("context canceled before executing tool %s: %w", call.Name, err).Error(),
					ID:      call.ID,
					Round:   1,
					Status:  "error",
					Type:    "tool_result",
				}
				results[index] = toolResult
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
				return
			}

			handler, ok := mcp.DefaultToolHandlers[call.Name]
			if !ok {
				toolResult := types.StreamToolResultData{
					Content: fmt.Errorf("tool handler not found: %s", call.Name).Error(),
					ID:      call.ID,
					Round:   1,
					Status:  "error",
					Type:    "tool_result",
				}
				results[index] = toolResult
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
				return
			}

			if !kialiInterface.Conf.ExternalServices.Tracing.Enabled && mcp.IsTraceTool(call.Name) {
				toolResult := types.StreamToolResultData{
					Content: fmt.Errorf("tool %s is not available when tracing is disabled", call.Name).Error(),
					ID:      call.ID,
					Round:   1,
					Status:  "error",
					Type:    "tool_result",
				}
				results[index] = toolResult
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
				return
			}

			// 404 mirrors the tracing gate convention above
			if !kialiInterface.Conf.ExternalServices.Prometheus.Enabled && mcp.IsMetricTool(call.Name) {
				toolResult := types.StreamToolResultData{
					Content: fmt.Errorf("metrics are unavailable because Prometheus is disabled").Error(),
					ID:      call.ID,
					Round:   1,
					Status:  "error",
					Type:    "tool_result",
				}
				results[index] = toolResult
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
				return
			}

			mcpResult, code := handler.Call(kialiInterface, call.Args)
			if code != http.StatusOK {
				toolResult := types.StreamToolResultData{
					Content: fmt.Errorf("tool %s returned error: %s", call.Name, mcpResult).Error(),
					ID:      call.ID,
					Round:   1,
					Status:  "error",
					Type:    "tool_result",
				}
				results[index] = toolResult
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
				return
			}
			if err := kialiInterface.Request.Context().Err(); err != nil {
				toolResult := types.StreamToolResultData{
					Content: fmt.Errorf("context canceled after executing tool %s: %w", call.Name, err).Error(),
					ID:      call.ID,
					Round:   1,
					Status:  "error",
					Type:    "tool_result",
				}
				results[index] = toolResult
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
				return
			}

			if call.Name == "manage_istio_config" {
				confirmed, _ := call.Args["confirmed"].(bool)
				if !confirmed {
					// The model prepared a YAML preview (confirmed=false).
					// Capture the file-attachment actions for the UI, then return a
					// short acknowledgement to the model instead of the full YAML
					// payload.  Sending large YAML back as a FunctionResponse is
					// unnecessary (the model already knows what it generated) and can
					// make the follow-up streaming request very large, which stresses
					// the SSE connection — especially on the Google/Gemini provider.
					//
					// The handler returns an anonymous struct, so we match it exactly
					// rather than asserting against a locally-named type (which would
					// always fail in Go because named != anonymous even when fields are
					// structurally identical).
					if mcpRes, ok := mcpResult.(struct {
						Actions []get_action_ui.Action `json:"actions"`
						Result  string                 `json:"result"`
					}); ok {
						mu.Lock()
						actions = append(actions, mcpRes.Actions...)
						mu.Unlock()
						toolResult := types.StreamToolResultData{
							Content: mcpRes.Result, // summary text only, not the full YAML
							ID:      call.ID,
							Round:   1,
							Status:  "success",
							Type:    "tool_result",
						}
						results[index] = toolResult
						SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
						return // skip the generic FormatToolContent path
					}
				}
			}

			if mcp.ExcludedToolNames[call.Name] {
				content := ""
				if call.Name == "get_action_ui" {
					if mcpRes, ok := mcpResult.(get_action_ui.GetActionUIResponse); ok {
						mu.Lock()
						actions = append(actions, mcpRes.Actions...)
						localActions := actions
						mu.Unlock()
						switch {
						case len(localActions) > 0:
							content = "Success. The user's UI has been redirected to the requested view or link was provided."
						case mcpRes.Errors != "":
							// Surface get_action_ui validation failures to the model instead of
							// silently reporting success when no UI action was produced.
							content = mcpRes.Errors
						}
					}
				}
				if call.Name == "get_referenced_docs" {
					if mcpRes, ok := mcpResult.(get_referenced_docs.GetReferencedDocResponse); ok {
						mu.Lock()
						referencedDocuments = append(referencedDocuments, mcpRes.ReferencedDocs...)
						mu.Unlock()
						content = "Success. Documentation links have been displayed in the user's UI."
					}
				}
				results[index] = types.StreamToolResultData{
					Content: content,
					ID:      call.ID,
					Round:   1,
					Status:  "success",
					Type:    "tool_result",
				}
				return
			}

			toolContent, err := FormatToolContent(mcpResult)
			if err != nil {
				toolResult := types.StreamToolResultData{
					Content: fmt.Errorf("failed to format tool %s content: %w", call.Name, err).Error(),
					ID:      call.ID,
					Round:   1,
					Status:  "error",
					Type:    "tool_result",
				}
				results[index] = toolResult
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
				return
			}
			if err := kialiInterface.Request.Context().Err(); err != nil {
				toolResult := types.StreamToolResultData{
					Content: fmt.Errorf("context canceled after formatting tool %s content: %w", call.Name, err).Error(),
					ID:      call.ID,
					Round:   1,
					Status:  "error",
					Type:    "tool_result",
				}
				results[index] = toolResult
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
				return
			}
			toolResult := types.StreamToolResultData{
				Content: toolContent,
				ID:      call.ID,
				Round:   1,
				Status:  "success",
				Type:    "tool_result",
			}
			if !mcp.ExcludedToolNames[call.Name] {
				Log(p, LogLevelDebug, "ToolCall", "Sending tool_result event: %s  id=%s", call.Name, call.ID)
				SendStreamEvent(safeOnChunk, LLM_TOOL_RESULT_EVENT, toolResult)
			} else {
				Log(p, LogLevelDebug, "ToolCall", "Skipping tool_result event for excluded tool: %s", call.Name)
			}
			results[index] = toolResult
		}(i, toolCall)
	}

	// Wait for all tool calls to complete
	wg.Wait()

	return results, actions, referencedDocuments
}
