package google_provider

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"google.golang.org/genai"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

func (p *GoogleAIProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) {
	if req.Query == "" {
		providers.StreamError(onChunk, "query is required")
		return
	}

	ctx := kialiInterface.Request.Context()
	if p.client == nil {
		client, err := genai.NewClient(ctx, &p.config)
		if err != nil {
			providers.StreamError(onChunk, err.Error())
			return
		}
		p.client = client
	}
	ptr, sessionID := providers.GetStoreConversation(kialiInterface.Request, &req, aiStore, p.InitializeConversation)
	providers.SendStreamEvent(onChunk, "start", types.StreamStartData{ConversationID: req.ConversationID})
	providers.Log(p, providers.LogLevelDebug, "Conversation", "Google provider conversation ID: %s with model: %s and session ID: %s", req.ConversationID, p.model, sessionID)
	// Create a temporary conversation with context for the API call
	// The context is NOT saved to the persistent conversation to avoid contaminating future interactions
	conversationWithContext := providers.AddContextToConversation(ptr.Conversation, req)

	// Google Configuration
	config := &genai.GenerateContentConfig{
		Tools: p.GetToolDefinitions().([]*genai.Tool),
		ToolConfig: &genai.ToolConfig{
			FunctionCallingConfig: &genai.FunctionCallingConfig{
				Mode: genai.FunctionCallingConfigModeAuto,
			},
		},
		Temperature: genai.Ptr[float32](0),
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

	// Print content parts for debugging before starting the chat
	providers.Log(p, providers.LogLevelDebug, "Conversation", "Conversation sent to Google (len=%d):", len(contentsForChat))
	for i, c := range contentsForChat {
		providers.Log(p, providers.LogLevelDebug, "Conversation", "  [%d] role=%s parts=%d", i, c.Role, len(c.Parts))
	}

	var chat *genai.Chat
	var err error
	chat, err = p.client.Chats.Create(ctx, p.model, config, contentsForChat)
	if err != nil {
		providers.Log(p, providers.LogLevelError, "Error", "Error creating chat: %v", err)
		providers.StreamError(onChunk, err.Error())
		return
	}

	responseContent := ""
	endStream := &types.StreamEndData{}
	actions := []get_action_ui.Action{}
	referencedDocs := []types.ReferencedDoc{}

	const maxToolIterations = 5

	var nextParts []genai.Part
	nextParts = append(nextParts, genai.Part{Text: req.Query})

	for iter := 0; iter < maxToolIterations; iter++ {
		var functionCalls []*genai.FunctionCall
		var currentTurnContent string
		tokenID := 0

		for chunk, err := range chat.SendMessageStream(ctx, nextParts...) {
			if err != nil {
				providers.Log(p, providers.LogLevelError, "Error", "Error sending message stream: %v", err)
				providers.StreamError(onChunk, err.Error())
				return
			}

			// Extract function calls from this chunk
			functionCalls = append(functionCalls, chunk.FunctionCalls()...)

			// Stream text from this chunk
			text := chunk.Text()
			if text != "" {
				providers.Log(p, providers.LogLevelDebug, "Content", "Content: %s", text)
				providers.SendStreamEvent(onChunk, "token", types.StreamTokenData{
					ID:    tokenID,
					Token: text,
				})
				currentTurnContent += text
				tokenID++
			}
		}

		responseContent += currentTurnContent

		if len(functionCalls) == 0 {
			responseContent = providers.ParseMarkdownResponse(responseContent)
			break
		}
		if iter == maxToolIterations-1 {
			providers.Log(p, providers.LogLevelError, "Error", "Reached max tool iterations (%d) for conversation ID: %s", maxToolIterations, req.ConversationID)
			providers.StreamError(onChunk, fmt.Sprintf("google reached max tool iterations (%d)", maxToolIterations))
			return
		}

		tools, toolNames, err := p.TransformToolCallToToolsProcessor(functionCalls)
		if err != nil {
			providers.Log(p, providers.LogLevelError, "Error", "Error transforming tool calls: %v", err)
			providers.StreamError(onChunk, err.Error())
			return
		}

		providers.Log(p, providers.LogLevelDebug, "ToolCalls", "Google provider tool names (iter=%d): %v", iter, toolNames)
		toolResults, acts, docs := providers.ExecuteToolCallsInParallel(p, onChunk, kialiInterface, tools)
		actions = append(actions, acts...)
		referencedDocs = append(referencedDocs, docs...)
		if err := ctx.Err(); err != nil {
			providers.Log(p, providers.LogLevelError, "Error", "Context error: %v", err)
			providers.NewContextCanceledResponse(onChunk, err)
			return
		}

		hasNotExcludedTool := false
		for _, tool := range toolNames {
			if !mcp.ExcludedToolNames[tool] {
				hasNotExcludedTool = true
				break
			}
		}
		// Send function responses back to the chat (all tool calls in a single turn).
		nextParts = make([]genai.Part, 0, len(toolResults)+len(functionCalls))

		// Include the function calls themselves as parts to mirror Anthropic/OpenAI structure,
		// otherwise Gemini complains about missing corresponding function call for the response
		for _, fnCall := range functionCalls {
			nextParts = append(nextParts, genai.Part{FunctionCall: fnCall})
		}

		for i, toolResult := range toolResults {
			if toolResult.Status == "error" {
				providers.Log(p, providers.LogLevelError, "Error", "Error in tool result: %v", toolResult.Content)
				providers.StreamError(onChunk, toolResult.Content)
				return
			}
			content := toolResult.Content
			if strings.TrimSpace(content) == "" {
				content = "OK"
			}
			nextParts = append(nextParts, genai.Part{
				FunctionResponse: &genai.FunctionResponse{
					Name: tools[i].Name,
					ID:   tools[i].ID,
					Response: map[string]any{
						"output": content,
					},
				},
			})
		}

		if !hasNotExcludedTool {
			// Even if we are ending the turn due to excluded tools, we must first tell the model the result
			// of its function call, otherwise Gemini gets into an inconsistent state for the next message

			// To avoid Gemini panicking with "Please ensure that function response is provided for all the function calls"
			// we must append the tool response to the persistent conversation for future history, but we don't
			// send it to chat.SendMessage because we want to stop generating.

			// We save the mock-responses to the persistent conversation since we abort early.
			for _, part := range nextParts {
				if part.FunctionResponse != nil {
					// Only save if we need it in conversationToProvider later
					ptr.Mu.Lock()
					ptr.Conversation = append(ptr.Conversation, types.ConversationMessage{
						Content: part.FunctionResponse.Response["output"].(string),
						Name:    part.FunctionResponse.Name,
						Param:   nil,
						Role:    "tool",
					})
					ptr.Mu.Unlock()
				}
			}

			// Even if we break out of the loop because no more "actionable" tools were returned,
			// we MUST still send these function responses back to Gemini so that its internal state
			// recognizes that the function calls were completed. Otherwise it thinks there are hanging calls.
			for chunk, err := range chat.SendMessageStream(ctx, nextParts...) {
				if err != nil {
					providers.Log(p, providers.LogLevelError, "Error", "Error sending final message for excluded tools: %v", err)
					providers.StreamError(onChunk, err.Error())
					return
				}
				text := chunk.Text()
				if text != "" {
					providers.Log(p, providers.LogLevelDebug, "Content", "Content: %s", text)
					providers.SendStreamEvent(onChunk, "token", types.StreamTokenData{
						ID:    tokenID,
						Token: text,
					})
					responseContent += text
					tokenID++
				}
			}

			break // no not excluded tool calls found, we are done
		}
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

	providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req)
	providers.Log(p, providers.LogLevelDebug, "Response", "Response for conversation ID: %s: %+v", req.ConversationID, responseContent)

	endStream.Actions = actions
	endStream.ReferencedDocuments = referencedDocs
	endStream.Truncated = false

	providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req)
	providers.Log(p, providers.LogLevelDebug, "Response", "Response for conversation ID: %s: %+v", req.ConversationID, responseContent)
	providers.SendStreamEvent(onChunk, "end", *endStream)
}

