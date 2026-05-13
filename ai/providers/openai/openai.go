package openai_provider

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	openai "github.com/openai/openai-go/v3"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

func (p *OpenAIProvider) GetName() string {
	return "OpenAI"
}

func (p *OpenAIProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) {
	if req.Query == "" {
		providers.StreamError(onChunk, "query is required")
		return
	}

	ctx := kialiInterface.Request.Context()
	ptr, sessionID := providers.GetStoreConversation(kialiInterface.Request, &req, aiStore, p.InitializeConversation)
	providers.SendStreamEvent(onChunk, "start", types.StreamStartData{ConversationID: req.ConversationID})
	providers.Log(p, providers.LogLevelDebug, "Conversation", "OpenAI provider conversation ID: %s with model: %s and session ID: %s", req.ConversationID, p.model, sessionID)
	// Create a temporary conversation with context for the API call
	// The context is NOT saved to the persistent conversation to avoid contaminating future interactions
	conversationWithContext := providers.AddContextToConversation(ptr.Conversation, req)

	providers.Log(p, providers.LogLevelDebug, "Conversation", "Conversation sent to OpenAI (len=%d):", len(conversationWithContext))
	for i, msg := range conversationWithContext {
		contentPreview := msg.Content
		if len(contentPreview) > 100 {
			contentPreview = contentPreview[:100] + "..."
		}
		providers.Log(p, providers.LogLevelDebug, "Conversation", "  [%d] role=%s content=%q", i, msg.Role, contentPreview)
	}

	// We keep OpenAI-native messages for the iterative tool loop.
	// The persisted conversation will include only the user prompts and final assistant answer.
	messagesForModel := p.ConversationToProvider(conversationWithContext).([]openai.ChatCompletionMessageParamUnion)
	toolDefs := p.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam)

	endStream := &types.StreamEndData{}
	actions := []get_action_ui.Action{}
	referencedDocs := []types.ReferencedDoc{}
	responseContent := ""
	params := openai.ChatCompletionNewParams{
		Model:    p.model,
		Messages: messagesForModel,
		Tools:    toolDefs,
		StreamOptions: openai.ChatCompletionStreamOptionsParam{
			IncludeUsage: openai.Bool(true),
		},
	}
	const maxToolIterations = 5
	for iter := 0; iter < maxToolIterations; iter++ {
		// Initial request with streaming
		stream := p.client.Chat.Completions.NewStreaming(ctx, params)
		// acumulator for the stream
		acc := openai.ChatCompletionAccumulator{}

		tokenID := 0
		// Analyze stream by chunk
		for stream.Next() {
			chunk := stream.Current()
			acc.AddChunk(chunk)
			//  Display the content as it arrives
			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				chunContent := chunk.Choices[0].Delta.Content
				providers.Log(p, providers.LogLevelDebug, "Content", "Content: %s", chunk.Choices[0].Delta.Content)
				providers.SendStreamEvent(onChunk, "token", types.StreamTokenData{
					ID:    tokenID,
					Token: chunContent,
				})
				responseContent += chunContent
				tokenID++
			}
		}
		if err := stream.Err(); err != nil {
			providers.Log(p, providers.LogLevelError, "Error", "OpenAI provider error in send chat with tools: %v", err)
			providers.StreamError(onChunk, err.Error())
			return
		}

		if err := ctx.Err(); err != nil {
			providers.Log(p, providers.LogLevelError, "Error", "OpenAI provider context error: %v", err)
			providers.NewContextCanceledResponse(onChunk, err)
			return
		}
		// Access the accumulated message and tool calls
		var toolCalls []openai.ChatCompletionMessageToolCallUnion
		if len(acc.Choices) > 0 {
			toolCalls = acc.Choices[0].Message.ToolCalls
			if len(toolCalls) == 0 {
				break // no tool calls found, we are done
			}
			providers.Log(p, providers.LogLevelDebug, "ToolCalls", "OpenAI provider tool calls (iter=%d): %v", iter, toolCalls)
		} else {
			break
		}

		// There is function Calls
		if iter == maxToolIterations-1 {
			providers.Log(p, providers.LogLevelError, "Error", "OpenAI provider reached max tool iterations (%d) for conversation ID: %s", maxToolIterations, req.ConversationID)
			providers.StreamError(onChunk, fmt.Sprintf("openai reached max tool iterations (%d)", maxToolIterations))
			return
		}
		// Append the assistant tool-call message, then the tool responses, then ask the model again.
		assistantWithToolCalls := openai.ChatCompletionAssistantMessageParam{
			ToolCalls: make([]openai.ChatCompletionMessageToolCallUnionParam, 0, len(toolCalls)),
		}
		for _, tc := range toolCalls {
			args := tc.Function.Arguments
			if args == "" {
				args = "{}"
			}
			assistantWithToolCalls.ToolCalls = append(assistantWithToolCalls.ToolCalls, openai.ChatCompletionMessageToolCallUnionParam{
				OfFunction: &openai.ChatCompletionMessageFunctionToolCallParam{
					ID: tc.ID,
					Function: openai.ChatCompletionMessageFunctionToolCallFunctionParam{
						Name:      tc.Function.Name,
						Arguments: args,
					},
				},
			})
		}
		params.Messages = append(params.Messages, openai.ChatCompletionMessageParamUnion{OfAssistant: &assistantWithToolCalls})
		tools, toolNames, err := p.TransformToolCallToToolsProcessor(toolCalls)
		if err != nil {
			providers.StreamError(onChunk, err.Error())
			return
		}
		providers.Log(p, providers.LogLevelDebug, "ToolCalls", "OpenAI provider tool calls (iter=%d): %v", iter, toolNames)
		toolResults, acts, docs := providers.ExecuteToolCallsInParallel(p, onChunk, kialiInterface, tools)
		actions = append(actions, acts...)
		referencedDocs = append(referencedDocs, docs...)
		hasNotExcludedTool := false
		for _, tool := range toolNames {
			if !mcp.ExcludedToolNames[tool] {
				hasNotExcludedTool = true
				break
			}
		}
		if !hasNotExcludedTool {
			break // no not excluded tool calls found, we are done
		}

		// Append tool outputs to the OpenAI conversation (linked by tool_call_id).
		// Note: even "excluded" tools must produce a tool response for OpenAI, otherwise
		// the next model call can fail with "missing tool responses".
		for _, toolResult := range toolResults {
			if toolResult.Status == "error" {
				providers.Log(p, providers.LogLevelError, "ToolResult", "Error in tool result: %v", toolResult.Content)
				providers.StreamError(onChunk, toolResult.Content)
				return
			}

			content := toolResult.Content
			if strings.TrimSpace(content) != "" {
				providers.Log(p, providers.LogLevelDebug, "ToolResult", "Tool result added to meessageForModel(iter=%d): ID:%s Content:%s", iter, toolResult.ID, content)
				params.Messages = append(params.Messages, openai.ToolMessage(content, toolResult.ID))
			}
		}

		if err := ctx.Err(); err != nil {
			providers.NewContextCanceledResponse(onChunk, err)
			providers.Log(p, providers.LogLevelError, "Context", "Context error: %v", err)
			return
		}

		// Continue loop: model may request additional tool calls.
	}

	// Add the final assistant response to conversation (without tool call metadata)
	// This keeps conversational context without confusing future tool selections
	if responseContent != "" {
		ptr.Mu.Lock()
		ptr.Conversation = append(ptr.Conversation, types.ConversationMessage{
			Content: responseContent,
			Name:    "",
			Param:   nil,
			Role:    "assistant",
		})
		ptr.Mu.Unlock()
	}

	endStream.Actions = actions
	endStream.ReferencedDocuments = referencedDocs
	endStream.Truncated = false

	providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req)
	providers.Log(p, providers.LogLevelDebug, "Response", "Response for conversation ID: %s: %+v", req.ConversationID, responseContent)
	providers.SendStreamEvent(onChunk, "end", *endStream)
}

