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
	"github.com/kiali/kiali/log"
)

// ExecuteToolCallsInParallel executes all tool calls in parallel and returns results in order
func ExecuteToolCallsInParallel(
	kialiInterface *mcputil.KialiInterface,
	toolCalls []mcp.ToolsProcessor,
) []mcp.ToolCallResult {
	results := make([]mcp.ToolCallResult, len(toolCalls))
	var wg sync.WaitGroup
	log.Debugf("Executing %d tool calls in parallel", len(toolCalls))
	// Execute all tool calls in parallel
	for i, toolCall := range toolCalls {
		wg.Add(1)
		go func(index int, call mcp.ToolsProcessor) {
			defer wg.Done()
			actions := []get_action_ui.Action{}
			referencedDocs := []types.ReferencedDoc{}
			if err := kialiInterface.Request.Context().Err(); err != nil {
				results[index] = mcp.ToolCallResult{
					Error: fmt.Errorf("context canceled before executing tool %s: %w", call.Name, err),
					Code:  http.StatusRequestTimeout,
				}
				return
			}

			handler, ok := mcp.DefaultToolHandlers[call.Name]
			if !ok {
				results[index] = mcp.ToolCallResult{
					Error: fmt.Errorf("tool handler not found: %s", call.Name),
					Code:  http.StatusInternalServerError,
				}
				return
			}

			if !kialiInterface.Conf.ExternalServices.Tracing.Enabled && mcp.IsTraceTool(call.Name) {
				results[index] = mcp.ToolCallResult{
					Error: fmt.Errorf("tool %s is not available when tracing is disabled", call.Name),
					Code:  http.StatusNotFound,
				}
				return
			}

			mcpResult, code := handler.Call(kialiInterface, call.Args)
			if code != http.StatusOK {
				results[index] = mcp.ToolCallResult{
					Error: fmt.Errorf("tool %s returned error: %s", call.Name, mcpResult),
					Code:  code,
				}
				return
			}
			if err := kialiInterface.Request.Context().Err(); err != nil {
				results[index] = mcp.ToolCallResult{
					Error: fmt.Errorf("context canceled after executing tool %s: %w", call.Name, err),
					Code:  http.StatusRequestTimeout,
				}
				return
			}

			if call.Name == "manage_istio_config" {
				confirmed, _ := call.Args["confirmed"].(bool)
				if !confirmed {
					if mcpRes, ok := mcpResult.(struct {
						Actions []get_action_ui.Action `json:"actions"`
						Result  string                 `json:"result"`
					}); ok {
						actions = append(actions, mcpRes.Actions...)
					}
				}
			}

			if mcp.ExcludedToolNames[call.Name] {
				content := ""
				if call.Name == "get_action_ui" {
					if mcpRes, ok := mcpResult.(get_action_ui.GetActionUIResponse); ok {
						actions = append(actions, mcpRes.Actions...)
						switch {
						case len(actions) > 0:
							content = "Success. The user's UI has been redirected to the requested view."
						case mcpRes.Errors != "":
							// Surface get_action_ui validation failures to the model instead of
							// silently reporting success when no UI action was produced.
							content = mcpRes.Errors
						}
					}
				}
				if call.Name == "get_referenced_docs" {
					if mcpRes, ok := mcpResult.(get_referenced_docs.GetReferencedDocResponse); ok {
						referencedDocs = append(referencedDocs, mcpRes.ReferencedDocs...)
						content = "Success. Documentation links have been displayed in the user's UI."
					}
				}
				results[index] = mcp.ToolCallResult{
					Message: types.ConversationMessage{
						Content: content,
						Name:    call.Name,
						Param:   nil,
						Role:    "tool",
					},
					Code:           http.StatusOK,
					Actions:        actions,
					ReferencedDocs: referencedDocs,
				}
				return
			}

			toolContent, err := FormatToolContent(mcpResult)
			if err != nil {
				results[index] = mcp.ToolCallResult{
					Error: fmt.Errorf("failed to format tool %s content: %w", call.Name, err),
					Code:  http.StatusInternalServerError,
				}
				return
			}
			if err := kialiInterface.Request.Context().Err(); err != nil {
				results[index] = mcp.ToolCallResult{
					Error: fmt.Errorf("context canceled after formatting tool %s content: %w", call.Name, err),
					Code:  http.StatusRequestTimeout,
				}
				return
			}

			results[index] = mcp.ToolCallResult{
				Message: types.ConversationMessage{
					Content: toolContent,
					Name:    call.Name,
					Param:   call.Args,
					Role:    "tool",
				},
				Code:           http.StatusOK,
				Actions:        actions,
				ReferencedDocs: referencedDocs,
			}
		}(i, toolCall)
	}

	// Wait for all tool calls to complete
	wg.Wait()

	return results
}
