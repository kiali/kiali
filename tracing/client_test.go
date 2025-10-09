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

func TestTempoURLConstructionWithTenant(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = "http://tempo-server:8080"
	conf.ExternalServices.Tracing.TempoConfig.Tenant = "my-tenant"

	// The client should be created successfully with the tenant URL constructed
	client, err := NewClient(context.Background(), conf, token, false)

	// The client should be created successfully
	assert.Nil(t, err)
	assert.NotNil(t, client)

	assert.Equal(t, client.baseURL.String(), "http://tempo-server:8080/api/traces/v1/my-tenant/tempo")
}

func TestTempoURLConstructionJaegerWithTenant(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = "http://tempo-server:8080"
	conf.ExternalServices.Tracing.TempoConfig.Tenant = "my-tenant"

	// The client should be created successfully with the tenant URL constructed
	client, err := NewClient(context.Background(), conf, token, false)

	// The client should be created successfully
	assert.Nil(t, err)
	assert.NotNil(t, client)

	assert.Equal(t, client.baseURL.String(), "http://tempo-server:8080")
}

func TestTempoURLConstructionWithoutTenant(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = "http://tempo-server:8080"
	// No tenant configured

	// The client should be created successfully without URL modification
	client, err := NewClient(context.Background(), conf, token, false)

	// The client should be created successfully
	assert.Nil(t, err)
	assert.NotNil(t, client)

	assert.Equal(t, "http://tempo-server:8080", client.baseURL.String())
}

func TestTempoURLConstructionWithTenantAndCompleteURL(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = "http://tempo-server:8080/api/traces/v1/my-tenant/tempo"
	// No tenant configured

	// The client should be created successfully without URL modification
	client, err := NewClient(context.Background(), conf, token, false)

	// The client should be created successfully
	assert.Nil(t, err)
	assert.NotNil(t, client)

	assert.Equal(t, "http://tempo-server:8080/api/traces/v1/my-tenant/tempo", client.baseURL.String())
}
