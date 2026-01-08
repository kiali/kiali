package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/kiali/kiali/ai/mcp"
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

	pageState := "null"
	if len(req.Context.PageState) > 0 {
		pageState = string(req.Context.PageState)
	}

	var conversation []openai.ChatCompletionMessage
	ptr, found := kialiCache.GetAIConversation(req.ConversationID)
	if found && ptr != nil {
		log.Debugf("Conversation found for conversation ID: %s", req.ConversationID)
		conversation = *ptr
		conversation = append(conversation, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleUser,
			Content: req.Query,
		})
	} else {
		log.Debugf("Creating new conversation for conversation ID: %s", req.ConversationID)
		conversation = []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: "Page State (JSON):\n" + pageState + "\nPage Description:\n" + req.Context.PageDescription,
			},
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: SystemInstruction,
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: req.Query,
			},
		}
	}

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
		log.Debugf("Conversation: %+v", conversation)
		finalResp, err := p.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
			Model:    p.model,
			Messages: conversation,
		})
		log.Debugf("Final response: %+v", finalResp)
		if err != nil {
			return &AIResponse{Error: err.Error()}, http.StatusInternalServerError
		}
		response := parseResponse(finalResp.Choices[0].Message.Content)
		log.Debugf("Response after parsing: %+v", response)
		conversation = append(conversation, openai.ChatCompletionMessage{
			Role:    finalResp.Choices[0].Message.Role,
			Content: response.Answer,
		})
		kialiCache.SetAIConversation(req.ConversationID, &conversation)
		return response, http.StatusOK
	}
	response := parseResponse(msg.Content)
	log.Debugf("Response after parsing: %+v", response)
	conversation = append(conversation, openai.ChatCompletionMessage{
		Role:    msg.Role,
		Content: response.Answer,
	})
	kialiCache.SetAIConversation(req.ConversationID, &conversation)
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
