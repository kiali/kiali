package google_provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

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

	// Google Configuration
	config := &genai.GenerateContentConfig{
		Tools: p.GetToolDefinitions().([]*genai.Tool),
		ToolConfig: &genai.ToolConfig{
			FunctionCallingConfig: &genai.FunctionCallingConfig{
				Mode: genai.FunctionCallingConfigModeAny,
			},
		},
	}
	// Iterate tool-calling until the model returns a final answer (or we hit a safety cap).
	// Context is injected per request; it is not persisted.
	const maxToolRounds = 5
	final := &types.AIResponse{}
	pendingLogsContent := ""
	pendingLogsAnalyze := false

	for round := 0; round < maxToolRounds; round++ {
		// Create a temporary conversation with context for this model request (not persisted).
		conversationWithContext := p.AddContextToConversation(conversation, req)

		// If get_logs asked for analyze=true, inject raw logs only for this request (not persisted).
		if pendingLogsAnalyze && pendingLogsContent != "" {
			conversationWithContext = append(conversationWithContext, types.ConversationMessage{
				Role: "user",
				Content: "Analyze the following Kubernetes pod logs and explain what is happening. " +
					"Do not output any pseudo-tool tags (for example <execute_browse>). Use Markdown.\n\n" +
					pendingLogsContent,
			})
			pendingLogsAnalyze = false
			pendingLogsContent = ""
		}

		result, err := p.client.Models.GenerateContent(ctx, p.model, p.ConversationToProvider(conversationWithContext).([]*genai.Content), config)
		if err != nil {
			return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		functionCalls := result.FunctionCalls()
		if len(functionCalls) == 0 {
			final.Answer = providers.ParseMarkdownResponse(result.Text())
			break
		}

		tools, toolNames := p.TransformToolCallToToolsProcessor(functionCalls)
		log.Debugf("Google provider tool names (round=%d): %v", round, toolNames)

		toolResults := providers.ExecuteToolCallsInParallel(ctx, r, tools, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		processResult := providers.ProcessToolResults(toolResults, conversation)
		if processResult.Response != nil {
			if len(processResult.Response.Actions) > 0 {
				final.Actions = append(final.Actions, processResult.Response.Actions...)
			}
			if len(processResult.Response.Citations) > 0 {
				final.Citations = append(final.Citations, processResult.Response.Citations...)
			}
			if processResult.Response.Error != "" {
				final.Error = processResult.Response.Error
			}
			// Some tools return a ready-to-display answer (get_pod_performance, get_logs analyze=false).
			if processResult.Response.Answer != "" {
				final.Answer = processResult.Response.Answer
			}
		}
		conversation = processResult.Conversation

		if processResult.ShouldReturnEarly {
			if final.Error != "" {
				code := processResult.ErrorCode
				if code == 0 {
					code = http.StatusInternalServerError
				}
				return final, code
			}
			break
		}

		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		shouldGenerate, responseAnswer := providers.ShouldGenerateAnswer(final, toolNames)
		if !shouldGenerate {
			final.Answer = responseAnswer
			break
		}

		if processResult.GetLogsAnalyze && processResult.GetLogsContent != "" {
			pendingLogsAnalyze = true
			pendingLogsContent = processResult.GetLogsContent
		}
	}

	response := final

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

// AddContextToConversation creates a temporary copy of the conversation with context added
// The context is NOT saved to the persistent conversation to avoid contaminating future interactions
func (p *GoogleAIProvider) AddContextToConversation(conversation []types.ConversationMessage, req types.AIRequest) []types.ConversationMessage {
	if len(conversation) == 0 {
		return conversation
	}

	// Create a copy to avoid modifying the original
	result := make([]types.ConversationMessage, 0, len(conversation)+1)

	// Add system instruction (should be first)
	result = append(result, conversation[0])

	// Add context as second message (after system instruction, before user messages)
	contextBytes, _ := json.Marshal(req.Context)
	contextContent := fmt.Sprintf("CONTEXT (JSON):\n%s\n\n", string(contextBytes))
	result = append(result, types.ConversationMessage{
		Content: contextContent,
		Name:    "",
		Param:   nil,
		Role:    "system",
	})

	// Add the rest of the conversation
	if len(conversation) > 1 {
		result = append(result, conversation[1:]...)
	}

	return result
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
