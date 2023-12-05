package tracing

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/stretchr/testify/assert"
)

const token = "1234567890"

func TestCreateJaegerClient(t *testing.T) {

	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	config.Set(conf)

	tracingClient, err := NewClient(token)

	assert.Nil(t, err)
	assert.NotNil(t, tracingClient)
}

func TestCreateTempogRPCClient(t *testing.T) {

	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = true
	config.Set(conf)

	tracingClient, err := NewClient(token)

	assert.Nil(t, err)
	assert.NotNil(t, tracingClient)
}

func TestCreateTempoHTTPClient(t *testing.T) {

	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = false
	config.Set(conf)

	tracingClient, err := NewClient(token)

	assert.Nil(t, err)
	assert.NotNil(t, tracingClient)
}
