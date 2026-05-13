package anthropic_provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

func (p *AnthropicProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) {
	if req.Query == "" {
		providers.StreamError(onChunk, "query is required")
		return
	}

	ctx := kialiInterface.Request.Context()
	ptr, sessionID := providers.GetStoreConversation(kialiInterface.Request, &req, aiStore, p.InitializeConversation)
	providers.SendStreamEvent(onChunk, "start", types.StreamStartData{ConversationID: req.ConversationID})
	providers.Log(p, providers.LogLevelDebug, "Conversation", "Anthropic provider conversation ID: %s with model: %s and session ID: %s", req.ConversationID, p.model, sessionID)

	conversationWithContext := providers.AddContextToConversation(ptr.Conversation, req)
	modelConversation := p.ConversationToProvider(conversationWithContext).(anthropicConversation)
	toolDefs := p.GetToolDefinitions().([]anthropic.ToolUnionParam)

	responseContent := ""
	endStream := &types.StreamEndData{}
	actions := []get_action_ui.Action{}
	referencedDocs := []types.ReferencedDoc{}

	providers.Log(p, providers.LogLevelDebug, "Conversation", "Conversation sent to Anthropic (system=%d, messages=%d):", len(modelConversation.System), len(modelConversation.Messages))
	for i, msg := range modelConversation.System {
		contentPreview := msg.Text
		if len(contentPreview) > 100 {
			contentPreview = contentPreview[:100] + "..."
		}
		providers.Log(p, providers.LogLevelDebug, "Conversation", "  [system %d] content=%q", i, contentPreview)
	}
	for i, msg := range modelConversation.Messages {
		contentPreview := anthropicMessagePreview(msg)
		if len(contentPreview) > 100 {
			contentPreview = contentPreview[:100] + "..."
		}
		providers.Log(p, providers.LogLevelDebug, "Conversation", "  [%d] role=%s content=%q", i, msg.Role, contentPreview)
	}

	params := anthropic.MessageNewParams{
		MaxTokens: defaultMaxTokens,
		Messages:  modelConversation.Messages,
		Model:     anthropic.Model(p.model),
		System:    modelConversation.System,
		Tools:     toolDefs,
	}
	const maxToolIterations = 5
	for iter := 0; iter < maxToolIterations; iter++ {
		stream := p.client.Messages.NewStreaming(ctx, params)

		message := anthropic.Message{}
		tokenID := 0
		for stream.Next() {
			event := stream.Current()
			err := message.Accumulate(event)
			if err != nil {
				providers.Log(p, providers.LogLevelError, "Error", "Error in accumulate message: %v", err)
				providers.StreamError(onChunk, err.Error())
				return
			}
			switch eventVariant := event.AsAny().(type) {
			case anthropic.ContentBlockStartEvent:
				if event.ContentBlock.Name != "" {
					providers.Log(p, providers.LogLevelDebug, "Stream", "Block Start : %s", event.ContentBlock.Name)
				}
			case anthropic.ContentBlockStopEvent:
				providers.Log(p, providers.LogLevelDebug, "Stream", "Block Stop")
			case anthropic.MessageStopEvent:
				providers.Log(p, providers.LogLevelDebug, "Stream", "Message Stop")
			case anthropic.ContentBlockDeltaEvent:
				switch deltaVariant := eventVariant.Delta.AsAny().(type) {
				case anthropic.TextDelta:
					chunContent := deltaVariant.Text
					providers.Log(p, providers.LogLevelDebug, "Content", "Content: %s", chunContent)
					providers.SendStreamEvent(onChunk, "token", types.StreamTokenData{
						ID:    tokenID,
						Token: chunContent,
					})
					responseContent += chunContent
					tokenID++
				}
			}
		}

		params.Messages = append(params.Messages, message.ToParam())

		if stream.Err() != nil {
			providers.Log(p, providers.LogLevelError, "Error", "Error in stream: %v", stream.Err())
			providers.StreamError(onChunk, stream.Err().Error())
			return
		}

		if err := ctx.Err(); err != nil {
			providers.NewContextCanceledResponse(onChunk, err)
			return
		}

		if message.StopReason == anthropic.StopReasonPauseTurn {
			continue
		}

		if !anthropicHasToolUse(message.Content) {
			// There is not tooluse in the message, so we are done
			responseContent = providers.ParseMarkdownResponse(anthropicTextContent(message.Content))
			break
		}

		if iter == maxToolIterations-1 {
			providers.Log(p, providers.LogLevelError, "Error", "Anthropic reached max tool iterations (%d) for conversation ID: %s", maxToolIterations, req.ConversationID)
			providers.StreamError(onChunk, fmt.Sprintf("anthropic reached max tool iterations (%d)", maxToolIterations))
			return
		}

		tools, toolNames, err := p.TransformToolCallToToolsProcessor(message.Content)
		if err != nil {
			providers.Log(p, providers.LogLevelError, "Error", "Error transforming tool calls: %v", err)
			providers.StreamError(onChunk, err.Error())
			return
		}
		providers.Log(p, providers.LogLevelDebug, "ToolCalls", "Anthropic provider tool calls (iter=%d): %v", iter, toolNames)

		toolResults, acts, docs := providers.ExecuteToolCallsInParallel(p, onChunk, kialiInterface, tools)
		actions = append(actions, acts...)
		referencedDocs = append(referencedDocs, docs...)
		if err := ctx.Err(); err != nil {
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
		if !hasNotExcludedTool {
			break // no not excluded tool calls found, we are done
		}

		toolResultBlocks := make([]anthropic.ContentBlockParamUnion, 0, len(toolResults))
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

			toolResultBlocks = append(toolResultBlocks, anthropic.ContentBlockParamUnion{
				OfToolResult: &anthropic.ToolResultBlockParam{
					ToolUseID: tools[i].ID,
					Content: []anthropic.ToolResultBlockParamContentUnion{{
						OfText: &anthropic.TextBlockParam{Text: content},
					}},
				},
			})
		}

		if len(toolResultBlocks) > 0 {
			params.Messages = append(params.Messages, anthropic.NewUserMessage(toolResultBlocks...))
		}
	}

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
	providers.SendStreamEvent(onChunk, "end", *endStream)
}

