package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func findModelPricing(pricings []ModelPricing, modelID string) *ModelPricing {
	for i := range pricings {
		if pricings[i].ModelID == modelID {
			return &pricings[i]
		}
	}
	return nil
}

func TestNewAIConfigLoadsDefaultModelPricings(t *testing.T) {
	conf := NewAIConfig()

	assert.Empty(t, conf.Consumption.PrizesConfigMap)
	require.NotEmpty(t, conf.Consumption.ModelPricings)
	assert.GreaterOrEqual(t, len(conf.Consumption.ModelPricings), 70)

	sonnet46 := findModelPricing(conf.Consumption.ModelPricings, "claude-sonnet-4-6")
	require.NotNil(t, sonnet46)
	assert.True(t, sonnet46.Enabled)
	assert.Equal(t, AnthropicProvider, sonnet46.Provider)
	assert.Equal(t, "USD", sonnet46.Currency)
	assert.Equal(t, 3.00, sonnet46.Prices.InputCostPerMillion)
	assert.Equal(t, 15.00, sonnet46.Prices.OutputCostPerMillion)
	assert.Equal(t, 3.75, sonnet46.Prices.CacheWriteCostPerMillion)
	assert.Equal(t, 0.30, sonnet46.Prices.CacheReadCostPerMillion)

	gpt41 := findModelPricing(conf.Consumption.ModelPricings, "gpt-4.1")
	require.NotNil(t, gpt41)
	assert.Equal(t, OpenAIProvider, gpt41.Provider)
	assert.Equal(t, 2.00, gpt41.Prices.InputCostPerMillion)
	assert.Equal(t, 8.00, gpt41.Prices.OutputCostPerMillion)
	assert.Equal(t, 0.50, gpt41.Prices.CacheReadCostPerMillion)

	o4mini := findModelPricing(conf.Consumption.ModelPricings, "o4-mini")
	require.NotNil(t, o4mini)
	assert.Equal(t, 1.10, o4mini.Prices.InputCostPerMillion)
	assert.Equal(t, 4.40, o4mini.Prices.OutputCostPerMillion)

	gemini25Pro := findModelPricing(conf.Consumption.ModelPricings, "gemini-2.5-pro")
	require.NotNil(t, gemini25Pro)
	assert.Equal(t, GoogleProvider, gemini25Pro.Provider)
	assert.Equal(t, 1.25, gemini25Pro.Prices.InputCostPerMillion)
	assert.Equal(t, 10.00, gemini25Pro.Prices.OutputCostPerMillion)
	assert.Equal(t, 0.125, gemini25Pro.Prices.CacheReadCostPerMillion)

	haiku45 := findModelPricing(conf.Consumption.ModelPricings, "claude-haiku-4-5")
	require.NotNil(t, haiku45)
	assert.Equal(t, 1.00, haiku45.Prices.InputCostPerMillion)
	assert.Equal(t, 5.00, haiku45.Prices.OutputCostPerMillion)

	fable51 := findModelPricing(conf.Consumption.ModelPricings, "claude-fable-5-1")
	require.NotNil(t, fable51)
	assert.Equal(t, 0.25, fable51.Prices.CacheReadCostPerMillion)
}

func TestLoadDefaultModelPricingsReturnsCopy(t *testing.T) {
	first := loadDefaultModelPricings()
	second := loadDefaultModelPricings()

	require.NotEmpty(t, first)
	first[0].ModelID = "mutated"

	assert.NotEqual(t, first[0].ModelID, second[0].ModelID)
}

func TestLoadModelPricingsFromFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "prices.yaml")
	require.NoError(t, os.WriteFile(path, []byte(`
models:
  - provider: openai
    model_id: custom-model
    currency: USD
    prices:
      input_cost_per_million: 1.5
      output_cost_per_million: 6
`), 0o644))

	pricings, err := loadModelPricingsFromFile(path)
	require.NoError(t, err)
	require.Len(t, pricings, 1)
	assert.True(t, pricings[0].Enabled)
	assert.Equal(t, OpenAIProvider, pricings[0].Provider)
	assert.Equal(t, "custom-model", pricings[0].ModelID)
	assert.Equal(t, 1.5, pricings[0].Prices.InputCostPerMillion)
	assert.Equal(t, 6.0, pricings[0].Prices.OutputCostPerMillion)
}

func TestResolveModelPricingsEmptyUsesBuiltInCatalog(t *testing.T) {
	consumption := AIConsumptionConfig{}
	consumption.resolveModelPricings()
	require.GreaterOrEqual(t, len(consumption.ModelPricings), 70)
}

func TestResolveModelPricingsMissingFileFallsBackToBuiltIn(t *testing.T) {
	consumption := AIConsumptionConfig{PrizesConfigMap: "missing-prices"}
	consumption.resolveModelPricings()
	assert.Equal(t, "missing-prices", consumption.PrizesConfigMap)
	require.GreaterOrEqual(t, len(consumption.ModelPricings), 70)
}

func TestUnmarshalPrizesConfigMapName(t *testing.T) {
	conf, err := Unmarshal(`
ai:
  consumption:
    prizes_config_map: my-ai-prices
`)
	require.NoError(t, err)
	t.Cleanup(func() {
		if conf.Credentials != nil {
			conf.Credentials.Close()
		}
	})
	assert.Equal(t, "my-ai-prices", conf.AI.Consumption.PrizesConfigMap)
	require.GreaterOrEqual(t, len(conf.AI.Consumption.ModelPricings), 70)
}
