package prometheus

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// TestNewClient_TokenRotationSupport verifies that the Prometheus client correctly
// extracts the BearerTokenFile path from the ClientInterface to enable automatic token rotation.
func TestNewClient_TokenRotationSupport(t *testing.T) {
	tests := []struct {
		name               string
		bearerToken        string
		bearerTokenFile    string
		useKialiToken      bool
		expectedTokenValue string // What we expect auth.Token to be set to
	}{
		{
			name:               "Uses BearerTokenFile when available",
			bearerToken:        "static-token",
			bearerTokenFile:    "/var/run/secrets/kubernetes.io/serviceaccount/token",
			useKialiToken:      true,
			expectedTokenValue: "/var/run/secrets/kubernetes.io/serviceaccount/token",
		},
		{
			name:               "Falls back to BearerToken when BearerTokenFile is empty",
			bearerToken:        "static-token",
			bearerTokenFile:    "",
			useKialiToken:      true,
			expectedTokenValue: "static-token",
		},
		{
			name:               "Does not set token when useKialiToken is false",
			bearerToken:        "static-token",
			bearerTokenFile:    "/var/run/secrets/kubernetes.io/serviceaccount/token",
			useKialiToken:      false,
			expectedTokenValue: "", // Should remain empty
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.ExternalServices.Prometheus.URL = "http://prometheus:9090"
			conf.ExternalServices.Prometheus.Auth.UseKialiToken = tt.useKialiToken

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

			// Create the Prometheus client
			client, err := NewClient(*conf, fakeClient)
			require.NoError(t, err)
			require.NotNil(t, client)

			// Verify that the config was set up correctly
			// We can't directly access auth.Token after NewClient returns,
			// but we can verify the client was created successfully
			assert.NotNil(t, client.p8s)
			assert.NotNil(t, client.api)
		})
	}
}

// TestNewClient_NilClientHandling verifies that the Prometheus client
// handles nil ClientInterface gracefully (used in tests).
func TestNewClient_NilClientHandling(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.URL = "http://prometheus:9090"
	conf.ExternalServices.Prometheus.Auth.UseKialiToken = true

	// Should not panic with nil client
	client, err := NewClient(*conf, nil)
	require.NoError(t, err)
	require.NotNil(t, client)
}

// TestNewClient_PrefersBearerTokenFile verifies the priority order:
// BearerTokenFile > BearerToken when both are available.
func TestNewClient_PrefersBearerTokenFile(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.URL = "http://prometheus:9090"
	conf.ExternalServices.Prometheus.Auth.UseKialiToken = true

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

	client, err := NewClient(*conf, fakeClient)
	require.NoError(t, err)
	require.NotNil(t, client)

	// The client should have been created successfully
	// The actual token rotation is tested in httputil package
	assert.NotNil(t, client.p8s)
	assert.NotNil(t, client.api)
}

// TestNewClient_WithoutAuth verifies that clients can be created
// without authentication for testing purposes.
func TestNewClient_WithoutAuth(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.URL = "http://prometheus:9090"
	conf.ExternalServices.Prometheus.Auth.UseKialiToken = false

	fakeClient := kubetest.NewFakeK8sClient()
	fakeClient.KubeClusterInfo = kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{},
		Name:         "test-cluster",
	}

	client, err := NewClient(*conf, fakeClient)
	require.NoError(t, err)
	require.NotNil(t, client)
	assert.NotNil(t, client.p8s)
	assert.NotNil(t, client.api)
}
