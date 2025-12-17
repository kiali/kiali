package business

import (
	"context"
	"errors"
	"fmt"

	openai "github.com/sashabaranov/go-openai"

	"github.com/kiali/kiali/config"
)

// AIRequest holds the user query and optional context.
type AIRequest struct {
	ConversationID string `json:"conversation_id,omitempty"`
	Query          string `json:"query"`
	Context        string `json:"context,omitempty"`
}

// AIResponse represents the provider reply (shape aligns with frontend expectations).
type AIResponse struct {
	Answer    string   `json:"answer"`
	Citations []string `json:"citations,omitempty"`
	UsedModels []string `json:"used_models,omitempty"`
	Truncated bool     `json:"truncated,omitempty"`
}

// AIProvider exposes a minimal interface to send chat requests.
type AIProvider interface {
	SendChat(ctx context.Context, req AIRequest) (*AIResponse, error)
}

// OpenAIProvider implements AIProvider using go-openai.
type OpenAIProvider struct {
	client *openai.Client
	model  string
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

	openAIMessages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: req.Context,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: req.Query,
		},
	}

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
		Citations: [],
		UsedModels: resp.Choices[0].Message.UsedModels,
		Truncated: resp.Choices[0].Message.Truncated,
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