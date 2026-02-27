package google_provider

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"google.golang.org/genai"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/providers"
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

func (p *GoogleAIProvider) SendChat(r *http.Request, req types.AIRequest, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache, aiStore types.AIStore, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (*types.AIResponse, int) {
	ctx := r.Context()
	if p.client == nil {
		client, err := genai.NewClient(ctx, &p.config)
		if err != nil {
			return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		p.client = client
	}
	ptr, sessionID, conversation := providers.GetStoreConversation(r, req, aiStore)
	log.Debugf("Google provider conversation ID: %s with model: %s and session ID: %s", req.ConversationID, p.model, sessionID)

	p.InitializeConversation(&conversation, req)

	// Create a temporary conversation with context for the API call
	// The context is NOT saved to the persistent conversation to avoid contaminating future interactions
	conversationWithContext := providers.AddContextToConversation(conversation, req)

	// Google Configuration
	config := &genai.GenerateContentConfig{
		Tools: p.GetToolDefinitions().([]*genai.Tool),
		ToolConfig: &genai.ToolConfig{
			FunctionCallingConfig: &genai.FunctionCallingConfig{
				Mode: genai.FunctionCallingConfigModeAny,
			},
		},
	}

	// If the query is in conversationWithContext
	// it must be removed to avoid duplication.
	contentsForChat := p.ConversationToProvider(conversationWithContext).([]*genai.Content)
	if len(contentsForChat) > 0 {
		last := contentsForChat[len(contentsForChat)-1]
		if last != nil && last.Role == genai.RoleUser && len(last.Parts) == 1 && last.Parts[0] != nil && last.Parts[0].Text == req.Query {
			contentsForChat = contentsForChat[:len(contentsForChat)-1]
		}
	}
	chat, err := p.client.Chats.Create(ctx, p.model, config, contentsForChat)
	if err != nil {
		log.Debugf("Google provider error: %v", err)
		return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
	}

	response := &types.AIResponse{}

	result, err := chat.SendMessage(ctx, genai.Part{Text: req.Query})
	if err != nil {
		return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
	}

	for iter := 0; ; iter++ {
		functionCalls := result.FunctionCalls()
		if len(functionCalls) == 0 {
			response.Answer = providers.ParseMarkdownResponse(result.Text())
			break
		}

		tools, toolNames := p.TransformToolCallToToolsProcessor(functionCalls)
		log.Debugf("Google provider tool names (iter=%d): %v", iter, toolNames)
		toolResults := providers.ExecuteToolCallsInParallel(ctx, r, tools, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		processResult := providers.ProcessToolResults(toolResults, conversation)
		if processResult.Response.Error != "" {
			return processResult.Response, http.StatusInternalServerError
		}
		if len(processResult.Response.Actions) > 0 {
			response.Actions = append(response.Actions, processResult.Response.Actions...)
		}
		if len(processResult.Response.Citations) > 0 {
			response.Citations = append(response.Citations, processResult.Response.Citations...)
		}
		conversation = processResult.Conversation

		if processResult.ShouldReturnEarly {
			if processResult.Response.Answer != "" {
				response.Answer = processResult.Response.Answer
			}
			break
		}

		shouldGenerate, responseAnswer := providers.ShouldGenerateAnswer(&types.AIResponse{
			Actions:   response.Actions,
			Citations: response.Citations,
		}, toolNames)
		if !shouldGenerate {
			response.Answer = responseAnswer
			break
		}

		// Send function responses back to the chat (all tool calls in a single turn).
		parts := make([]genai.Part, 0, len(toolResults))
		for i, toolResult := range toolResults {
			if toolResult.Error != nil {
				return &types.AIResponse{Error: toolResult.Error.Error()}, http.StatusInternalServerError
			}
			content := toolResult.Message.Content
			if strings.TrimSpace(content) == "" {
				content = "OK"
			}
			parts = append(parts, genai.Part{
				FunctionResponse: &genai.FunctionResponse{
					Name: tools[i].Name,
					ID:   tools[i].ToolCallID,
					Response: map[string]any{
						"output": content,
					},
				},
			})
		}

		result, err = chat.SendMessage(ctx, parts...)
		if err != nil {
			return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

	}

	// Add the final assistant response to conversation (without tool call metadata)
	// This keeps conversational context without confusing future tool selections
	if response.Answer != "" {
		conversation = append(conversation, types.ConversationMessage{
			Content: response.Answer,
			Name:    "",
			Param:   nil,
			Role:    "assistant",
		})
	}

	providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req, conversation)
	log.Debugf("[Chat AI] Response for conversation ID: %s: %+v", req.ConversationID, response)

	return response, http.StatusOK
}

func (p *GoogleAIProvider) TransformToolCallToToolsProcessor(toolCall any) ([]mcp.ToolsProcessor, []string) {
	toolsSlice, ok := toolCall.([]*genai.FunctionCall)
	toolNames := make([]string, len(toolsSlice))
	if !ok {
		return []mcp.ToolsProcessor{}, []string{}
	}
	tools := make([]mcp.ToolsProcessor, len(toolsSlice))
	for i, tool := range toolsSlice {
		toolNames[i] = tool.Name
		tools[i] = mcp.ToolsProcessor{
			Args:       tool.Args,
			Name:       tool.Name,
			ToolCallID: tool.ID,
		}
	}
	return tools, toolNames
}

func (p *GoogleAIProvider) InitializeConversation(conversation *[]types.ConversationMessage, req types.AIRequest) {
	if conversation == nil {
		return
	}
	isNewConversation := len(*conversation) == 0
	if isNewConversation {
		// Initialize base system instruction when empty.
		*conversation = []types.ConversationMessage{{
			Content: types.SystemInstruction,
			Name:    "",
			Role:    "system",
		},
		}
	}
	// Adding user query to the conversation. This is the user message that is sent to the AI.
	*conversation = append(*conversation, types.ConversationMessage{
		Content: req.Query,
		Name:    "",
		Param:   nil,
		Role:    "user",
	})
}

func (p *GoogleAIProvider) GetToolDefinitions() interface{} {
	tools := make([]*genai.FunctionDeclaration, 0, len(mcp.DefaultToolHandlers))
	for _, tool := range mcp.DefaultToolHandlers {
		tools = append(tools, &genai.FunctionDeclaration{
			Name:        tool.GetName(),
			Description: tool.GetDescription(),
			Parameters:  mapToGenAISchema(tool.GetDefinition()),
		})
	}
	return []*genai.Tool{{
		FunctionDeclarations: tools,
	}}
}

func (p *GoogleAIProvider) ConversationToProvider(conversation []types.ConversationMessage) interface{} {
	contents := make([]*genai.Content, len(conversation))
	for i, msg := range conversation {
		role := msg.Role
		switch role {
		case "system":
			role = genai.RoleModel
		case "user":
			role = genai.RoleUser
		case "tool":
			role = genai.RoleModel
		default:
			role = genai.RoleModel
		}
		contents[i] = &genai.Content{
			Role: role,
			Parts: []*genai.Part{
				{Text: msg.Content},
			},
		}
	}
	return contents
}

func (p *GoogleAIProvider) ProviderToConversation(providerMessage interface{}) types.ConversationMessage {
	response, ok := providerMessage.(*genai.GenerateContentResponse)
	if !ok {
		return types.ConversationMessage{}
	}
	return types.ConversationMessage{
		Content: response.Text(),
		Name:    response.ResponseID,
		Param:   nil,
		Role:    genai.RoleModel,
	}
}

func (p *GoogleAIProvider) ReduceConversation(ctx context.Context, conversation []types.ConversationMessage, reduceThreshold int) []types.ConversationMessage {
	// Threshold: Only reduce if conversation gets long (e.g., > 10 messages)
	// You could also use a token counter here for more precision.
	if len(conversation) < reduceThreshold {
		return conversation
	}
	// Usually: [0] is SystemInstruction, [1] is Context JSON
	// We want to keep these "Instructional" messages separate from the "Dialogue"
	anchorIndex := 0
	for i, msg := range conversation {
		if i < 2 && msg.Role == genai.RoleModel {
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

	chat, err := p.client.Chats.Create(ctx, p.model, &genai.GenerateContentConfig{}, p.ConversationToProvider(conversation).([]*genai.Content))
	if err != nil {
		log.Warningf("[Chat AI] Failed to create chat in reduce conversation: %v", err)
		return conversation // Return original if chat creation fails
	}
	resp, err := chat.SendMessage(ctx,
		genai.Part{Text: "You are a technical assistant for Kiali (Istio Service Mesh). Summarize the preceding troubleshooting steps, tool outputs, and user intents into a concise technical summary. Preserve key findings like pod names, error codes, or metrics."},
		genai.Part{Text: fmt.Sprintf("Summarize the following chat history: %+v", toSummarize)},
	)
	if err != nil {
		log.Warningf("[Chat AI] Failed to send message in reduce conversation: %v", err)
		return conversation // Return original if message sending fails
	}

	summary := resp.Text()

	var reduced []types.ConversationMessage
	reduced = append(reduced, instructions...)
	summaryContent := fmt.Sprintf("Summary of previous interactions: %s", summary)
	reduced = append(reduced, types.ConversationMessage{
		Content: summaryContent,
		Name:    "",
		Param:   nil,
		Role:    "system",
	})
	reduced = append(reduced, recentMessages...)
	return reduced
}
