package lightspeed_provider

import (
	"github.com/kiali/kiali/ai/providers/lightspeed/client"
	"github.com/kiali/kiali/config"
)

type LightSpeedProvider struct {
	client client.Client
}

// NewLightSpeedProvider creates a LightSpeed provider using only the
// provider-level endpoint. LightSpeed has no models or API key; authentication
// is handled per-request via the Kiali user's Kubernetes bearer token.
func NewLightSpeedProvider(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (*LightSpeedProvider, error) {
	return &LightSpeedProvider{
		client: *client.New(provider.Endpoint, client.WithInsecureSkipTLS(true)),
	}, nil
}

func (p *LightSpeedProvider) GetName() string {
	return "LightSpeed"
}

func (p *LightSpeedProvider) GetToolDefinitions() interface{} {
	return nil
}
