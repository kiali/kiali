package business

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/kiali/kiali/business/ai"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	mcp "github.com/metoro-io/mcp-golang"
	openai "github.com/sashabaranov/go-openai"
)

type AIContext struct {
	PageDescription string          `json:"page_description"`
	PageState       json.RawMessage `json:"page_state"`
}

// AIRequest holds the user query and optional context.
type AIRequest struct {
	ConversationID string    `json:"conversation_id,omitempty"`
	Query          string    `json:"query"`
	Context        AIContext `json:"context,omitempty"`
}

// AIResponse represents the provider reply (shape aligns with frontend expectations).
type AIResponse struct {
	Answer     string   `json:"answer"`
	// TODO: Add citations and used models
	//Citations  []string `json:"citations,omitempty"`
	//UsedModels []string `json:"used_models,omitempty"`
	//Truncated  bool     `json:"truncated,omitempty"`
}

// AIProvider exposes a minimal interface to send chat requests.
type AIProvider interface {
	SendChat(ctx context.Context, req AIRequest) (*AIResponse, error)
}

// OpenAIProvider implements AIProvider using go-openai.
type OpenAIProvider struct {
	client    *openai.Client
	mcpClient *mcp.Client
	model     string
}

func NewOpenAIProvider(apiKey, baseURL, model string) *OpenAIProvider {
	cfg := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		cfg.BaseURL = baseURL
	}
	return &OpenAIProvider{
		client: openai.NewClientWithConfig(cfg),
		model:  model,
	}
}

func (p *OpenAIProvider) SendChat(ctx context.Context, req AIRequest) (*AIResponse, error) {
	if req.Query == "" {
		return nil, errors.New("query is required")
	}
	pageState := "null"
	if len(req.Context.PageState) > 0 {
		pageState = string(req.Context.PageState)
	}

	openAIMessages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: "Page State (JSON):\n" + pageState + "\nPage Description:\n" + req.Context.PageDescription,
		},
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: ai.SystemInstruction,
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
			Messages: openAIMessages,
		},
	)
	if err != nil {
		return nil, err
	}
	if len(resp.Choices) == 0 {
		return nil, errors.New("openai returned no choices")
	}

	return &AIResponse{
		Answer: resp.Choices[0].Message.Content,
	}, nil	
}

// NewAIProvider builds the AI provider configured for the given model name.
func NewAIProvider(conf *config.Config, modelName string) (AIProvider, error) {
	if conf == nil || !conf.ChatAI.Enabled {
		return nil, fmt.Errorf("chat AI is disabled")
	}

	var selected *config.AIModel
	for i := range conf.ChatAI.Models {
		if conf.ChatAI.Models[i].Name == modelName {
			selected = &conf.ChatAI.Models[i]
			break
		}
	}
	if selected == nil {
		return nil, fmt.Errorf("model %q not found", modelName)
	}

	return NewOpenAIProvider(selected.Token, selected.Endpoint, selected.Model), nil
}
