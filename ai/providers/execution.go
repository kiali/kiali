package providers

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcp/get_citations"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

// ExecuteToolCallsInParallel executes all tool calls in parallel and returns results in order
func ExecuteToolCallsInParallel(
	ctx context.Context,
	r *http.Request,
	toolCalls []mcp.ToolsProcessor,
	business *business.Layer,
	prom prometheus.ClientInterface,
	clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache,
	conf *config.Config,
	grafana *grafana.Service,
	perses *perses.Service,
	discovery *istio.Discovery,
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
			citations := []get_citations.Citation{}
			if err := ctx.Err(); err != nil {
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

			mcpResult, code := handler.Call(r, call.Args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
			if code != http.StatusOK {
				results[index] = mcp.ToolCallResult{
					Error: fmt.Errorf("tool %s returned error: %s", call.Name, mcpResult),
					Code:  code,
				}
				return
			}
			if err := ctx.Err(); err != nil {
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
				if call.Name == "get_action_ui" {
					if mcpRes, ok := mcpResult.(get_action_ui.GetActionUIResponse); ok {
						actions = append(actions, mcpRes.Actions...)
					}
				}
				if call.Name == "get_citations" {
					if mcpRes, ok := mcpResult.(get_citations.GetCitationsResponse); ok {
						citations = append(citations, mcpRes.Citations...)
					}
				}
				results[index] = mcp.ToolCallResult{
					Message: types.ConversationMessage{
						Content: "",
						Name:    call.Name,
						Param:   nil,
						Role:    "tool",
					},
					Code:      http.StatusOK,
					Actions:   actions,
					Citations: citations,
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
			if err := ctx.Err(); err != nil {
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
				Code:      http.StatusOK,
				Actions:   actions,
				Citations: citations,
			}
		}(i, toolCall)
	}

	// Wait for all tool calls to complete
	wg.Wait()

	return results
}
