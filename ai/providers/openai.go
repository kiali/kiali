package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"

	openai "github.com/sashabaranov/go-openai"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcp/get_citations"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

// OpenAIProvider implements AIProvider using go-openai.
type OpenAIProvider struct {
	client *openai.Client
	model  string
}

func NewOpenAIProvider(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) *OpenAIProvider {
	cfg, err := getProviderConfig(conf, provider, model)
	if err != nil {
		log.Errorf("Failed to get provider config: %v", err)
		return nil
	}

	return &OpenAIProvider{
		client: openai.NewClientWithConfig(cfg),
		model:  model.Model,
	}
}

func (p *OpenAIProvider) SendChat(r *http.Request, req types.AIRequest, toolHandlers []mcp.ToolHandler,
	business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache, aiStore types.AIStore, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (*types.AIResponse, int) {
	if req.ConversationID == "" {
		return &types.AIResponse{Error: "conversation ID is required"}, http.StatusBadRequest
	}

	if req.Query == "" {
		return &types.AIResponse{Error: "query is required"}, http.StatusBadRequest
	}
	ctx := r.Context()
	var conversation []openai.ChatCompletionMessage
	var ptr *types.Conversation
	var sessionID string
	if aiStore.Enabled() {
		log.Debugf("AiStore is enabled: %+v", aiStore.Enabled())
		sessionID = authentication.GetSessionIDContext(r.Context()) // Use = not := to avoid shadowing
		log.Debugf("Getting conversation for session ID: %s", sessionID)
		var found bool
		ptr, found = aiStore.GetConversation(sessionID, req.ConversationID) // Use = not := to avoid shadowing
		log.Debugf("Conversation found: %+v", found)
		if found && ptr != nil {
			log.Debugf("Conversation found for conversation ID: %s", req.ConversationID)
			conversation = ptr.Conversation
		} else {
			log.Debugf("Creating new conversation for conversation ID: %s", req.ConversationID)
			// Create a new Conversation struct for storage later
			ptr = &types.Conversation{}
		}
	}

	if len(conversation) == 0 {
		conversation = []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: types.SystemInstruction,
			},
		}
	}

	contextBytes, _ := json.Marshal(req.Context)
	// Adding context to the conversation. This is the system message that is sent to the AI.
	conversation = append(conversation, openai.ChatCompletionMessage{
		Role: openai.ChatMessageRoleSystem,
		Content: fmt.Sprintf("CONTEXT (JSON):\n%s\n\n",
			string(contextBytes)),
	})
	// Adding user query to the conversation. This is the user message that is sent to the AI.
	conversation = append(conversation, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: req.Query,
	})

	// Prepare tool definitions and lookup
	toolDefs := make([]openai.Tool, 0, len(toolHandlers))
	handlerByName := make(map[string]mcp.ToolHandler, len(toolHandlers))
	for _, h := range toolHandlers {
		def := h.Definition()
		toolDefs = append(toolDefs, def)
		handlerByName[def.Function.Name] = h
	}

	resp, err := p.client.CreateChatCompletion(
		r.Context(),
		openai.ChatCompletionRequest{
			Model:    p.model,
			Messages: conversation,
			Tools:    toolDefs,
		},
	)

	if err != nil {
		return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
	}

	if len(resp.Choices) == 0 {
		return &types.AIResponse{Error: "openai returned no choices"}, http.StatusInternalServerError
	}
	msg := resp.Choices[0].Message
	conversation = append(conversation, msg)
	response := &types.AIResponse{}
	role := msg.Role
	if len(msg.ToolCalls) > 0 {
		// Execute tool calls in parallel since they don't depend on each other
		toolResults := p.executeToolCallsInParallel(r, msg.ToolCalls, handlerByName, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)

		// Add tool results to conversation in the original order
		for _, result := range toolResults {
			if result.err != nil {
				return &types.AIResponse{Error: result.err.Error()}, result.code
			}
			if len(result.actions) > 0 {
				response.Actions = append(response.Actions, result.actions...)
			}
			if len(result.citations) > 0 {
				response.Citations = append(response.Citations, result.citations...)
			}
			conversation = append(conversation, result.message)
		}

		finalResp, err := p.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
			Model:    p.model,
			Messages: conversation,
		})
		if err != nil {
			return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		response.Answer = parseResponse(finalResp.Choices[0].Message.Content)
		role = finalResp.Choices[0].Message.Role
	} else {
		response.Answer = parseResponse(msg.Content)
	}
	conversation = append(conversation, openai.ChatCompletionMessage{
		Role:    role,
		Content: response.Answer,
	})
	if aiStore.Enabled() {
		// Clean conversation by removing tool messages that are not useful for storage
		conversation = p.cleanConversation(conversation)
		if aiStore.ReduceWithAI() {
			// Reduce the conversation with AI
			conversation = p.reduceConversation(ctx, conversation, aiStore.ReduceThreshold())
		}
		ptr.Mu.Lock()
		ptr.Conversation = conversation
		ptr.Mu.Unlock()
		err := aiStore.SetConversation(sessionID, req.ConversationID, ptr)
		if err != nil {
			log.Warningf("Failed to set conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
		}
	}
	log.Debugf("AI Chat Response for conversation ID: %s: %+v", req.ConversationID, response)
	return response, http.StatusOK
}

