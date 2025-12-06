package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSecretOverride_StandardValueFile tests that secrets mounted as "value.txt" are detected and used
func TestSecretOverride_StandardValueFile(t *testing.T) {
	// Create temporary config file
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
external_services:
  prometheus:
    url: http://prometheus:9090
    auth:
      type: bearer
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secret directory structure
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")
	prometheusTokenDir := filepath.Join(secretsBaseDir, "prometheus-token")
	err = os.MkdirAll(prometheusTokenDir, 0755)
	require.NoError(t, err)

	// Write secret value
	tokenFile := filepath.Join(prometheusTokenDir, "value.txt")
	err = os.WriteFile(tokenFile, []byte("my-prometheus-token"), 0600)
	require.NoError(t, err)

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify that Token was set to the file path
	assert.Equal(t, tokenFile, conf.ExternalServices.Prometheus.Auth.Token,
		"Expected Token to be set to the secret file path")

	// Verify we can read the token from the file
	token, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, "my-prometheus-token", token)
}

// TestSecretOverride_CertFileWithKeyName tests that certificate files preserve the key name from secret:name:key pattern
// Note: ca_file is deprecated and is no longer processed via secret overrides.
// Only cert_file and key_file are tested here.
func TestSecretOverride_CertFileWithKeyName(t *testing.T) {
	// Create temporary config file with secret: pattern
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
external_services:
  prometheus:
    url: http://prometheus:9090
    auth:
      type: none
      cert_file: secret:prometheus-cert:tls.crt
      key_file: secret:prometheus-key:tls.key
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secret directory structure
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")

	// Create cert file with specific key name
	certDir := filepath.Join(secretsBaseDir, "prometheus-cert")
	err = os.MkdirAll(certDir, 0755)
	require.NoError(t, err)
	certFile := filepath.Join(certDir, "tls.crt")
	err = os.WriteFile(certFile, []byte("CERT-CONTENT"), 0600)
	require.NoError(t, err)

	// Create key file with specific key name
	keyDir := filepath.Join(secretsBaseDir, "prometheus-key")
	err = os.MkdirAll(keyDir, 0755)
	require.NoError(t, err)
	keyFile := filepath.Join(keyDir, "tls.key")
	err = os.WriteFile(keyFile, []byte("KEY-CONTENT"), 0600)
	require.NoError(t, err)

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify that certificate files were set to the paths with preserved key names
	assert.Equal(t, certFile, conf.ExternalServices.Prometheus.Auth.CertFile,
		"Expected CertFile to preserve key name 'tls.crt'")
	assert.Equal(t, keyFile, conf.ExternalServices.Prometheus.Auth.KeyFile,
		"Expected KeyFile to preserve key name 'tls.key'")

	// Verify we can read the content
	certContent, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.CertFile)
	assert.NoError(t, err)
	assert.Equal(t, "CERT-CONTENT", certContent)

	keyContent, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.KeyFile)
	assert.NoError(t, err)
	assert.Equal(t, "KEY-CONTENT", keyContent)
}

// TestSecretOverride_FallbackToValueFile tests that if specific key file doesn't exist, falls back to value.txt
func TestSecretOverride_FallbackToValueFile(t *testing.T) {
	// Create temporary config file with secret: pattern
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
external_services:
  grafana:
    url: http://grafana:3000
    auth:
      type: basic
      username: secret:grafana-user:username
      password: secret:grafana-pass:password
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secret directory structure
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")

	// For username, create only value.txt (not the specific key name)
	usernameDir := filepath.Join(secretsBaseDir, "grafana-username")
	err = os.MkdirAll(usernameDir, 0755)
	require.NoError(t, err)
	usernameFile := filepath.Join(usernameDir, "value.txt")
	err = os.WriteFile(usernameFile, []byte("grafana-user"), 0600)
	require.NoError(t, err)

	// For password, create only value.txt (not the specific key name)
	passwordDir := filepath.Join(secretsBaseDir, "grafana-password")
	err = os.MkdirAll(passwordDir, 0755)
	require.NoError(t, err)
	passwordFile := filepath.Join(passwordDir, "value.txt")
	err = os.WriteFile(passwordFile, []byte("grafana-pass"), 0600)
	require.NoError(t, err)

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify that credentials fell back to value.txt
	assert.Equal(t, usernameFile, conf.ExternalServices.Grafana.Auth.Username,
		"Expected Username to fall back to value.txt")
	assert.Equal(t, passwordFile, conf.ExternalServices.Grafana.Auth.Password,
		"Expected Password to fall back to value.txt")

	// Verify we can read the credentials
	username, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Username)
	assert.NoError(t, err)
	assert.Equal(t, "grafana-user", username)

	password, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Password)
	assert.NoError(t, err)
	assert.Equal(t, "grafana-pass", password)
}

// TestSecretOverride_NoSecretMounted tests that when no secret is mounted, literal value is preserved
func TestSecretOverride_NoSecretMounted(t *testing.T) {
	// Create temporary config file with literal values
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
external_services:
  prometheus:
    url: http://prometheus:9090
    auth:
      type: bearer
      token: my-literal-token
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secrets directory but DON'T create the token secret
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")
	err = os.MkdirAll(secretsBaseDir, 0755)
	require.NoError(t, err)

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify that Token still has the literal value (not overridden)
	assert.Equal(t, "my-literal-token", conf.ExternalServices.Prometheus.Auth.Token,
		"Expected Token to remain as literal value when no secret is mounted")

	// Verify we can read the literal token
	token, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, "my-literal-token", token)
}

// TestSecretOverride_MultipleServices tests that overrides work for multiple services
func TestSecretOverride_MultipleServices(t *testing.T) {
	// Create temporary config file
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
external_services:
  prometheus:
    url: http://prometheus:9090
    auth:
      type: bearer
  grafana:
    url: http://grafana:3000
    auth:
      type: basic
  tracing:
    enabled: true
    auth:
      type: bearer
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secret directory structure for all services
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")

	// Prometheus token
	prometheusTokenDir := filepath.Join(secretsBaseDir, "prometheus-token")
	err = os.MkdirAll(prometheusTokenDir, 0755)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(prometheusTokenDir, "value.txt"), []byte("prom-token"), 0600)
	require.NoError(t, err)

	// Grafana username
	grafanaUsernameDir := filepath.Join(secretsBaseDir, "grafana-username")
	err = os.MkdirAll(grafanaUsernameDir, 0755)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(grafanaUsernameDir, "value.txt"), []byte("graf-user"), 0600)
	require.NoError(t, err)

	// Grafana password
	grafanaPasswordDir := filepath.Join(secretsBaseDir, "grafana-password")
	err = os.MkdirAll(grafanaPasswordDir, 0755)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(grafanaPasswordDir, "value.txt"), []byte("graf-pass"), 0600)
	require.NoError(t, err)

	// Tracing token
	tracingTokenDir := filepath.Join(secretsBaseDir, "tracing-token")
	err = os.MkdirAll(tracingTokenDir, 0755)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(tracingTokenDir, "value.txt"), []byte("trace-token"), 0600)
	require.NoError(t, err)

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify all services have their secrets configured
	promToken, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, "prom-token", promToken)

	grafUsername, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Username)
	assert.NoError(t, err)
	assert.Equal(t, "graf-user", grafUsername)

	grafPassword, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Password)
	assert.NoError(t, err)
	assert.Equal(t, "graf-pass", grafPassword)

	traceToken, err := conf.GetCredential(conf.ExternalServices.Tracing.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, "trace-token", traceToken)
}
