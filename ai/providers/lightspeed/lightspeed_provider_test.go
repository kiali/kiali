package lightspeed_provider

import (
	"crypto/tls"
	"net/http"
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

func TestNewLightSpeedProvider_TLSVerificationEnabledByDefault(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:     "LightSpeed",
		Type:     config.LightSpeedProvider,
		Endpoint: "https://ols.example.com",
		Enabled:  true,
	}

	p, err := NewLightSpeedProvider(conf, provider, nil)

	require.NoError(t, err)
	transport, ok := p.client.HttpClient().Transport.(*http.Transport)
	require.True(t, ok)
	assert.False(t, transport.TLSClientConfig.InsecureSkipVerify)
}

func TestNewLightSpeedProvider_InsecureSkipVerifyFromConfig(t *testing.T) {
	conf := config.NewConfig()
	provider := &config.ProviderConfig{
		Name:               "LightSpeed",
		Type:               config.LightSpeedProvider,
		Endpoint:           "https://ols.example.com",
		Enabled:            true,
		InsecureSkipVerify: true,
	}

	p, err := NewLightSpeedProvider(conf, provider, nil)

	require.NoError(t, err)
	transport, ok := p.client.HttpClient().Transport.(*http.Transport)
	require.True(t, ok)
	assert.True(t, transport.TLSClientConfig.InsecureSkipVerify)
}

func TestNewLightSpeedProvider_AppliesTLSPolicy(t *testing.T) {
	conf := config.NewConfig()
	conf.ResolvedTLSPolicy = config.TLSPolicy{
		MinVersion: tls.VersionTLS13,
	}
	provider := &config.ProviderConfig{
		Name:     "LightSpeed",
		Type:     config.LightSpeedProvider,
		Endpoint: "https://ols.example.com",
		Enabled:  true,
	}

	p, err := NewLightSpeedProvider(conf, provider, nil)

	require.NoError(t, err)
	transport, ok := p.client.HttpClient().Transport.(*http.Transport)
	require.True(t, ok)
	assert.Equal(t, uint16(tls.VersionTLS13), transport.TLSClientConfig.MinVersion)
}

func TestGetName_ReturnsLightSpeed(t *testing.T) {
	p := &LightSpeedProvider{}
	assert.Equal(t, "LightSpeed", p.GetName())
}

func TestGetToolDefinitions_ReturnsNil(t *testing.T) {
	p := &LightSpeedProvider{}
	assert.Nil(t, p.GetToolDefinitions())
}
