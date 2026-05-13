package anthropic_provider

import (
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/anthropics/anthropic-sdk-go/packages/param"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/config"
)

const (
	defaultMaxTokens            int64 = 4096
	reduceConversationMaxTokens int64 = 1024
)

type AnthropicProvider struct {
	client         anthropic.Client
	model          string
	tracingEnabled bool
}

type anthropicConversation struct {
	Messages []anthropic.MessageParam
	System   []anthropic.TextBlockParam
}

func (p *AnthropicProvider) GetName() string {
	return "Anthropic"
}

func NewAnthropicProvider(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (*AnthropicProvider, error) {
	opts, err := getProviderOptions(conf, provider, model)
	if err != nil {
		return nil, fmt.Errorf("get provider config: %w", err)
	}

	return &AnthropicProvider{
		client:         anthropic.NewClient(opts...),
		model:          model.Model,
		tracingEnabled: conf.ExternalServices.Tracing.Enabled,
	}, nil
}

func getProviderOptions(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) ([]option.RequestOption, error) {
	resolvedKey, err := providers.ResolveProviderKey(conf, provider, model)
	if err != nil {
		return nil, err
	}

	opts := []option.RequestOption{
		option.WithAPIKey(resolvedKey),
	}
	if model.Endpoint != "" {
		opts = append(opts, option.WithBaseURL(model.Endpoint))
	}

	switch provider.Config {
	case "", config.DefaultProviderConfigType:
		return opts, nil
	default:
		return nil, fmt.Errorf("unsupported provider config type %q", provider.Config)
	}
}

func convertToolToAnthropic(tool mcp.ToolDef) anthropic.ToolUnionParam {
	normalizedSchema, schemaConstraintNote := normalizeAnthropicInputSchema(tool.GetDefinition())
	description := tool.GetDescription()
	if schemaConstraintNote != "" {
		description = fmt.Sprintf("%s IMPORTANT input constraint: %s.", description, schemaConstraintNote)
	}
	return anthropic.ToolUnionParam{
		OfTool: &anthropic.ToolParam{
			Name:        tool.GetName(),
			Description: param.NewOpt(description),
			InputSchema: mapToAnthropicToolInputSchema(normalizedSchema),
		},
	}
}

func mapToAnthropicToolInputSchema(schemaMap map[string]interface{}) anthropic.ToolInputSchemaParam {
	schemaMap = normalizeAnthropicSchemaMap(schemaMap)
	schema := anthropic.ToolInputSchemaParam{
		ExtraFields: map[string]any{},
	}

	if properties, ok := schemaMap["properties"]; ok {
		schema.Properties = properties
	}
	if required, ok := schemaMap["required"].([]interface{}); ok {
		schema.Required = make([]string, 0, len(required))
		for _, field := range required {
			if fieldName, ok := field.(string); ok && fieldName != "" {
				schema.Required = append(schema.Required, fieldName)
			}
		}
	}

	for key, value := range schemaMap {
		switch key {
		case "type", "properties", "required":
			continue
		default:
			schema.ExtraFields[key] = value
		}
	}

	if len(schema.ExtraFields) == 0 {
		schema.ExtraFields = nil
	}

	return schema
}

func normalizeAnthropicInputSchema(schemaMap map[string]interface{}) (map[string]interface{}, string) {
	normalizedSchema := normalizeAnthropicSchemaMap(schemaMap)
	return stripUnsupportedAnthropicTopLevelCombinators(normalizedSchema)
}

func normalizeAnthropicSchemaMap(schemaMap map[string]interface{}) map[string]interface{} {
	normalized := make(map[string]interface{}, len(schemaMap)+1)
	for key, value := range schemaMap {
		normalized[key] = normalizeAnthropicSchemaValue(value)
	}

	if schemaType, ok := normalized["type"].(string); ok && schemaType == "object" {
		if _, exists := normalized["additionalProperties"]; !exists {
			normalized["additionalProperties"] = false
		}
	}

	return normalized
}

func normalizeAnthropicSchemaValue(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		return normalizeAnthropicSchemaMap(typed)
	case []interface{}:
		normalized := make([]interface{}, len(typed))
		for i, item := range typed {
			normalized[i] = normalizeAnthropicSchemaValue(item)
		}
		return normalized
	default:
		return value
	}
}

