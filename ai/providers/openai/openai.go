package openai_provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	openai "github.com/openai/openai-go/v3"

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

func (p *OpenAIProvider) SendChat(r *http.Request, req types.AIRequest, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache, aiStore types.AIStore, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (*types.AIResponse, int) {
	if req.ConversationID == "" {
		return &types.AIResponse{Error: "conversation ID is required"}, http.StatusBadRequest
	}

	if req.Query == "" {
		return &types.AIResponse{Error: "query is required"}, http.StatusBadRequest
	}
	ctx := r.Context()
	ptr, sessionID, conversation := providers.GetStoreConversation(r, req, aiStore)
	p.InitializeConversation(&conversation, req)
	resp, err := p.client.Chat.Completions.New(
		r.Context(),
		openai.ChatCompletionNewParams{
			Model:    openai.ChatModel(p.model),
			Messages: p.ConversationToProvider(conversation).([]openai.ChatCompletionMessageParamUnion),
			Tools:    p.GetToolDefinitions().([]openai.ChatCompletionToolUnionParam),
		},
	)

	if err != nil {
		log.Debugf("[Chat AI] OpenAI provider error in send chat with tools: %v", err)
		return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
	}
	if err := ctx.Err(); err != nil {
		log.Debugf("[Chat AI] OpenAI provider error in send chat with tools context error: %v", err)
		return providers.NewContextCanceledResponse(err)
	}

	if len(resp.Choices) == 0 {
		log.Debugf("[Chat AI] OpenAI provider error in send chat with tools no choices: %v", resp)
		return &types.AIResponse{Error: "openai returned no choices"}, http.StatusInternalServerError
	}
	conversation = append(conversation, p.ProviderToConversation(resp))
	msg := resp.Choices[0].Message
	response := &types.AIResponse{}
	if len(msg.ToolCalls) > 0 {
		tools, toolNames := p.TransformToolCallToToolsProcessor(msg.ToolCalls)
		log.Debugf("[Chat AI] OpenAI provider tool calls: %v", toolNames)
		// Execute tool calls in parallel since they don't depend on each other
		toolResults := providers.ExecuteToolCallsInParallel(ctx, r, tools, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		// Add tool results to conversation in the original order
		for _, result := range toolResults {
			if result.Error != nil {
				return &types.AIResponse{Error: result.Error.Error()}, result.Code
			}
			if len(result.Actions) > 0 || len(result.Citations) > 0 {
				response.Actions = append(response.Actions, result.Actions...)
				response.Citations = append(response.Citations, result.Citations...)
			} else {
				// For get_logs with analyze=false, return logs directly without AI analysis
				if result.Message.Name == "get_logs" && result.Message.Content != "" {
					// Check if analyze parameter is false (default)
					analyze := false
					if result.Message.Param != nil {
						if params, ok := result.Message.Param.(map[string]interface{}); ok {
							if analyzeVal, ok := params["analyze"].(bool); ok {
								analyze = analyzeVal
							}
						}
					}
					if !analyze {
						// Return logs directly without model analysis
						response.Answer = providers.ParseMarkdownResponse(result.Message.Content)
						continue
					}
				}
				conversation = append(conversation, result.Message)
			}
		}
		if err := ctx.Err(); err != nil {
			return providers.NewContextCanceledResponse(err)
		}

		// If get_logs with analyze=false already set the answer, return it directly
		if response.Answer != "" {
			providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req, conversation)
			log.Debugf("[Chat AI] Response for conversation ID: %s: %+v", req.ConversationID, response)
			return response, http.StatusOK
		}

		shouldGenerate, responseAnswer := providers.ShouldGenerateAnswer(response, toolNames)
		if shouldGenerate {
			log.Debugf("[Chat AI] OpenAI provider conversation after tool calls: %+v", conversation)
			finalResp, err := p.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
				Model:    openai.ChatModel(p.model),
				Messages: p.ConversationToProvider(conversation).([]openai.ChatCompletionMessageParamUnion),
			})
			if err != nil {
				return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
			}
			if err := ctx.Err(); err != nil {
				return providers.NewContextCanceledResponse(err)
			}
			response.Answer = providers.ParseMarkdownResponse(finalResp.Choices[0].Message.Content)
		} else {
			response.Answer = responseAnswer
		}
	} else {
		response.Answer = providers.ParseMarkdownResponse(msg.Content)
	}

	providers.StoreConversation(p, ctx, aiStore, ptr, sessionID, req, conversation)
	log.Debugf("[Chat AI] Response for conversation ID: %s: %+v", req.ConversationID, response)
	return response, http.StatusOK
}

func (p *OpenAIProvider) InitializeConversation(conversation *[]types.ConversationMessage, req types.AIRequest) {
	if conversation == nil {
		return
	}
	if len(*conversation) == 0 {
		// Initialize base system instruction when empty.
		*conversation = []types.ConversationMessage{{
			Content: types.SystemInstruction,
			Name:    "",
			Param:   openai.SystemMessage(types.SystemInstruction).GetContent().AsAny(),
			Role:    "system",
		},
		}
	}
	contextBytes, _ := json.Marshal(req.Context)
	// Adding context to the conversation. This is the system message that is sent to the AI.
	contextContent := fmt.Sprintf("CONTEXT (JSON):\n%s\n\n", string(contextBytes))
	*conversation = append(*conversation, types.ConversationMessage{
		Content: contextContent,
		Name:    "",
		Param:   nil,
		Role:    "system",
	})
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
