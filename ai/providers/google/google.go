package google_provider

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"google.golang.org/genai"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

func usageFromGenerateContentResponse(resp *genai.GenerateContentResponse) types.TokenUsage {
	if resp == nil || resp.UsageMetadata == nil {
		return types.TokenUsage{}
	}

	promptTokens := int64(resp.UsageMetadata.PromptTokenCount + resp.UsageMetadata.ToolUsePromptTokenCount)
	completionTokens := int64(resp.UsageMetadata.CandidatesTokenCount + resp.UsageMetadata.ThoughtsTokenCount)

	return types.NewTokenUsage(promptTokens, completionTokens, int64(resp.UsageMetadata.TotalTokenCount))
}

func (p *GoogleAIProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) types.TokenUsage {
	if req.Query == "" {
		providers.StreamError(onChunk, "query is required")
		return types.TokenUsage{}
	}

	ctx := kialiInterface.Request.Context()
	if p.client == nil {
		client, err := genai.NewClient(ctx, &p.config)
		if err != nil {
			providers.StreamError(onChunk, err.Error())
			return types.TokenUsage{}
		}
		p.client = client
	}
	ptr, sessionID := providers.GetStoreConversation(kialiInterface.Request, &req, aiStore, p.InitializeConversation)
	providers.SendStreamEvent(onChunk, providers.LLM_START_EVENT, types.StreamStartData{ConversationID: req.ConversationID})
	providers.Log(p, providers.LogLevelDebug, "Conversation", "Google provider conversation ID: %s with model: %s and session ID: %s", req.ConversationID, p.model, sessionID)
	usage := types.TokenUsage{}

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
	contentsForChat := p.ConversationToProvider(ptr.Conversation).([]*genai.Content)
	if len(contentsForChat) > 0 {
		last := contentsForChat[len(contentsForChat)-1]
		if last != nil && last.Role == genai.RoleUser && len(last.Parts) == 1 && last.Parts[0] != nil && last.Parts[0].Text == req.Query {
			contentsForChat = contentsForChat[:len(contentsForChat)-1]
		}
	}

	// Print content parts for debugging before starting the chat
	providers.Log(p, providers.LogLevelDebug, "Conversation", "Conversation sent to Google (len=%d):", len(contentsForChat))
	for i, c := range contentsForChat {
		providers.Log(p, providers.LogLevelDebug, "Conversation", " Message =>[%d] [Role %s]  parts=%d", i, c.Role, len(c.Parts))
	}

	var chat *genai.Chat
	var err error
	chat, err = p.client.Chats.Create(ctx, p.model, config, contentsForChat)
	if err != nil {
		providers.Log(p, providers.LogLevelError, "Error", "Error creating chat: %v", err)
		providers.StreamError(onChunk, err.Error())
		return types.TokenUsage{}
	}

	// nextParts and lastFunctionCalls are shared between streamTurn and prepareNextTurn
	// via closure — each iteration updates them for the next.
	var nextParts []genai.Part
	nextParts = append(nextParts, genai.Part{Text: req.Query})
	var lastFunctionCalls []*genai.FunctionCall // raw Gemini calls, needed for FunctionCall echo in prepareNextTurn

	// streamTurn executes one Gemini streaming turn using the current nextParts.
	// ParseMarkdownResponse is NOT applied — the shared RunChatLoop does it.
	streamTurn := func(ctx context.Context, onChunk func(string)) (string, []types.StreamToolCallData, error) {
		var functionCalls []*genai.FunctionCall
		text := ""
		tokenID := 0
		turnUsage := types.TokenUsage{}
		sawTurnUsage := false

		for chunk, err := range chat.SendMessageStream(ctx, nextParts...) {
			if err != nil {
				if ctx.Err() == nil && (errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)) {
					providers.Log(p, providers.LogLevelDebug, "Content", "Google stream completed with internal SDK context cleanup — not an error")
					break
				}
				return text, nil, err
			}
			functionCalls = append(functionCalls, chunk.FunctionCalls()...)
			if chunk.UsageMetadata != nil {
				turnUsage = usageFromGenerateContentResponse(chunk)
				sawTurnUsage = turnUsage.HasTokens()
			}
			if t := chunk.Text(); t != "" {
				providers.Log(p, providers.LogLevelDebug, "Content", "Content: %s", t)
				providers.SendStreamEvent(onChunk, providers.LLM_TOKEN_EVENT, types.StreamTokenData{ID: tokenID, Token: t})
				text += t
				tokenID++
			}
		}
		if sawTurnUsage {
			usage.Add(turnUsage)
		}

		if len(functionCalls) == 0 {
			lastFunctionCalls = nil
			return text, nil, nil // no tool calls → shared loop applies ParseMarkdownResponse
		}

		toolCalls, _, err := p.TransformToolCallToToolsProcessor(functionCalls)
		if err != nil {
			providers.Log(p, providers.LogLevelError, "Error", "Error transforming tool calls: %v", err)
			return text, nil, err
		}
		lastFunctionCalls = functionCalls
		return text, toolCalls, nil
	}

	// prepareNextTurn builds function-response parts for the next Gemini turn.
	// When all tools are excluded helpers, Gemini still needs the function responses
	// to avoid an "unmatched function call" error — this is handled by sending a
	// final stream and returning shouldContinue=false.
	prepareNextTurn := func(ctx context.Context, toolCalls []types.StreamToolCallData, toolResults []types.StreamToolResultData, hasNonExcluded bool, onChunk func(string)) (bool, string) {
		parts := make([]genai.Part, 0, len(toolResults)+len(lastFunctionCalls))

		// Echo the raw FunctionCall parts from the last model turn so that
		// Gemini can match responses to calls by position when IDs are empty
		// (Gemini often returns empty IDs for parallel calls).  Without this
		// echo the genai.Chat SDK cannot correlate the FunctionResponse parts
		// and cancels the context before the next request is even sent.
		for _, fnCall := range lastFunctionCalls {
			parts = append(parts, genai.Part{FunctionCall: fnCall})
		}
		for i, tr := range toolResults {
			content := tr.Content
			if strings.TrimSpace(content) == "" {
				content = "OK"
			}
			parts = append(parts, genai.Part{
				FunctionResponse: &genai.FunctionResponse{
					Name:     toolCalls[i].Name,
					ID:       toolCalls[i].ID,
					Response: map[string]any{"output": content},
				},
			})
		}

		if hasNonExcluded {
			nextParts = parts
			return true, ""
		}

		// Excluded-tool path: save responses to conversation history so future turns
		// see them, then send a final acknowledgement stream to keep Gemini consistent.
		for _, part := range parts {
			if part.FunctionResponse != nil {
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

		extraText := ""
		tokenID := 0
		extraUsage := types.TokenUsage{}
		sawExtraUsage := false
		for chunk, err := range chat.SendMessageStream(ctx, parts...) {
			if err != nil {
				providers.Log(p, providers.LogLevelError, "Error", "Error sending final message for excluded tools: %v", err)
				providers.StreamError(onChunk, err.Error())
				return false, extraText
			}
			if chunk.UsageMetadata != nil {
				extraUsage = usageFromGenerateContentResponse(chunk)
				sawExtraUsage = extraUsage.HasTokens()
			}
			if t := chunk.Text(); t != "" {
				providers.Log(p, providers.LogLevelDebug, "Content", "Content: %s", t)
				providers.SendStreamEvent(onChunk, providers.LLM_TOKEN_EVENT, types.StreamTokenData{ID: tokenID, Token: t})
				extraText += t
				tokenID++
			}
		}
		if sawExtraUsage {
			usage.Add(extraUsage)
		}
		return false, extraText
	}

	responseContent, actions, referencedDocs, aborted := providers.RunChatLoop(p, ctx, kialiInterface, onChunk, streamTurn, prepareNextTurn)
	if aborted {
		return types.TokenUsage{}
	}

	if responseContent != "" {
		ptr.Mu.Lock()
		ptr.Conversation = append(ptr.Conversation, types.ConversationMessage{
			Content: responseContent, Name: "", Param: nil, Role: "assistant",
		})
		ptr.Mu.Unlock()
	}

	providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req)
	providers.Log(p, providers.LogLevelDebug, "Response", "Response for conversation ID: %s", req.ConversationID)
	providers.SendStreamEvent(onChunk, providers.LLM_END_EVENT, types.StreamEndData{
		Actions:             actions,
		ReferencedDocuments: referencedDocs,
		Truncated:           false,
	})
	return usage
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
		// Gemini may return empty or duplicate IDs for parallel calls of the same
		// tool name.  When that happens every call would map to the same key in the
		// Redux `tools` map, causing later results to overwrite earlier ones in the
		// UI.  We guarantee uniqueness by falling back to a deterministic synthetic ID.
		id := tool.ID
		if id == "" {
			id = fmt.Sprintf("google-fc-%d-%s", i, tool.Name)
		}
		tools[i] = types.StreamToolCallData{
			Args: tool.Args,
			Name: tool.Name,
			ID:   id,
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
	filtered := providers.FilteredDefaultTools(p.conf, p.providerName)
	tools := make([]*genai.FunctionDeclaration, 0, len(filtered))
	for _, tool := range filtered {
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

func (p *GoogleAIProvider) LookupToolHandler(toolName string) (mcp.ToolDef, bool) {
	return providers.LookupFilteredDefaultTool(p.conf, p.providerName, toolName)
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
