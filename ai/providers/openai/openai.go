package openai_provider

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	openai "github.com/openai/openai-go/v3"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
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

func (p *OpenAIProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache, aiStore types.AIStore, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) {

	if req.Query == "" {
		providers.StreamError(onChunk, "query is required")
		return
	}
	ctx := r.Context()
	ptr, sessionID := providers.GetStoreConversation(r, &req, aiStore)
	if req.ConversationID == "" {
		providers.Log(p, providers.LogLevelDebug, "Conversation", "Create")
		req.ConversationID = aiStore.GenerateConversationID()
	}
	conversation := &ptr.Conversation
	p.InitializeConversation(conversation, req)

	providers.SendStreamEvent(onChunk, "start", types.StreamStartData{
		ConversationID: req.ConversationID,
	})
	// Create a temporary conversation with context for the API call
	// The context is NOT saved to the persistent conversation to avoid contaminating future interactions
	conversationWithContext := providers.AddContextToConversation(*conversation, req)
	for i, msg := range conversationWithContext {
		contentPreview := msg.Content
		if len(contentPreview) > 100 {
			contentPreview = contentPreview[:100] + "..."
		}
		providers.Log(p, providers.LogLevelDebug, "Conversation", "Message[%d] role=%s content=%q", i, msg.Role, contentPreview)
	}

	// We keep OpenAI-native messages for the iterative tool loop.

	toolDefs := p.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam)
	response := ""
	endStream := &types.StreamEndData{}
	actions := []get_action_ui.Action{}
	referencedDocuments := []types.ReferencedDocument{}
	// The persisted conversation will include only the user prompts and final assistant answer.
	params := openai.ChatCompletionNewParams{
		Model:    p.model,
		Messages: p.ConversationToProvider(conversationWithContext).([]openai.ChatCompletionMessageParamUnion),
		Tools:    toolDefs,
		StreamOptions: openai.ChatCompletionStreamOptionsParam{
			IncludeUsage: openai.Bool(true),
		},
	}

	const maxToolIterations = 5

	for iter := 0; iter < maxToolIterations; iter++ {
		// Initial chat completion request with streaming
		stream := p.client.Chat.Completions.NewStreaming(ctx, params)
		// acumulator for the stream
		acc := openai.ChatCompletionAccumulator{}
		tokenID := 0
		// analyze the stream by chunk
		for stream.Next() {
			chunk := stream.Current()
			acc.AddChunk(chunk)
			if chunk.Usage.PromptTokens > 0 {
				endStream.InputTokens += chunk.Usage.PromptTokens
			}
			if chunk.Usage.CompletionTokens > 0 {
				endStream.OutputTokens += chunk.Usage.CompletionTokens
			}
			//  Display the content as it arrives
			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				chunContent := chunk.Choices[0].Delta.Content
				providers.Log(p, providers.LogLevelDebug, "Content", "Content: %s", chunk.Choices[0].Delta.Content)
				providers.SendStreamEvent(onChunk, "token", types.StreamTokenData{
					ID:    tokenID,
					Token: chunContent,
				})
				response += chunContent
				tokenID++
			}
		}

		if err := stream.Err(); err != nil {
			providers.Log(p, providers.LogLevelError, "SendChat", "Error in send chat with tools: %v", err)
			providers.StreamError(onChunk, err.Error())
			return
		}
		// Access the accumulated message and tool calls
		var toolCalls []openai.ChatCompletionMessageToolCallUnion
		if len(acc.Choices) > 0 {
			toolCalls = acc.Choices[0].Message.ToolCalls
			if len(toolCalls) == 0 {
				break // no tool calls found, we are done
			}
			providers.Log(p, providers.LogLevelDebug, "ToolCalls", "Tool calls (iter=%d): %v", iter, toolCalls)
		} else {
			// Not called tool calls, we are done
			break
		}

		// There is function calls

		if err := ctx.Err(); err != nil {
			providers.Log(p, providers.LogLevelError, "Context", "Context error: %v", err)
			providers.StreamError(onChunk, err.Error())
			return
		}

		if iter == maxToolIterations-1 {
			providers.Log(p, providers.LogLevelDebug, "ToolIterations", "Reached max tool iterations (%d) for conversation ID: %s", maxToolIterations, req.ConversationID)
			return
		}

		tools, toolNames := p.TransformToolCallToToolsProcessor(toolCalls)
		providers.Log(p, providers.LogLevelDebug, "ToolCalls", "Tool calls (iter=%d): %v", iter, toolNames)

		toolResults, acts, docs := providers.ExecuteToolCallsInParallel(p, ctx, onChunk, r, tools, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
		providers.Log(p, providers.LogLevelDebug, "ToolResults", "Tool results (iter=%d): %v", iter, toolResults)
		actions = append(actions, acts...)
		referencedDocuments = append(referencedDocuments, docs...)

		if err := ctx.Err(); err != nil {
			providers.StreamError(onChunk, err.Error())
			providers.Log(p, providers.LogLevelError, "Context", "Context error: %v", err)
			return
		}
		// We need to check if there is a tool called not excluded
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
		// Process tool results using standardized logic (accumulate actions/citations).
		processResult := providers.ProcessToolResults(toolResults, *conversation)
		if processResult.Response.Error != "" {
			providers.Log(p, providers.LogLevelError, "ProcessToolResults", "Error in process tool results: %v", processResult.Response.Error)
			providers.StreamError(onChunk, processResult.Response.Error)
			return
		}

		// Append tool outputs to the OpenAI conversation (linked by ID).
		// Note: even "excluded" tools must produce a tool response for OpenAI, otherwise
		// the next model call can fail with "missing tool responses".
		for _, toolResult := range toolResults {
			if toolResult.Status == "error" {
				providers.Log(p, providers.LogLevelError, "ToolResult", "Error in tool result: %v", toolResult.Content)
				return
			}
			content := toolResult.Content
			if strings.TrimSpace(content) != "" {
				providers.Log(p, providers.LogLevelDebug, "ToolResult", "Tool result added to meessageForModel(iter=%d): ID:%s Content:%s", iter, toolResult.ID, content)
				params.Messages = append(params.Messages, openai.ToolMessage(content, toolResult.ID))
			}
		}

		if err := ctx.Err(); err != nil {
			providers.StreamError(onChunk, err.Error())
			providers.Log(p, providers.LogLevelError, "Context", "Context error: %v", err)
			return
		}

		// Continue loop: model may request additional tool calls.
	}

	// Add the final assistant response to conversation (without tool call metadata)
	// This keeps conversational context without confusing future tool selections
	if response != "" {
		*conversation = append(*conversation, types.ConversationMessage{
			Content: response,
			Name:    "",
			Param:   nil,
			Role:    "assistant",
		})
	}

	endStream.Actions = actions
	endStream.ReferencedDocuments = referencedDocuments
	endStream.Truncated = false
	providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req, *conversation)
	providers.Log(p, providers.LogLevelDebug, "Response", "Response for conversation ID: %s: %+v", req.ConversationID, response)
	providers.SendStreamEvent(onChunk, "end", *endStream)
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
