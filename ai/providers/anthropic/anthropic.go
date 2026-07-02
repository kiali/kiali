package anthropic_provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

func usageFromAnthropicMessage(resp *anthropic.Message) types.TokenUsage {
	if resp == nil {
		return types.TokenUsage{}
	}
	return types.NewTokenUsage(resp.Usage.InputTokens, resp.Usage.OutputTokens, 0)
}

func (p *AnthropicProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) types.TokenUsage {
	if req.Query == "" {
		providers.StreamError(onChunk, "query is required")
		return types.TokenUsage{}
	}

	ctx := kialiInterface.Request.Context()
	ptr, sessionID := providers.GetStoreConversation(kialiInterface.Request, &req, aiStore, p.InitializeConversation)
	providers.SendStreamEvent(onChunk, providers.LLM_START_EVENT, types.StreamStartData{ConversationID: req.ConversationID})
	providers.Log(p, providers.LogLevelDebug, "Conversation", "Anthropic provider conversation ID: %s with model: %s and session ID: %s", req.ConversationID, p.model, sessionID)
	usage := types.TokenUsage{}

	modelConversation := p.ConversationToProvider(ptr.Conversation).(anthropicConversation)
	providers.Log(p, providers.LogLevelDebug, "Conversation", "Conversation sent to Anthropic (system=%d, messages=%d):", len(modelConversation.System), len(modelConversation.Messages))
	for i, msg := range modelConversation.System {
		preview := msg.Text
		if len(preview) > 100 {
			preview = preview[:100] + "..."
		}
		providers.Log(p, providers.LogLevelDebug, "Conversation", "  [system %d] content=%q", i, preview)
	}
	for i, msg := range modelConversation.Messages {
		preview := anthropicMessagePreview(msg)
		if len(preview) > 100 {
			preview = preview[:100] + "..."
		}
		providers.Log(p, providers.LogLevelDebug, "Conversation", " Message =>[%d] [Role %s]  content=%q", i, msg.Role, preview)
	}

	params := anthropic.MessageNewParams{
		MaxTokens: defaultMaxTokens,
		Messages:  modelConversation.Messages,
		Model:     anthropic.Model(p.model),
		System:    modelConversation.System,
		Tools:     p.GetToolDefinitions().([]anthropic.ToolUnionParam),
	}

	// streamTurn executes one Anthropic streaming request.
	// An inner loop handles StopReasonPauseTurn transparently: the model is asked
	// to continue, and streaming resumes until a final stop reason is received.
	// ParseMarkdownResponse is NOT applied here — the shared RunChatLoop does it.
	streamTurn := func(ctx context.Context, onChunk func(string)) (string, []types.StreamToolCallData, error) {
		tokenID := 0
		for {
			stream := p.client.Messages.NewStreaming(ctx, params)
			message := anthropic.Message{}

			for stream.Next() {
				event := stream.Current()
				if err := message.Accumulate(event); err != nil {
					providers.Log(p, providers.LogLevelError, "Error", "Error in accumulate message: %v", err)
					return "", nil, err
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
					if delta, ok := eventVariant.Delta.AsAny().(anthropic.TextDelta); ok {
						providers.Log(p, providers.LogLevelDebug, "Content", "Content: %s", delta.Text)
						providers.SendStreamEvent(onChunk, providers.LLM_TOKEN_EVENT, types.StreamTokenData{ID: tokenID, Token: delta.Text})
						tokenID++
					}
				}
			}

			usage.Add(usageFromAnthropicMessage(&message))
			params.Messages = append(params.Messages, message.ToParam())

			if stream.Err() != nil {
				if ctx.Err() == nil && (errors.Is(stream.Err(), context.Canceled) || errors.Is(stream.Err(), context.DeadlineExceeded)) {
					providers.Log(p, providers.LogLevelDebug, "Content", "Anthropic stream completed with internal SDK context cleanup — not an error")
				} else {
					return "", nil, stream.Err()
				}
			}
			if ctx.Err() != nil {
				return "", nil, nil // outer loop detects ctx.Err()
			}

			if message.StopReason == anthropic.StopReasonPauseTurn {
				continue // model paused — ask it to continue in next inner iteration
			}

			text := anthropicTextContent(message.Content)
			if !anthropicHasToolUse(message.Content) {
				return text, nil, nil // no tool calls → shared loop applies ParseMarkdownResponse
			}
			toolCalls, _, err := p.TransformToolCallToToolsProcessor(message.Content)
			if err != nil {
				providers.Log(p, providers.LogLevelError, "Error", "Error transforming tool calls: %v", err)
				return text, nil, err
			}
			return text, toolCalls, nil
		}
	}

	// prepareNextTurn appends tool result blocks to params for the next iteration.
	prepareNextTurn := func(_ context.Context, toolCalls []types.StreamToolCallData, toolResults []types.StreamToolResultData, hasNonExcluded bool, _ func(string)) (bool, string) {
		if !hasNonExcluded {
			return false, ""
		}
		toolResultBlocks := make([]anthropic.ContentBlockParamUnion, 0, len(toolResults))
		for i, tr := range toolResults {
			content := tr.Content
			if strings.TrimSpace(content) == "" {
				content = "OK"
			}
			toolResultBlocks = append(toolResultBlocks, anthropic.ContentBlockParamUnion{
				OfToolResult: &anthropic.ToolResultBlockParam{
					ToolUseID: toolCalls[i].ID,
					Content:   []anthropic.ToolResultBlockParamContentUnion{{OfText: &anthropic.TextBlockParam{Text: content}}},
				},
			})
		}
		if len(toolResultBlocks) > 0 {
			params.Messages = append(params.Messages, anthropic.NewUserMessage(toolResultBlocks...))
		}
		return true, ""
	}

	responseContent, actions, referencedDocs, aborted := providers.RunChatLoop(p, ctx, kialiInterface, onChunk, streamTurn, prepareNextTurn, p.conf.ChatAI.MaxToolIterations)
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

func (p *AnthropicProvider) InitializeConversation(ptr *types.Conversation, req types.AIRequest) {
	if ptr == nil {
		return
	}
	systemInstruction := types.GetSystemInstruction(req.InteractionMode)
	if len(ptr.Conversation) == 0 {
		ptr.Conversation = []types.ConversationMessage{{
			Content: systemInstruction,
			Name:    "",
			Param:   nil,
			Role:    "system",
		}}
	} else if ptr.Conversation[0].Role == "system" {
		// Keep system message in sync with the current interaction mode so that
		// mid-conversation mode switches take effect without losing history.
		ptr.Conversation[0].Content = systemInstruction
	}

	ptr.Conversation = append(ptr.Conversation, types.ConversationMessage{
		Content: req.Query,
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