func (p *AnthropicProvider) TransformToolCallToToolsProcessor(toolCall any) ([]types.StreamToolCallData, []string, error) {
	contentBlocks, ok := toolCall.([]anthropic.ContentBlockUnion)
	if !ok {
		return []types.StreamToolCallData{}, []string{}, nil
	}

	toolNames := make([]string, 0)
	tools := make([]types.StreamToolCallData, 0)
	for _, block := range contentBlocks {
		toolUse, ok := block.AsAny().(anthropic.ToolUseBlock)
		if !ok {
			continue
		}

		toolNames = append(toolNames, toolUse.Name)
		args := map[string]any{}
		if err := json.Unmarshal(toolUse.Input, &args); err != nil {
			return nil, nil, fmt.Errorf("invalid arguments for tool %q: %w", toolUse.Name, err)
		}
		tools = append(tools, types.StreamToolCallData{
			Args: args,
			Name: toolUse.Name,
			ID:   toolUse.ID,
			Type: "tool_call",
		})
	}

	return tools, toolNames, nil
}

func (p *AnthropicProvider) InitializeConversation(ptr *types.Conversation, query string) {
	if ptr == nil {
		return
	}
	isNewConversation := len(ptr.Conversation) == 0

	if isNewConversation {
		ptr.Conversation = []types.ConversationMessage{{
			Content: types.SystemInstruction,
			Name:    "",
			Param:   nil,
			Role:    "system",
		}}
	}

	ptr.Conversation = append(ptr.Conversation, types.ConversationMessage{
		Content: query,
		Name:    "",
		Param:   nil,
		Role:    "user",
	})
}

func (p *AnthropicProvider) ConversationToProvider(conversation []types.ConversationMessage) interface{} {
	result := anthropicConversation{
		Messages: make([]anthropic.MessageParam, 0, len(conversation)),
		System:   make([]anthropic.TextBlockParam, 0, 2),
	}

	for _, msg := range conversation {
		switch msg.Role {
		case "system":
			result.System = append(result.System, anthropic.TextBlockParam{Text: msg.Content})
		case "user":
			result.Messages = append(result.Messages, anthropic.NewUserMessage(anthropic.NewTextBlock(msg.Content)))
		case "tool":
			result.Messages = append(result.Messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content)))
		default:
			result.Messages = append(result.Messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content)))
		}
	}

	return result
}

