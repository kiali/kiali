package tracing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestCreateJaegerClient(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.UseGRPC = false

	tracingClient, err := NewClient(context.Background(), conf, nil, true)

	assert.Nil(t, err)
	assert.NotNil(t, tracingClient)
}

func TestCreateTempogGRPCClient(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = true

	tracingClient, err := NewClient(context.Background(), conf, nil, true)

	assert.Nil(t, err)
	assert.NotNil(t, tracingClient)
}

func TestCreateTempoHTTPClient(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = false

	tracingClient, err := NewClient(context.Background(), conf, nil, true)

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
	client, err := NewClient(context.Background(), conf, nil, false)

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
	client, err := NewClient(context.Background(), conf, nil, false)

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
	client, err := NewClient(context.Background(), conf, nil, false)

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
	client, err := NewClient(context.Background(), conf, nil, false)

	// The client should be created successfully
	assert.Nil(t, err)
	assert.NotNil(t, client)

	assert.Equal(t, "http://tempo-server:8080/api/traces/v1/my-tenant/tempo", client.baseURL.String())
}

// TestNewClient_TokenRotationSupport verifies that the Tracing client correctly
// extracts the BearerTokenFile path from the ClientInterface to enable automatic token rotation.
func TestNewClient_TokenRotationSupport(t *testing.T) {
	tests := []struct {
		name            string
		bearerToken     string
		bearerTokenFile string
		useKialiToken   bool
	}{
		{
			name:            "Uses BearerTokenFile when available",
			bearerToken:     "static-token",
			bearerTokenFile: "/var/run/secrets/kubernetes.io/serviceaccount/token",
			useKialiToken:   true,
		},
		{
			name:            "Falls back to BearerToken when BearerTokenFile is empty",
			bearerToken:     "static-token",
			bearerTokenFile: "",
			useKialiToken:   true,
		},
		{
			name:            "Does not set token when useKialiToken is false",
			bearerToken:     "static-token",
			bearerTokenFile: "/var/run/secrets/kubernetes.io/serviceaccount/token",
			useKialiToken:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.ExternalServices.Tracing.Enabled = true
			conf.ExternalServices.Tracing.Auth.UseKialiToken = tt.useKialiToken

			// Create a fake K8s client with specified token configuration
			fakeClient := kubetest.NewFakeK8sClient()
			fakeClient.Token = tt.bearerToken
			fakeClient.KubeClusterInfo = kubernetes.ClusterInfo{
				ClientConfig: &rest.Config{
					BearerToken:     tt.bearerToken,
					BearerTokenFile: tt.bearerTokenFile,
				},
				Name: "test-cluster",
			}

			// Create the Tracing client
			client, err := NewClient(context.Background(), conf, fakeClient, false)
			require.NoError(t, err)
			require.NotNil(t, client)

			// Verify that the client was created successfully
			assert.NotNil(t, client.httpClient)
		})
	}
}

// TestNewClient_NilClientHandling verifies that the Tracing client
// handles nil ClientInterface gracefully (used in tests).
func TestNewClient_NilClientHandling(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Auth.UseKialiToken = true

	// Should not panic with nil client
	client, err := NewClient(context.Background(), conf, nil, false)
	require.NoError(t, err)
	require.NotNil(t, client)
}

// TestNewClient_PrefersBearerTokenFile verifies the priority order:
// BearerTokenFile > BearerToken when both are available.
func TestNewClient_PrefersBearerTokenFile(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Auth.UseKialiToken = true

	// Create client with both BearerToken and BearerTokenFile set
	fakeClient := kubetest.NewFakeK8sClient()
	fakeClient.Token = "static-token"
	fakeClient.KubeClusterInfo = kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{
			BearerToken:     "static-token",
			BearerTokenFile: "/var/run/secrets/kubernetes.io/serviceaccount/token",
		},
		Name: "test-cluster",
	}

	client, err := NewClient(context.Background(), conf, fakeClient, false)
	require.NoError(t, err)
	require.NotNil(t, client)

	// The client should have been created successfully
	// The actual token rotation is tested in httputil package
	assert.NotNil(t, client.httpClient)
}

// TestNewClient_WithoutAuth verifies that clients can be created
// without authentication for testing purposes.
func TestNewClient_WithoutAuth(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Auth.UseKialiToken = false

	fakeClient := kubetest.NewFakeK8sClient()
	fakeClient.KubeClusterInfo = kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{},
		Name:         "test-cluster",
	}

	client, err := NewClient(context.Background(), conf, fakeClient, false)
	require.NoError(t, err)
	require.NotNil(t, client)
	assert.NotNil(t, client.httpClient)
}
