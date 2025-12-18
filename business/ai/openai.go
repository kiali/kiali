package ai

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/kiali/kiali/business/ai/tools"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"

	openai "github.com/sashabaranov/go-openai"
)

// OpenAIProvider implements AIProvider using go-openai.
type OpenAIProvider struct {
	client    *openai.Client
	model     string
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

func (p *OpenAIProvider) SendChat(ctx context.Context, req AIRequest, toolHandlers []tools.ToolHandler) (*AIResponse, error) {
	if req.Query == "" {
		return nil, errors.New("query is required")
	}
	pageState := "null"
	if len(req.Context.PageState) > 0 {
		pageState = string(req.Context.PageState)
	}

	// Prepare tool definitions and lookup
	toolDefs := make([]openai.Tool, 0, len(toolHandlers))
	handlerByName := make(map[string]tools.ToolHandler, len(toolHandlers))
	for _, h := range toolHandlers {
		def := h.Definition()
		toolDefs = append(toolDefs, def)
		handlerByName[def.Function.Name] = h
	}

	messages := []openai.ChatCompletionMessage{
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
	log.Debugf("Message query: %+v related with the conversation %+v and view %+v", req.Query, req.ConversationID, req.Context.PageDescription)

	resp, err := p.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    p.model,
			Messages: messages,
			Tools:    toolDefs,
		},
	)
	
	if err != nil {
		return nil, err
	}
	
	if len(resp.Choices) == 0 {
		return nil, errors.New("openai returned no choices")
	}
	msg := resp.Choices[0].Message

	if len(msg.ToolCalls) > 0 {
		messages = append(messages, msg)

		for _, toolCall := range msg.ToolCalls {
			var args map[string]interface{}
			_ = json.Unmarshal([]byte(toolCall.Function.Arguments), &args)
			log.Debugf("Calling tool: %+v with arguments: %+v", toolCall.Function.Name, args)
			handler, ok := handlerByName[toolCall.Function.Name]
			if !ok {
				return nil, errors.New("tool handler not found: " + toolCall.Function.Name)
			}
			mcpResult, err := handler.Call(ctx, args)
			log.Debugf("Tool result: %+v", mcpResult)
			if err != nil {
				return nil, err
			}

			toolContent, err := formatToolContent(mcpResult)
			if err != nil {
				return nil, err
			}

			messages = append(messages, openai.ChatCompletionMessage{
				Role:       openai.ChatMessageRoleTool,
				Content:    toolContent,
				Name:       toolCall.Function.Name,
				ToolCallID: toolCall.ID,
			})
		}

		finalResp, err := p.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
			Model:    p.model,
			Messages: messages,
		})
		if err != nil {
			return nil, err
		}

		return &AIResponse{Answer: finalResp.Choices[0].Message.Content}, nil
	}

	log.Debugf("OpenAI response: %+v", msg.Content)
	return &AIResponse{Answer: msg.Content}, nil
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