func (p *AnthropicProvider) ProviderToConversation(providerMessage interface{}) types.ConversationMessage {
	switch msg := providerMessage.(type) {
	case anthropic.Message:
		return types.ConversationMessage{
			Content: anthropicTextContent(msg.Content),
			Name:    msg.ID,
			Param:   msg.ToParam(),
			Role:    "assistant",
		}
	case *anthropic.Message:
		if msg == nil {
			return types.ConversationMessage{}
		}
		return types.ConversationMessage{
			Content: anthropicTextContent(msg.Content),
			Name:    msg.ID,
			Param:   msg.ToParam(),
			Role:    "assistant",
		}
	default:
		return types.ConversationMessage{}
	}
}

func (p *AnthropicProvider) ReduceConversation(ctx context.Context, ptr *types.Conversation, reduceThreshold int) {
	if len(ptr.Conversation) < reduceThreshold {
		return
	}

	anchorIndex := 0
	for i, msg := range ptr.Conversation {
		if i < 2 && msg.Role == "system" {
			anchorIndex = i
		} else {
			break
		}
	}

	keepCount := 4
	if len(ptr.Conversation)-anchorIndex <= keepCount {
		return
	}

	splitPoint := len(ptr.Conversation) - keepCount
	instructions := ptr.Conversation[:anchorIndex+1]
	toSummarize := ptr.Conversation[anchorIndex+1 : splitPoint]
	recentMessages := ptr.Conversation[splitPoint:]

	resp, err := p.client.Messages.New(ctx, anthropic.MessageNewParams{
		MaxTokens: reduceConversationMaxTokens,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf("Summarize the following chat history: %+v", toSummarize))),
		},
		Model: anthropic.Model(p.model),
		System: []anthropic.TextBlockParam{{
			Text: "You are a technical assistant for Kiali (Istio Service Mesh). Summarize the preceding troubleshooting steps, tool outputs, and user intents into a concise technical summary. Preserve key findings like pod names, error codes, or metrics.",
		}},
	})
	if err != nil {
		log.Warningf("[Chat AI] Failed to reduce conversation: %v", err)
		return
	}

	summary := anthropicTextContent(resp.Content)
	if summary == "" {
		return
	}

	reduced := append([]types.ConversationMessage{}, instructions...)
	reduced = append(reduced, types.ConversationMessage{
		Content: fmt.Sprintf("Summary of previous interactions: %s", summary),
		Name:    "",
		Param:   nil,
		Role:    "system",
	})
	reduced = append(reduced, recentMessages...)
	ptr.Mu.Lock()
	ptr.Conversation = reduced
	ptr.Mu.Unlock()
}

func anthropicHasToolUse(content []anthropic.ContentBlockUnion) bool {
	for _, block := range content {
		if _, ok := block.AsAny().(anthropic.ToolUseBlock); ok {
			return true
		}
	}
	return false
}

func anthropicTextContent(content []anthropic.ContentBlockUnion) string {
	textParts := make([]string, 0, len(content))
	for _, block := range content {
		if textBlock, ok := block.AsAny().(anthropic.TextBlock); ok && textBlock.Text != "" {
			textParts = append(textParts, textBlock.Text)
		}
	}
	return strings.Join(textParts, "\n")
}

func anthropicMessagePreview(msg anthropic.MessageParam) string {
	textParts := make([]string, 0, len(msg.Content))
	for _, block := range msg.Content {
		switch {
		case block.OfText != nil && block.OfText.Text != "":
			textParts = append(textParts, block.OfText.Text)
		case block.OfToolResult != nil:
			textParts = append(textParts, "[tool_result]")
		case block.OfToolUse != nil:
			textParts = append(textParts, "[tool_use]")
		default:
			textParts = append(textParts, "[non-text block]")
		}
	}
	return strings.Join(textParts, "\n")
}
