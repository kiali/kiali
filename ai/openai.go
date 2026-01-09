package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/prompts"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"

	openai "github.com/sashabaranov/go-openai"
)

// OpenAIProvider implements AIProvider using go-openai.
type OpenAIProvider struct {
	client *openai.Client
	model  string
}

type rawAIResponse struct {
	Actions   []Action   `json:"actions"`
	Answer    string     `json:"answer"`
	Citations []Citation `json:"citations"`
}

func NewOpenAIProvider(model *config.AIModel) *OpenAIProvider {
	cfg := openai.DefaultConfig(model.Token)
	if model.Endpoint != "" {
		cfg.BaseURL = model.Endpoint
	}

	return &OpenAIProvider{
		client: openai.NewClientWithConfig(cfg),
		model:  model.Model,
	}
}

func (p *OpenAIProvider) SendChat(ctx context.Context, req AIRequest, toolHandlers []mcp.ToolHandler, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory, kialiCache cache.KialiCache, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (*AIResponse, int) {
	if req.ConversationID == "" {
		return &AIResponse{Error: "conversation ID is required"}, http.StatusBadRequest
	}

	if req.Query == "" {
		return &AIResponse{Error: "query is required"}, http.StatusBadRequest
	}

	var conversation []openai.ChatCompletionMessage
	ptr, found := kialiCache.GetAIConversation(req.Username, req.ConversationID)
	if found && ptr != nil {
		log.Debugf("Conversation found for conversation ID: %s", req.ConversationID)
		conversation = *ptr
	} else {
		log.Debugf("Creating new conversation for conversation ID: %s", req.ConversationID)
		conversation = []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: prompts.SystemInstruction,
			},
		}
	}
	contextBytes, _ := json.Marshal(req.Context)
	// Adding context to the conversation. This is the system message that is sent to the AI.
	conversation = append(conversation, openai.ChatCompletionMessage{
		Role: openai.ChatMessageRoleSystem,
		Content: fmt.Sprintf("CONTEXT (JSON):\n%s\n\n",
			string(contextBytes)),
	})
	// Adding user query to the conversation. This is the user message that is sent to the AI.
	conversation = append(conversation, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: req.Query,
	})

	// Prepare tool definitions and lookup
	toolDefs := make([]openai.Tool, 0, len(toolHandlers))
	handlerByName := make(map[string]mcp.ToolHandler, len(toolHandlers))
	for _, h := range toolHandlers {
		def := h.Definition()
		toolDefs = append(toolDefs, def)
		handlerByName[def.Function.Name] = h
	}

	resp, err := p.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    p.model,
			Messages: conversation,
			Tools:    toolDefs,
			Temperature: 0.2,
		},
	)

	if err != nil {
		return &AIResponse{Error: err.Error()}, http.StatusInternalServerError
	}

	if len(resp.Choices) == 0 {
		return &AIResponse{Error: "openai returned no choices"}, http.StatusInternalServerError
	}
	msg := resp.Choices[0].Message
	conversation = append(conversation, msg)
	var response *AIResponse
	var role string = msg.Role
	if len(msg.ToolCalls) > 0 {
		for _, toolCall := range msg.ToolCalls {
			var args map[string]interface{}
			_ = json.Unmarshal([]byte(toolCall.Function.Arguments), &args)
			log.Debugf("Calling tool: %+v with arguments: %+v", toolCall.Function.Name, args)
			handler, ok := handlerByName[toolCall.Function.Name]
			if !ok {
				return &AIResponse{Error: "tool handler not found: " + toolCall.Function.Name}, http.StatusInternalServerError
			}
			mcpResult, code := handler.Call(ctx, args, business, prom, clientFactory, kialiCache, conf, grafana, perses, discovery)
			if code != http.StatusOK {
				return &AIResponse{Error: fmt.Sprintf("tool %s returned error: %s", toolCall.Function.Name, mcpResult)}, code
			}

			toolContent, err := formatToolContent(mcpResult)
			if err != nil {
				return &AIResponse{Error: "failed to format tool content"}, http.StatusInternalServerError
			}

			conversation = append(conversation, openai.ChatCompletionMessage{
				Role:       openai.ChatMessageRoleTool,
				Content:    toolContent,
				Name:       toolCall.Function.Name,
				ToolCallID: toolCall.ID,
			})
		}
		// Add prompt reminders for actions and citations before final response
		conversation = prompts.AddPromptReminders(conversation)

		log.Debugf("Conversation: %+v", conversation)
		finalResp, err := p.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
			Model:    p.model,
			Messages: conversation,
			ResponseFormat: &openai.ChatCompletionResponseFormat{
				Type: openai.ChatCompletionResponseFormatTypeJSONSchema,
				JSONSchema: &openai.ChatCompletionResponseFormatJSONSchema{
					Name:   "ai_response",
					Schema: json.RawMessage(fmt.Sprintf("{\"type\":\"object\",\"properties\":{\"answer\":{\"type\":\"string\"},\"citations\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"link\":{\"type\":\"string\"},\"title\":{\"type\":\"string\"},\"body\":{\"type\":\"string\"}},\"required\":[\"link\",\"title\",\"body\"],\"additionalProperties\":false}},\"actions\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"title\":{\"type\":\"string\"},\"kind\":{\"type\":\"string\"},\"payload\":{\"type\":\"string\"}},\"required\":[\"title\",\"kind\",\"payload\"],\"additionalProperties\":false}}},\"required\":[\"answer\",\"citations\",\"actions\"],\"additionalProperties\":false}")),
					Strict: true,
				},
			},
		})
		log.Debugf("Final response: %+v", finalResp)
		if err != nil {
			return &AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		response = parseResponse(finalResp.Choices[0].Message.Content)
		role = finalResp.Choices[0].Message.Role
	} else {
		response = parseResponse(msg.Content)
	}
	log.Debugf("Response after parsing: %+v", response)
	conversation = append(conversation, openai.ChatCompletionMessage{
		Role:   role,
		Content: response.Answer,
	})
	kialiCache.SetAIConversation(req.Username, req.ConversationID, &conversation)
	return response, http.StatusOK
}

func parseResponse(content string) *AIResponse {
	log.Debugf("OpenAI response: %+v", content)

	// Clean markdown code blocks if present
	cleanContent := strings.TrimSpace(content)
	if strings.HasPrefix(cleanContent, "```json") && strings.HasSuffix(cleanContent, "```") {
		cleanContent = strings.TrimPrefix(cleanContent, "```json")
		cleanContent = strings.TrimSuffix(cleanContent, "```")
	} else if strings.HasPrefix(cleanContent, "```") && strings.HasSuffix(cleanContent, "```") {
		cleanContent = strings.TrimPrefix(cleanContent, "```")
		cleanContent = strings.TrimSuffix(cleanContent, "```")
	}
	cleanContent = strings.TrimSpace(cleanContent)

	var raw rawAIResponse
	if err := json.Unmarshal([]byte(cleanContent), &raw); err != nil {
		// Fallback for non-JSON or invalid JSON
		log.Warningf("Failed to unmarshal AI response: %v", err)
		return &AIResponse{Answer: content}
	}

	return &AIResponse{
		Actions: raw.Actions,
		Answer:    raw.Answer,
		Citations: raw.Citations,
	}
}

func formatToolContent(result interface{}) (string, error) {
	switch v := result.(type) {
	case string:
		return v, nil
	case []byte:
		return string(v), nil
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}
}
