package tracing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

const token = "1234567890"

func TestCreateJaegerClient(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.UseGRPC = false

	tracingClient, err := NewClient(context.Background(), conf, token, true)

	assert.Nil(t, err)
	assert.NotNil(t, tracingClient)
}

func TestCreateTempogGRPCClient(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = true

	tracingClient, err := NewClient(context.Background(), conf, token, true)

	assert.Nil(t, err)
	assert.NotNil(t, tracingClient)
}

func TestCreateTempoHTTPClient(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = false

	tracingClient, err := NewClient(context.Background(), conf, token, true)

	assert.Nil(t, err)
	assert.NotNil(t, tracingClient)
}
