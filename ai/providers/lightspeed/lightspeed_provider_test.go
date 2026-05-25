package lightspeed_provider

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

func TestNewLightSpeedProvider_CreatesProvider(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:     "LightSpeed",
		Type:     config.LightSpeedProvider,
		Endpoint: "http://127.0.0.1:8080/",
		Enabled:  true,
	}
	model := &config.AIModel{Name: "LightSpeed", Enabled: true}

	p, err := NewLightSpeedProvider(conf, provider, model)

	require.NoError(t, err)
	require.NotNil(t, p)
}

func TestNewLightSpeedProvider_NilModelIsAccepted(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:     "LightSpeed",
		Endpoint: "http://127.0.0.1:8080/",
	}

	p, err := NewLightSpeedProvider(conf, provider, nil)

	require.NoError(t, err)
	require.NotNil(t, p)
}

func TestGetName_ReturnsLightSpeed(t *testing.T) {
	p := &LightSpeedProvider{}
	assert.Equal(t, "LightSpeed", p.GetName())
}

func TestGetToolDefinitions_ReturnsNil(t *testing.T) {
	p := &LightSpeedProvider{}
	assert.Nil(t, p.GetToolDefinitions())
}