func stripUnsupportedAnthropicTopLevelCombinators(schema map[string]interface{}) (map[string]interface{}, string) {
	notes := make([]string, 0, 3)

	if allOf, ok := schema["allOf"].([]interface{}); ok {
		mergeTopLevelAllOf(schema, allOf)
		delete(schema, "allOf")
	}

	if anyOf, ok := schema["anyOf"].([]interface{}); ok {
		if fields := extractRequiredAlternatives(anyOf); len(fields) > 0 {
			note := fmt.Sprintf("provide at least one of %s", strings.Join(fields, ", "))
			notes = append(notes, note)
			appendConstraintNoteToProperties(schema, fields, "At least one of these fields is required together with the others listed in this note.")
		} else {
			notes = append(notes, "top-level anyOf constraints were simplified for Anthropic compatibility")
		}
		delete(schema, "anyOf")
	}

	if oneOf, ok := schema["oneOf"].([]interface{}); ok {
		if fields := extractRequiredAlternatives(oneOf); len(fields) > 0 {
			note := fmt.Sprintf("provide exactly one of %s", strings.Join(fields, ", "))
			notes = append(notes, note)
			appendConstraintNoteToProperties(schema, fields, "Exactly one of these fields should be provided together with the others listed in this note.")
		} else {
			notes = append(notes, "top-level oneOf constraints were simplified for Anthropic compatibility")
		}
		delete(schema, "oneOf")
	}

	return schema, strings.Join(notes, "; ")
}

func mergeTopLevelAllOf(schema map[string]interface{}, allOf []interface{}) {
	properties, _ := schema["properties"].(map[string]interface{})
	if properties == nil {
		properties = map[string]interface{}{}
	}

	requiredSet := map[string]struct{}{}
	if required, ok := schema["required"].([]interface{}); ok {
		for _, field := range required {
			if fieldName, ok := field.(string); ok && fieldName != "" {
				requiredSet[fieldName] = struct{}{}
			}
		}
	}

	for _, entry := range allOf {
		entryMap, ok := entry.(map[string]interface{})
		if !ok {
			continue
		}

		if entryProps, ok := entryMap["properties"].(map[string]interface{}); ok {
			for key, value := range entryProps {
				properties[key] = value
			}
		}

		if required, ok := entryMap["required"].([]interface{}); ok {
			for _, field := range required {
				if fieldName, ok := field.(string); ok && fieldName != "" {
					requiredSet[fieldName] = struct{}{}
				}
			}
		}
	}

	if len(properties) > 0 {
		schema["properties"] = properties
	}

	if len(requiredSet) > 0 {
		required := make([]interface{}, 0, len(requiredSet))
		for fieldName := range requiredSet {
			required = append(required, fieldName)
		}
		schema["required"] = required
	}
}

func extractRequiredAlternatives(entries []interface{}) []string {
	seen := map[string]struct{}{}
	fields := make([]string, 0, len(entries))
	for _, entry := range entries {
		entryMap, ok := entry.(map[string]interface{})
		if !ok {
			continue
		}
		required, ok := entryMap["required"].([]interface{})
		if !ok {
			continue
		}
		for _, field := range required {
			fieldName, ok := field.(string)
			if !ok || fieldName == "" {
				continue
			}
			if _, exists := seen[fieldName]; exists {
				continue
			}
			seen[fieldName] = struct{}{}
			fields = append(fields, fieldName)
		}
	}
	return fields
}

func appendConstraintNoteToProperties(schema map[string]interface{}, fieldNames []string, note string) {
	properties, ok := schema["properties"].(map[string]interface{})
	if !ok {
		return
	}

	for _, fieldName := range fieldNames {
		prop, ok := properties[fieldName].(map[string]interface{})
		if !ok {
			continue
		}

		description, _ := prop["description"].(string)
		if description == "" {
			prop["description"] = note
			continue
		}
		if strings.Contains(description, note) {
			continue
		}
		prop["description"] = fmt.Sprintf("%s %s", description, note)
	}
}

func (p *AnthropicProvider) GetToolDefinitions() interface{} {
	tools := make([]anthropic.ToolUnionParam, 0, len(mcp.DefaultToolHandlers))
	for _, tool := range mcp.DefaultToolHandlers {
		if !p.tracingEnabled && mcp.IsTraceTool(tool.Name) {
			continue
		}
		tools = append(tools, convertToolToAnthropic(tool))
	}
	return tools
}
