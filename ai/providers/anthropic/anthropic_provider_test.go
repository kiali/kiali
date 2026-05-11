package anthropic_provider

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

func TestGetProviderOptions_NilConfig(t *testing.T) {
	provider := &config.ProviderConfig{
		Name: "anthropic-provider",
		Key:  "some-key",
	}
	model := &config.AIModel{
		Name:  "claude-sonnet",
		Model: "claude-sonnet-4-5",
	}

	_, err := getProviderOptions(nil, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "config is required")
}

func TestGetProviderOptions_DefaultConfigWithEndpoint(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "anthropic-provider",
		Type:   config.AnthropicProvider,
		Config: config.DefaultProviderConfigType,
		Key:    "anthropic-key",
	}
	model := &config.AIModel{
		Name:     "claude-sonnet",
		Model:    "claude-sonnet-4-5",
		Endpoint: "https://example.com/anthropic",
	}

	opts, err := getProviderOptions(conf, provider, model)
	require.NoError(t, err)
	assert.Len(t, opts, 2)
}

func TestGetProviderOptions_UnsupportedProviderConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:   "anthropic-provider",
		Type:   config.AnthropicProvider,
		Config: config.ProviderConfigType("unsupported-config-type"),
		Key:    "anthropic-key",
	}
	model := &config.AIModel{
		Name:  "claude-sonnet",
		Model: "claude-sonnet-4-5",
	}

	_, err := getProviderOptions(conf, provider, model)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported provider config type")
}

func TestMapToAnthropicToolInputSchema_SetsAdditionalPropertiesFalseRecursively(t *testing.T) {
	schema := mapToAnthropicToolInputSchema(map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"namespace": map[string]interface{}{
				"type": "string",
			},
			"filters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"labels": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"key": map[string]interface{}{
									"type": "string",
								},
							},
						},
					},
				},
			},
		},
		"required": []interface{}{"namespace"},
	})

	assert.Equal(t, false, schema.ExtraFields["additionalProperties"])

	properties, ok := schema.Properties.(map[string]interface{})
	require.True(t, ok)

	filters, ok := properties["filters"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, false, filters["additionalProperties"])

	filterProperties, ok := filters["properties"].(map[string]interface{})
	require.True(t, ok)

	labels, ok := filterProperties["labels"].(map[string]interface{})
	require.True(t, ok)
	items, ok := labels["items"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, false, items["additionalProperties"])
}

func TestNormalizeAnthropicInputSchema_StripsTopLevelAnyOfAndPreservesConstraintNote(t *testing.T) {
	normalized, note := normalizeAnthropicInputSchema(map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"namespace": map[string]interface{}{
				"type": "string",
			},
			"podName": map[string]interface{}{
				"type":        "string",
				"description": "Pod name",
			},
			"workloadName": map[string]interface{}{
				"type":        "string",
				"description": "Workload name",
			},
		},
		"required": []interface{}{"namespace"},
		"anyOf": []interface{}{
			map[string]interface{}{"required": []interface{}{"podName"}},
			map[string]interface{}{"required": []interface{}{"workloadName"}},
		},
	})

	_, hasAnyOf := normalized["anyOf"]
	assert.False(t, hasAnyOf)
	assert.Equal(t, "provide at least one of podName, workloadName", note)

	properties, ok := normalized["properties"].(map[string]interface{})
	require.True(t, ok)
	podName, ok := properties["podName"].(map[string]interface{})
	require.True(t, ok)
	workloadName, ok := properties["workloadName"].(map[string]interface{})
	require.True(t, ok)

	assert.Contains(t, podName["description"], "At least one of these fields is required")
	assert.Contains(t, workloadName["description"], "At least one of these fields is required")
}
