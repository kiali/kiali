package openai_provider

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	openai "github.com/openai/openai-go/v3"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

func (p *OpenAIProvider) SendChat(kialiInterface *mcputil.KialiInterface, req types.AIRequest, aiStore types.AIStore) (*types.AIResponse, int) {
	if req.ConversationID == "" {
		return &types.AIResponse{Error: "conversation ID is required"}, http.StatusBadRequest
	}

	if req.Query == "" {
		return &types.AIResponse{Error: "query is required"}, http.StatusBadRequest
	}
	ctx := kialiInterface.Request.Context()
	ptr, sessionID, conversation := providers.GetStoreConversation(kialiInterface.Request, req, aiStore)
	p.InitializeConversation(&conversation, req)

	// Create a temporary conversation with context for the API call
	// The context is NOT saved to the persistent conversation to avoid contaminating future interactions
	conversationWithContext := providers.AddContextToConversation(conversation, req)

	log.Debugf("[Chat AI] Conversation sent to OpenAI (len=%d):", len(conversationWithContext))
	for i, msg := range conversationWithContext {
		contentPreview := msg.Content
		if len(contentPreview) > 100 {
			contentPreview = contentPreview[:100] + "..."
		}
		log.Debugf("  [%d] role=%s content=%q", i, msg.Role, contentPreview)
	}

	// We keep OpenAI-native messages for the iterative tool loop.
	// The persisted conversation will include only the user prompts and final assistant answer.
	messagesForModel := p.ConversationToProvider(conversationWithContext).([]openai.ChatCompletionMessageParamUnion)
	toolDefs := p.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam)

	response := &types.AIResponse{}

	const maxToolIterations = 5
	for iter := 0; iter < maxToolIterations; iter++ {
		resp, err := p.client.Chat.Completions.New(
			ctx,
			openai.ChatCompletionNewParams{
				Model:    p.model,
				Messages: messagesForModel,
				Tools:    toolDefs,
			},
		)
		if err != nil {
			log.Debugf("[Chat AI] OpenAI provider error in send chat with tools: %v", err)
			return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		if err := ctx.Err(); err != nil {
			log.Debugf("[Chat AI] OpenAI provider context error: %v", err)
			return providers.NewContextCanceledResponse(err)
		}
		if len(resp.Choices) == 0 {
			log.Debugf("[Chat AI] OpenAI provider error in send chat with tools no choices: %v", resp)
			return &types.AIResponse{Error: "openai returned no choices"}, http.StatusInternalServerError
		}

		msg := resp.Choices[0].Message
		if len(msg.ToolCalls) == 0 {
			response.Answer = providers.ParseMarkdownResponse(msg.Content)
			break
		}
		if iter == maxToolIterations-1 {
			log.Debugf("[Chat AI] OpenAI provider reached max tool iterations (%d) for conversation ID: %s", maxToolIterations, req.ConversationID)
			return &types.AIResponse{Error: fmt.Sprintf("openai reached max tool iterations (%d)", maxToolIterations)}, http.StatusInternalServerError
		}

		// Append the assistant tool-call message, then the tool responses, then ask the model again.
		assistantWithToolCalls := openai.ChatCompletionAssistantMessageParam{
			ToolCalls: make([]openai.ChatCompletionMessageToolCallUnionParam, 0, len(msg.ToolCalls)),
		}
		for _, tc := range msg.ToolCalls {
			assistantWithToolCalls.ToolCalls = append(assistantWithToolCalls.ToolCalls, tc.ToParam())
		}
		messagesForModel = append(messagesForModel, openai.ChatCompletionMessageParamUnion{OfAssistant: &assistantWithToolCalls})

		tools, toolNames := p.TransformToolCallToToolsProcessor(msg.ToolCalls)
		log.Debugf("[Chat AI] OpenAI provider tool calls (iter=%d): %v", iter, toolNames)

		toolResults := providers.ExecuteToolCallsInParallel(kialiInterface, tools)
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		// Process tool results using standardized logic (accumulate actions/citations).
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

		// Append tool outputs to the OpenAI conversation (linked by tool_call_id).
		// Note: even "excluded" tools must produce a tool response for OpenAI, otherwise
		// the next model call can fail with "missing tool responses".
		for i, toolResult := range toolResults {
			if toolResult.Error != nil {
				return &types.AIResponse{Error: toolResult.Error.Error()}, http.StatusInternalServerError
			}
			content := toolResult.Message.Content
			if strings.TrimSpace(content) == "" {
				content = "OK"
			}
			messagesForModel = append(messagesForModel, openai.ToolMessage(content, tools[i].ToolCallID))
		}

		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		// Continue loop: model may request additional tool calls.
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

func (p *OpenAIProvider) InitializeConversation(conversation *[]types.ConversationMessage, req types.AIRequest) {
	if conversation == nil {
		return
	}
	isNewConversation := len(*conversation) == 0
	if isNewConversation {
		// Initialize base system instruction when empty.
		*conversation = []types.ConversationMessage{{
			Content: types.SystemInstruction,
			Name:    "",
			Param:   openai.SystemMessage(types.SystemInstruction).GetContent().AsAny(),
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

func (p *OpenAIProvider) ReduceConversation(ctx context.Context, conversation []types.ConversationMessage, reduceThreshold int) []types.ConversationMessage {
	// Threshold: Only reduce if conversation gets long (e.g., > 10 messages)
	// You could also use a token counter here for more precision.
	if len(conversation) < reduceThreshold {
		return conversation
	}
	// Usually: [0] is SystemInstruction, [1] is Context JSON
	// We want to keep these "Instructional" messages separate from the "Dialogue"
	anchorIndex := 0
	for i, msg := range conversation {
		if i < 2 && msg.Role == "system" {
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

	resp, err := p.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.ChatModel(p.model),
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("You are a technical assistant for Kiali (Istio Service Mesh). Summarize the preceding troubleshooting steps, tool outputs, and user intents into a concise technical summary. Preserve key findings like pod names, error codes, or metrics."),
			openai.UserMessage(fmt.Sprintf("Summarize the following chat history: %+v", toSummarize)),
		},
	})
	if err != nil {
		log.Warningf("[Chat AI] Failed to reduce conversation: %v", err)
		return conversation // Return original if summary fails
	}

	summary := resp.Choices[0].Message.Content

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

func (p *OpenAIProvider) ProviderToConversation(providerMessage interface{}) types.ConversationMessage {
	chatCompletionMessage, ok := providerMessage.(openai.ChatCompletion)
	if !ok {
		return types.ConversationMessage{}
	}
	msg := chatCompletionMessage.Choices[0].Message
	var param interface{} = msg.ToParam()
	return types.ConversationMessage{
		Content: msg.Content,
		Role:    string(msg.Role),
		Name:    chatCompletionMessage.ID,
		Param:   param,
	}
}
func (p *OpenAIProvider) ConversationToProvider(conversation []types.ConversationMessage) interface{} {
	params := make([]openai.ChatCompletionMessageParamUnion, 0, len(conversation))
	for _, msg := range conversation {
		switch msg.Role {
		case "system":
			params = append(params, openai.SystemMessage(msg.Content))
		case "user":
			params = append(params, openai.UserMessage(msg.Content))
		case "tool":
			params = append(params, openai.AssistantMessage(msg.Content))
		default:
			params = append(params, openai.AssistantMessage(msg.Content))
		}
	}
	return params
}