// toolCallResult holds the result of a tool call execution
type toolCallResult struct {
	message   openai.ChatCompletionMessage
	err       error
	code      int
	actions   []get_action_ui.Action
	citations []get_citations.Citation
}

// executeToolCallsInParallel executes all tool calls in parallel and returns results in order
func (p *OpenAIProvider) executeToolCallsInParallel(
	r *http.Request,
	toolCalls []openai.ToolCall,
	handlerByName map[string]mcp.ToolHandler,
	business *business.Layer,
	prom prometheus.ClientInterface,
	clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache,
	conf *config.Config,
	grafana *grafana.Service,
	perses *perses.Service,
	discovery *istio.Discovery,
) []toolCallResult {
	results := make([]toolCallResult, len(toolCalls))
	var wg sync.WaitGroup
	log.Debugf("Executing %d tool calls in parallel", len(toolCalls))
	// Execute all tool calls in parallel
	for i, toolCall := range toolCalls {
		wg.Add(1)
		go func(index int, call openai.ToolCall) {
			defer wg.Done()
			actions := []get_action_ui.Action{}
			citations := []get_citations.Citation{}

			var args map[string]interface{}
			_ = json.Unmarshal([]byte(call.Function.Arguments), &args)
			log.Debugf("Calling tool: %+v with arguments: %+v", call.Function.Name, args)

			handler, ok := handlerByName[call.Function.Name]
			if !ok {
				results[index] = toolCallResult{
					err:  fmt.Errorf("tool handler not found: %s", call.Function.Name),
					code: http.StatusInternalServerError,
				}
				return
			}

			mcpResult, code := handler.Call(r, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
			if code != http.StatusOK {
				results[index] = toolCallResult{
					err:  fmt.Errorf("tool %s returned error: %s", call.Function.Name, mcpResult),
					code: code,
				}
				return
			}

			confirmed, _ := args["confirmed"].(bool)
			if call.Function.Name == mcp.ManageIstioConfigToolName && !confirmed {
				if mcpRes, ok := mcpResult.(struct {
					Actions []get_action_ui.Action `json:"actions"`
					Result  string                 `json:"result"`
				}); ok {
					actions = append(actions, mcpRes.Actions...)
				}
			}

			if call.Function.Name == mcp.GetActionUIToolName {
				if mcpRes, ok := mcpResult.(get_action_ui.GetActionUIResponse); ok {
					actions = append(actions, mcpRes.Actions...)
				}
			}

			if call.Function.Name == mcp.GetCitationsToolName {
				if mcpRes, ok := mcpResult.(get_citations.GetCitationsResponse); ok {
					citations = append(citations, mcpRes.Citations...)
				}
			}

			toolContent, err := formatToolContent(mcpResult)
			if err != nil {
				results[index] = toolCallResult{
					err:  fmt.Errorf("failed to format tool content: %w", err),
					code: http.StatusInternalServerError,
				}
				return
			}

			results[index] = toolCallResult{
				message: openai.ChatCompletionMessage{
					Role:       openai.ChatMessageRoleTool,
					Content:    toolContent,
					Name:       call.Function.Name,
					ToolCallID: call.ID,
				},
				code:      http.StatusOK,
				actions:   actions,
				citations: citations,
			}
		}(i, toolCall)
	}

	// Wait for all tool calls to complete
	wg.Wait()

	return results
}

// cleanConversation removes tool messages with names that are not useful for storage
// This helps reduce storage size by removing tool call responses that don't add value to the conversation context
func (p *OpenAIProvider) cleanConversation(conversation []openai.ChatCompletionMessage) []openai.ChatCompletionMessage {
	// List of tool names that are not useful to store in conversation history
	excludedToolNames := map[string]bool{
		mcp.GetCitationsToolName: true,
		mcp.GetActionUIToolName:  true,
	}

	cleaned := make([]openai.ChatCompletionMessage, 0, len(conversation))
	for _, msg := range conversation {
		// Remove tool messages where the tool name is in the exclusion list
		if msg.Role == openai.ChatMessageRoleTool {
			if excludedToolNames[msg.Name] {
				log.Debugf("Removing tool message with excluded tool name: %s", msg.Name)
				continue
			}
		}
		cleaned = append(cleaned, msg)
	}

	return cleaned
}

func (p *OpenAIProvider) reduceConversation(ctx context.Context, conversation []openai.ChatCompletionMessage, reduceThreshold int) []openai.ChatCompletionMessage {
	// Threshold: Only reduce if conversation gets long (e.g., > 10 messages)
	// You could also use a token counter here for more precision.
	if len(conversation) < reduceThreshold {
		return conversation
	}
	// Usually: [0] is SystemInstruction, [1] is Context JSON
	// We want to keep these "Instructional" messages separate from the "Dialogue"
	anchorIndex := 0
	for i, msg := range conversation {
		if i < 2 && msg.Role == openai.ChatMessageRoleSystem {
			anchorIndex = i // Keep up to the first two system messages (Instructions + Kiali Context)
		} else {
			break
		}
	}

	// Keep the last 4 messages (usually the latest User prompt, Tool calls, and Assistant answer)
	keepCount := 4
	if len(conversation)-anchorIndex <= keepCount {
		return conversation // Not enough dialogue to summarize yet
	}

	splitPoint := len(conversation) - keepCount

	instructions := conversation[:anchorIndex+1]
	toSummarize := conversation[anchorIndex+1 : splitPoint]
	recentMessages := conversation[splitPoint:]

	resp, err := p.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: p.model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: "You are a technical assistant for Kiali (Istio Service Mesh). Summarize the preceding troubleshooting steps, tool outputs, and user intents into a concise technical summary. Preserve key findings like pod names, error codes, or metrics.",
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: fmt.Sprintf("Summarize the following chat history: %+v", toSummarize),
			},
		},
	})
	if err != nil {
		log.Warningf("Failed to reduce conversation: %v", err)
		return conversation // Return original if summary fails
	}

	summary := resp.Choices[0].Message.Content

	var reduced []openai.ChatCompletionMessage
	reduced = append(reduced, instructions...)
	reduced = append(reduced, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleAssistant,
		Content: fmt.Sprintf("Summary of previous interactions: %s", summary),
	})
	reduced = append(reduced, recentMessages...)
	return reduced
}

func parseResponse(content string) string {
	// Fix code blocks: replace ``` with ~~~ (AI sometimes uses wrong delimiter)
	return strings.ReplaceAll(content, "```", "~~~")
}

func formatToolContent(result interface{}) (string, error) {
	switch v := result.(type) {
	case string:
		return v, nil
	case []byte:
		return string(v), nil
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}
}
