package openai_provider

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	openai "github.com/openai/openai-go/v3"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/log"
)

func (p *OpenAIProvider) GetName() string {
	return "OpenAI"
}

func (p *OpenAIProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) types.TokenUsage {
	if req.Query == "" {
		providers.StreamError(onChunk, "query is required")
		return types.TokenUsage{}
	}

	ctx := kialiInterface.Request.Context()
	ptr, sessionID := providers.GetStoreConversation(kialiInterface.Request, &req, aiStore, p.InitializeConversation)
	providers.SendStreamEvent(onChunk, providers.LLM_START_EVENT, types.StreamStartData{ConversationID: req.ConversationID})
	providers.Log(p, providers.LogLevelDebug, "Conversation", "OpenAI provider conversation ID: %s with model: %s and session ID: %s", req.ConversationID, p.model, sessionID)

	for i, msg := range ptr.Conversation {
		contentPreview := msg.Content
		if len(contentPreview) > 100 {
			contentPreview = contentPreview[:100] + "..."
		}
		providers.Log(p, providers.LogLevelDebug, "Conversation", " Message =>[%d] [Role %s] Content=%q", i, msg.Role, contentPreview)
	}

	// We keep OpenAI-native messages for the iterative tool loop.
	// The persisted conversation will include only the user prompts and final assistant answer.
	usage := types.TokenUsage{}
	params := openai.ChatCompletionNewParams{
		Model:    p.model,
		Messages: p.ConversationToProvider(ptr.Conversation).([]openai.ChatCompletionMessageParamUnion),
		Tools:    p.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam),
		// Disable parallel tool calls: when the model issues multiple calls in a
		// single turn the openai-go streaming accumulator concatenates their names
		// and arguments at index 0, producing invalid JSON that fails to parse.
		ParallelToolCalls: openai.Bool(false),
		StreamOptions:     openai.ChatCompletionStreamOptionsParam{IncludeUsage: openai.Bool(true)},
	}

	// streamTurn executes one OpenAI streaming request.
	// Uses a manual ID-keyed accumulator to handle providers that return parallel
	// tool calls at the same stream Index (which the SDK accumulator merges incorrectly).
	streamTurn := func(ctx context.Context, onChunk func(string)) (string, []types.StreamToolCallData, error) {
		stream := p.client.Chat.Completions.NewStreaming(ctx, params)

		type rawToolCall struct{ id, name, arguments string }
		var rawCallsOrdered []*rawToolCall
		callsByID := map[string]*rawToolCall{}
		indexToID := map[int64]string{}
		text := ""
		tokenID := 0
		turnUsage := types.TokenUsage{}
		sawTurnUsage := false

		for stream.Next() {
			chunk := stream.Current()
			if chunk.Usage.TotalTokens > 0 || chunk.Usage.PromptTokens > 0 || chunk.Usage.CompletionTokens > 0 {
				turnUsage = types.NewTokenUsage(chunk.Usage.PromptTokens, chunk.Usage.CompletionTokens, chunk.Usage.TotalTokens)
				sawTurnUsage = turnUsage.HasTokens()
			}
			if len(chunk.Choices) == 0 {
				continue
			}
			delta := chunk.Choices[0].Delta
			if delta.Content != "" {
				providers.SendStreamEvent(onChunk, providers.LLM_TOKEN_EVENT, types.StreamTokenData{ID: tokenID, Token: delta.Content})
				text += delta.Content
				tokenID++
			}
			for _, tc := range delta.ToolCalls {
				if tc.ID != "" {
					rc := &rawToolCall{id: tc.ID}
					rawCallsOrdered = append(rawCallsOrdered, rc)
					callsByID[tc.ID] = rc
					indexToID[tc.Index] = tc.ID
				}
				if id, ok := indexToID[tc.Index]; ok {
					if rc, exists := callsByID[id]; exists {
						rc.name += tc.Function.Name
						rc.arguments += tc.Function.Arguments
					}
				}
			}
		}
		if err := stream.Err(); err != nil {
			// Benign SDK-internal context cleanup — treat as successful completion.
			if ctx.Err() == nil && (errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)) {
				providers.Log(p, providers.LogLevelDebug, "Content", "OpenAI stream completed with internal SDK context cleanup — not an error")
			} else {
				return text, nil, enrichAPIError(err)
			}
		}
		if text != "" {
			textPreview := text
			if len(textPreview) > 400 {
				textPreview = textPreview[:400] + "..."
			}
			providers.Log(p, providers.LogLevelDebug, "Content", "Response content (%d chars): %s", len(text), textPreview)
		}
		if sawTurnUsage {
			usage.Add(turnUsage)
		}

		// Build sorted tool-call slice and append the assistant message to params.
		var rawCalls []openai.ChatCompletionMessageToolCallUnion
		for _, rc := range rawCallsOrdered {
			rawCalls = append(rawCalls, openai.ChatCompletionMessageToolCallUnion{
				ID: rc.id, Type: "function",
				Function: openai.ChatCompletionMessageFunctionToolCallFunction{Name: rc.name, Arguments: rc.arguments},
			})
		}
		if len(rawCalls) > 0 {
			rawNames := make([]string, len(rawCalls))
			for i, tc := range rawCalls {
				rawNames[i] = fmt.Sprintf("%s(args=%d bytes)", tc.Function.Name, len(tc.Function.Arguments))
			}
			providers.Log(p, providers.LogLevelDebug, "ToolCalls", "Raw tool calls from model (count=%d): [%s]", len(rawCalls), strings.Join(rawNames, " | "))

			assistant := openai.ChatCompletionAssistantMessageParam{
				ToolCalls: make([]openai.ChatCompletionMessageToolCallUnionParam, 0, len(rawCalls)),
			}
			for _, tc := range rawCalls {
				args := tc.Function.Arguments
				if args == "" {
					args = "{}"
				}
				assistant.ToolCalls = append(assistant.ToolCalls, openai.ChatCompletionMessageToolCallUnionParam{
					OfFunction: &openai.ChatCompletionMessageFunctionToolCallParam{
						ID: tc.ID,
						Function: openai.ChatCompletionMessageFunctionToolCallFunctionParam{
							Name: tc.Function.Name, Arguments: args,
						},
					},
				})
			}
			params.Messages = append(params.Messages, openai.ChatCompletionMessageParamUnion{OfAssistant: &assistant})
		}

		toolCalls, _, err := p.TransformToolCallToToolsProcessor(rawCalls)
		if err != nil {
			providers.Log(p, providers.LogLevelError, "ToolCalls", "Failed to parse tool call arguments: %v", err)
			return text, nil, err
		}
		return text, toolCalls, nil
	}

	// prepareNextTurn appends successful tool results to params for the next iteration.
	prepareNextTurn := func(_ context.Context, _ []types.StreamToolCallData, toolResults []types.StreamToolResultData, hasNonExcluded bool, _ func(string)) (bool, string) {
		if !hasNonExcluded {
			return false, ""
		}
		// Even excluded tools must produce a tool response for OpenAI; otherwise the
		// next model call fails with "missing tool responses".
		for _, tr := range toolResults {
			if strings.TrimSpace(tr.Content) != "" {
				providers.Log(p, providers.LogLevelDebug, "ToolResult", "Tool result added (ID:%s)", tr.ID)
				params.Messages = append(params.Messages, openai.ToolMessage(tr.Content, tr.ID))
			}
		}
		return true, ""
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

func (p *OpenAIProvider) InitializeConversation(ptr *types.Conversation, req types.AIRequest) {
	if ptr == nil {
		return
	}
	systemInstruction := types.GetSystemInstruction(req.InteractionMode)
	if len(ptr.Conversation) == 0 {
		ptr.Conversation = []types.ConversationMessage{{
			Content: systemInstruction,
			Name:    "",
			Param:   openai.SystemMessage(systemInstruction).GetContent().AsAny(),
			Role:    "system",
		}}
	} else if ptr.Conversation[0].Role == "system" {
		// Keep system message in sync with the current interaction mode so that
		// mid-conversation mode switches take effect without losing history.
		ptr.Conversation[0].Content = systemInstruction
		ptr.Conversation[0].Param = openai.SystemMessage(systemInstruction).GetContent().AsAny()
	}
	ptr.Conversation = append(ptr.Conversation, types.ConversationMessage{
		Content: req.Query,
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

// enrichAPIError extracts a human-readable reason from an *openai.Error so
// the user sees the actual API message rather than the opaque HTTP status line.
//
// Resolution order:
//  1. aerr.Message — structured field parsed by the SDK from "error.message".
//  2. aerr.Response.Body — the SDK repopulates the response body with the raw
//     bytes after reading it, so we can read it here as a fallback when the
//     SDK could not parse the structured Message field (e.g. when the provider
//     uses a non-OpenAI error envelope).
//  3. The original err — unchanged fallback.
func enrichAPIError(err error) error {
	var aerr *openai.Error
	if !errors.As(err, &aerr) {
		return err
	}
	if aerr.Message != "" {
		return fmt.Errorf("API error %d (%s): %s", aerr.StatusCode, http.StatusText(aerr.StatusCode), aerr.Message)
	}
	if aerr.Response != nil && aerr.Response.Body != nil {
		body, readErr := io.ReadAll(aerr.Response.Body)
		if readErr == nil && len(body) > 0 {
			return fmt.Errorf("API error %d (%s): %s", aerr.StatusCode, http.StatusText(aerr.StatusCode), strings.TrimSpace(string(body)))
		}
	}
	return err
}