func (p *GoogleAIProvider) TransformToolCallToToolsProcessor(toolCall any) ([]types.StreamToolCallData, []string, error) {
	toolsSlice, ok := toolCall.([]*genai.FunctionCall)
	toolNames := make([]string, len(toolsSlice))
	if !ok {
		return []types.StreamToolCallData{}, []string{}, nil
	}
	tools := make([]types.StreamToolCallData, len(toolsSlice))
	for i, tool := range toolsSlice {
		toolNames[i] = tool.Name
		tools[i] = types.StreamToolCallData{
			Args: tool.Args,
			Name: tool.Name,
			ID:   tool.ID,
			Type: "tool_call",
		}
	}

	return tools, toolNames, nil
}

func (p *GoogleAIProvider) InitializeConversation(ptr *types.Conversation, query string) {
	if ptr == nil {
		return
	}
	isNewConversation := len(ptr.Conversation) == 0
	if isNewConversation {
		// Initialize base system instruction when empty.
		ptr.Conversation = []types.ConversationMessage{{
			Content: types.SystemInstruction,
			Name:    "",
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

func (p *GoogleAIProvider) GetToolDefinitions() interface{} {
	tools := make([]*genai.FunctionDeclaration, 0, len(mcp.DefaultToolHandlers))
	for _, tool := range mcp.DefaultToolHandlers {
		if !p.tracingEnabled && mcp.IsTraceTool(tool.Name) {
			continue
		}
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

func (p *GoogleAIProvider) ReduceConversation(ctx context.Context, ptr *types.Conversation, reduceThreshold int) {
	instructions, toSummarize, recentMessages, ok := providers.SplitConversationForReduction(ptr.Conversation, reduceThreshold, 4)
	if !ok {
		return
	}

	chat, err := p.client.Chats.Create(ctx, p.model, &genai.GenerateContentConfig{}, nil)
	if err != nil {
		log.Warningf("[Chat AI] Failed to create chat in reduce conversation: %v", err)
		return // Return original if chat creation fails
	}
	resp, err := chat.SendMessage(ctx,
		genai.Part{Text: "You are a technical assistant for Kiali (Istio Service Mesh). Summarize the preceding troubleshooting steps, tool outputs, and user intents into a concise technical summary. Preserve key findings like pod names, error codes, or metrics."},
		genai.Part{Text: fmt.Sprintf("Summarize the following chat history: %+v", toSummarize)},
	)
	if err != nil {
		log.Warningf("[Chat AI] Failed to send message in reduce conversation: %v", err)
		return // Return original if message sending fails
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
	ptr.Mu.Lock()
	ptr.Conversation = reduced
	ptr.Mu.Unlock()
}