func (p *OpenAIProvider) InitializeConversation(ptr *types.Conversation, query string) {
	if ptr == nil {
		return
	}
	isNewConversation := len(ptr.Conversation) == 0
	if isNewConversation {
		// Initialize base system instruction when empty.
		ptr.Conversation = []types.ConversationMessage{{
			Content: types.SystemInstruction,
			Name:    "",
			Param:   openai.SystemMessage(types.SystemInstruction).GetContent().AsAny(),
			Role:    "system",
		},
		}
	}
	// Adding user query to the conversation. This is the user message that is sent to the AI.
	ptr.Conversation = append(ptr.Conversation, types.ConversationMessage{
		Content: query,
		Name:    "",
		Param:   nil,
		Role:    "user",
	})
}

func (p *OpenAIProvider) ReduceConversation(ctx context.Context, ptr *types.Conversation, reduceThreshold int) {
	instructions, toSummarize, recentMessages, ok := providers.SplitConversationForReduction(ptr.Conversation, reduceThreshold, 4)
	if !ok {
		return
	}

	resp, err := p.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.ChatModel(p.model),
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage("You are a technical assistant for Kiali (Istio Service Mesh). Summarize the preceding troubleshooting steps, tool outputs, and user intents into a concise technical summary. Preserve key findings like pod names, error codes, or metrics."),
			openai.UserMessage(fmt.Sprintf("Summarize the following chat history: %+v", toSummarize)),
		},
	})
	if err != nil {
		log.Warningf("[Chat AI] Failed to reduce conversation: %v", err)
		return // Return original if summary fails
	}

	if len(resp.Choices) == 0 {
		log.Warningf("[Chat AI] OpenAI returned no choices during conversation reduction")
		return
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
	ptr.Mu.Lock()
	ptr.Conversation = reduced
	ptr.Mu.Unlock()
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
