package anthropic_provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

func (p *AnthropicProvider) SendChat(kialiInterface *mcputil.KialiInterface, req types.AIRequest, aiStore types.AIStore) (*types.AIResponse, int) {
	if req.ConversationID == "" {
		return &types.AIResponse{Error: "conversation ID is required"}, http.StatusBadRequest
	}

	if req.Query == "" {
		return &types.AIResponse{Error: "query is required"}, http.StatusBadRequest
	}

	ctx := kialiInterface.Request.Context()
	ptr, sessionID := providers.GetStoreConversation(kialiInterface.Request, &req, aiStore, p.InitializeConversation)

	conversationWithContext := providers.AddContextToConversation(ptr.Conversation, req)
	modelConversation := p.ConversationToProvider(conversationWithContext).(anthropicConversation)
	toolDefs := p.GetToolDefinitions().([]anthropic.ToolUnionParam)
	response := &types.AIResponse{}

	log.Debugf("[Chat AI] Conversation sent to Anthropic (system=%d, messages=%d):", len(modelConversation.System), len(modelConversation.Messages))
	for i, msg := range modelConversation.System {
		contentPreview := msg.Text
		if len(contentPreview) > 100 {
			contentPreview = contentPreview[:100] + "..."
		}
		log.Debugf("  [system %d] content=%q", i, contentPreview)
	}
	for i, msg := range modelConversation.Messages {
		contentPreview := anthropicMessagePreview(msg)
		if len(contentPreview) > 100 {
			contentPreview = contentPreview[:100] + "..."
		}
		log.Debugf("  [%d] role=%s content=%q", i, msg.Role, contentPreview)
	}

	const maxToolIterations = 5
	for iter := 0; iter < maxToolIterations; iter++ {
		resp, err := p.client.Messages.New(ctx, anthropic.MessageNewParams{
			MaxTokens: defaultMaxTokens,
			Messages:  modelConversation.Messages,
			Model:     anthropic.Model(p.model),
			System:    modelConversation.System,
			Tools:     toolDefs,
		})
		if err != nil {
			if err := ctx.Err(); err != nil {
				return providers.NewContextCanceledResponse(err)
			}
			log.Debugf("[Chat AI] Anthropic provider error in send chat with tools: %v", err)
			return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}
		if len(resp.Content) == 0 {
			return &types.AIResponse{Error: "anthropic returned no content"}, http.StatusInternalServerError
		}

		if resp.StopReason == anthropic.StopReasonPauseTurn {
			if iter == maxToolIterations-1 {
				log.Debugf("[Chat AI] Anthropic provider reached max tool iterations (%d) for conversation ID: %s", maxToolIterations, req.ConversationID)
				return &types.AIResponse{Error: fmt.Sprintf("anthropic reached max tool iterations (%d)", maxToolIterations)}, http.StatusInternalServerError
			}
			modelConversation.Messages = append(modelConversation.Messages, resp.ToParam())
			continue
		}

		if !anthropicHasToolUse(resp.Content) {
			response.Answer = providers.ParseMarkdownResponse(anthropicTextContent(resp.Content))
			break
		}
		if iter == maxToolIterations-1 {
			log.Debugf("[Chat AI] Anthropic provider reached max tool iterations (%d) for conversation ID: %s", maxToolIterations, req.ConversationID)
			return &types.AIResponse{Error: fmt.Sprintf("anthropic reached max tool iterations (%d)", maxToolIterations)}, http.StatusInternalServerError
		}

		modelConversation.Messages = append(modelConversation.Messages, resp.ToParam())

		tools, toolNames, err := p.TransformToolCallToToolsProcessor(resp.Content)
		if err != nil {
			return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		log.Debugf("[Chat AI] Anthropic provider tool calls (iter=%d): %v", iter, toolNames)

		toolResults := providers.ExecuteToolCallsInParallel(kialiInterface, tools)
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		processResult := providers.ProcessToolResults(toolResults, ptr.Conversation)
		if processResult.Response.Error != "" {
			return processResult.Response, http.StatusInternalServerError
		}
		if len(processResult.Response.Actions) > 0 {
			response.Actions = append(response.Actions, processResult.Response.Actions...)
		}
		if len(processResult.Response.ReferencedDocs) > 0 {
			response.ReferencedDocs = append(response.ReferencedDocs, processResult.Response.ReferencedDocs...)
		}

		toolResultBlocks := make([]anthropic.ContentBlockParamUnion, 0, len(toolResults))
		for i, toolResult := range toolResults {
			if toolResult.Error != nil {
				return &types.AIResponse{Error: toolResult.Error.Error()}, http.StatusInternalServerError
			}

			content := toolResult.Message.Content
			if strings.TrimSpace(content) == "" {
				content = "OK"
			}

			toolResultBlocks = append(toolResultBlocks, anthropic.ContentBlockParamUnion{
				OfToolResult: &anthropic.ToolResultBlockParam{
					ToolUseID: tools[i].ToolCallID,
					Content: []anthropic.ToolResultBlockParamContentUnion{{
						OfText: &anthropic.TextBlockParam{Text: content},
					}},
				},
			})
		}

		if len(toolResultBlocks) > 0 {
			modelConversation.Messages = append(modelConversation.Messages, anthropic.NewUserMessage(toolResultBlocks...))
		}
	}

	if response.Answer != "" {
		ptr.Mu.Lock()
		ptr.Conversation = append(ptr.Conversation, types.ConversationMessage{
			Content: response.Answer,
			Name:    "",
			Param:   nil,
			Role:    "assistant",
		})
		ptr.Mu.Unlock()
	}

	providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req)
	log.Debugf("[Chat AI] Response for conversation ID: %s: %+v", req.ConversationID, response)

	return response, http.StatusOK
}

func (p *AnthropicProvider) TransformToolCallToToolsProcessor(toolCall any) ([]mcp.ToolsProcessor, []string, error) {
	contentBlocks, ok := toolCall.([]anthropic.ContentBlockUnion)
	if !ok {
		return []mcp.ToolsProcessor{}, []string{}, nil
	}

	toolNames := make([]string, 0)
	tools := make([]mcp.ToolsProcessor, 0)
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
		tools = append(tools, mcp.ToolsProcessor{
			Args:       args,
			Name:       toolUse.Name,
			ToolCallID: toolUse.ID,
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
