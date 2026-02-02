package openai_provider

import (
	"encoding/json"
	"fmt"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/azure"
	"github.com/openai/openai-go/v3/option"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/config"
)

// OpenAIProvider implements AIProvider using openai-go.
type OpenAIProvider struct {
	client openai.Client
	model  string
}

type BaseURL string

const (
	OpenGemini BaseURL = "https://generativelanguage.googleapis.com/v1beta/openai"
)

const azureAPIVersion = "2024-06-01"

func NewOpenAIProvider(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (*OpenAIProvider, error) {
	opts, err := getProviderOptions(conf, provider, model)
	if err != nil {
		return nil, fmt.Errorf("get provider config: %w", err)
	}

	return &OpenAIProvider{
		client: openai.NewClient(opts...),
		model:  model.Model,
	}, nil
}

func getProviderOptions(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) ([]option.RequestOption, error) {
	resolvedKey, err := providers.ResolveProviderKey(conf, provider, model)
	if err != nil {
		return nil, err
	}

	baseURL := model.Endpoint
	switch provider.Config {
	case config.ProviderConfigGemini:
		if baseURL == "" {
			baseURL = string(OpenGemini)
		}
		return []option.RequestOption{
			option.WithAPIKey(resolvedKey),
			option.WithBaseURL(baseURL),
		}, nil
	case config.DefaultProviderConfigType:
		opts := []option.RequestOption{
			option.WithAPIKey(resolvedKey),
		}
		if baseURL != "" {
			opts = append(opts, option.WithBaseURL(baseURL))
		}
		return opts, nil
	case config.OpenAIProviderConfigAzure:
		if model.Endpoint == "" {
			return nil, fmt.Errorf("endpoint is required for azure provider")
		}
		return []option.RequestOption{
			azure.WithEndpoint(model.Endpoint, azureAPIVersion),
			azure.WithAPIKey(resolvedKey),
		}, nil
	default:
		return nil, fmt.Errorf("unsupported provider config type %q", provider.Config)
	}
}

func convertToolToOpenAI(tool mcp.ToolDef) openai.ChatCompletionToolUnionParam {
	return openai.ChatCompletionToolUnionParam{
		OfFunction: &openai.ChatCompletionFunctionToolParam{
			Function: openai.FunctionDefinitionParam{
				Name:        tool.GetName(),
				Description: openai.String(tool.GetDescription()),
				Parameters:  openai.FunctionParameters(tool.GetDefinition()),
			},
		},
	}
}
func (p *OpenAIProvider) GetToolDefinitions() interface{} {
	tools := make([]openai.ChatCompletionToolUnionParam, 0, len(mcp.DefaultToolHandlers))
	for _, handler := range mcp.DefaultToolHandlers {
		tools = append(tools, convertToolToOpenAI(handler))
	}
	return tools
}

func (p *OpenAIProvider) TransformToolCallToToolsProcessor(toolCall any) ([]mcp.ToolsProcessor, []string) {
	toolsSlice, ok := toolCall.([]openai.ChatCompletionMessageToolCallUnion)
	toolNames := make([]string, len(toolsSlice))
	if !ok {
		return []mcp.ToolsProcessor{}, []string{}
	}
	tools := make([]mcp.ToolsProcessor, len(toolsSlice))
	for i, tool := range toolsSlice {
		toolNames[i] = tool.Function.Name
		args := map[string]any{}
		_ = json.Unmarshal([]byte(tool.Function.Arguments), &args)
		tools[i] = mcp.ToolsProcessor{
			Args:       args,
			Name:       tool.Function.Name,
			ToolCallID: tool.ID,
		}
	}
	return tools, toolNames
}
