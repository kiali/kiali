package tracing

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
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
