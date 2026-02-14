package lightspeed_provider

import (
	"github.com/kiali/kiali/ai/providers/lightspeed/client"
	"github.com/kiali/kiali/config"
)

type LightSpeedProvider struct {
	client client.Client
}

func NewLightSpeedProvider(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (*LightSpeedProvider, error) {
	return &LightSpeedProvider{
		client: *client.New(model.Endpoint, client.WithInsecureSkipTLS(true)),
	}, nil
}

func (p *LightSpeedProvider) GetToolDefinitions() interface{} {
	return nil
}
