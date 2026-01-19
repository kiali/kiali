package config

import (
	"os"
	"path/filepath"
	"strings"
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
	prometheusTokenDir := filepath.Join(secretsBaseDir, SecretFilePrometheusToken)
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
	assert.Equal(t, Credential(tokenFile), conf.ExternalServices.Prometheus.Auth.Token,
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
	certDir := filepath.Join(secretsBaseDir, SecretFilePrometheusCert)
	err = os.MkdirAll(certDir, 0755)
	require.NoError(t, err)
	certFile := filepath.Join(certDir, "tls.crt")
	err = os.WriteFile(certFile, []byte("CERT-CONTENT"), 0600)
	require.NoError(t, err)

	// Create key file with specific key name
	keyDir := filepath.Join(secretsBaseDir, SecretFilePrometheusKey)
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
	assert.Equal(t, Credential(certFile), conf.ExternalServices.Prometheus.Auth.CertFile,
		"Expected CertFile to preserve key name 'tls.crt'")
	assert.Equal(t, Credential(keyFile), conf.ExternalServices.Prometheus.Auth.KeyFile,
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
	usernameDir := filepath.Join(secretsBaseDir, SecretFileGrafanaUsername)
	err = os.MkdirAll(usernameDir, 0755)
	require.NoError(t, err)
	usernameFile := filepath.Join(usernameDir, "value.txt")
	err = os.WriteFile(usernameFile, []byte("grafana-user"), 0600)
	require.NoError(t, err)

	// For password, create only value.txt (not the specific key name)
	passwordDir := filepath.Join(secretsBaseDir, SecretFileGrafanaPassword)
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
	assert.Equal(t, Credential(usernameFile), conf.ExternalServices.Grafana.Auth.Username,
		"Expected Username to fall back to value.txt")
	assert.Equal(t, Credential(passwordFile), conf.ExternalServices.Grafana.Auth.Password,
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
	assert.Equal(t, Credential("my-literal-token"), conf.ExternalServices.Prometheus.Auth.Token,
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
	prometheusTokenDir := filepath.Join(secretsBaseDir, SecretFilePrometheusToken)
	err = os.MkdirAll(prometheusTokenDir, 0755)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(prometheusTokenDir, "value.txt"), []byte("prom-token"), 0600)
	require.NoError(t, err)

	// Grafana username
	grafanaUsernameDir := filepath.Join(secretsBaseDir, SecretFileGrafanaUsername)
	err = os.MkdirAll(grafanaUsernameDir, 0755)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(grafanaUsernameDir, "value.txt"), []byte("graf-user"), 0600)
	require.NoError(t, err)

	// Grafana password
	grafanaPasswordDir := filepath.Join(secretsBaseDir, SecretFileGrafanaPassword)
	err = os.MkdirAll(grafanaPasswordDir, 0755)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(grafanaPasswordDir, "value.txt"), []byte("graf-pass"), 0600)
	require.NoError(t, err)

	// Tracing token
	tracingTokenDir := filepath.Join(secretsBaseDir, SecretFileTracingToken)
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

// TestSecretOverride_AllCredentials tests that ALL secret overrides work correctly.
// This is a comprehensive test that covers every credential type for every service.
func TestSecretOverride_AllCredentials(t *testing.T) {
	// Define all secret overrides with their corresponding config accessor
	type secretTest struct {
		secretFileName string
		expectedValue  string
		getConfigValue func(*Config) Credential
	}

	tests := []secretTest{
		// Prometheus
		{SecretFilePrometheusUsername, "xyz-prom-user", func(c *Config) Credential { return c.ExternalServices.Prometheus.Auth.Username }},
		{SecretFilePrometheusPassword, "xyz-prom-pass", func(c *Config) Credential { return c.ExternalServices.Prometheus.Auth.Password }},
		{SecretFilePrometheusToken, "xyz-prom-token", func(c *Config) Credential { return c.ExternalServices.Prometheus.Auth.Token }},
		{SecretFilePrometheusCert, "xyz-prom-cert", func(c *Config) Credential { return c.ExternalServices.Prometheus.Auth.CertFile }},
		{SecretFilePrometheusKey, "xyz-prom-key", func(c *Config) Credential { return c.ExternalServices.Prometheus.Auth.KeyFile }},
		// Grafana
		{SecretFileGrafanaUsername, "xyz-graf-user", func(c *Config) Credential { return c.ExternalServices.Grafana.Auth.Username }},
		{SecretFileGrafanaPassword, "xyz-graf-pass", func(c *Config) Credential { return c.ExternalServices.Grafana.Auth.Password }},
		{SecretFileGrafanaToken, "xyz-graf-token", func(c *Config) Credential { return c.ExternalServices.Grafana.Auth.Token }},
		{SecretFileGrafanaCert, "xyz-graf-cert", func(c *Config) Credential { return c.ExternalServices.Grafana.Auth.CertFile }},
		{SecretFileGrafanaKey, "xyz-graf-key", func(c *Config) Credential { return c.ExternalServices.Grafana.Auth.KeyFile }},
		// Tracing
		{SecretFileTracingUsername, "xyz-trace-user", func(c *Config) Credential { return c.ExternalServices.Tracing.Auth.Username }},
		{SecretFileTracingPassword, "xyz-trace-pass", func(c *Config) Credential { return c.ExternalServices.Tracing.Auth.Password }},
		{SecretFileTracingToken, "xyz-trace-token", func(c *Config) Credential { return c.ExternalServices.Tracing.Auth.Token }},
		{SecretFileTracingCert, "xyz-trace-cert", func(c *Config) Credential { return c.ExternalServices.Tracing.Auth.CertFile }},
		{SecretFileTracingKey, "xyz-trace-key", func(c *Config) Credential { return c.ExternalServices.Tracing.Auth.KeyFile }},
		// Perses
		{SecretFilePersesUsername, "xyz-perses-user", func(c *Config) Credential { return c.ExternalServices.Perses.Auth.Username }},
		{SecretFilePersesPassword, "xyz-perses-pass", func(c *Config) Credential { return c.ExternalServices.Perses.Auth.Password }},
		{SecretFilePersesCert, "xyz-perses-cert", func(c *Config) Credential { return c.ExternalServices.Perses.Auth.CertFile }},
		{SecretFilePersesKey, "xyz-perses-key", func(c *Config) Credential { return c.ExternalServices.Perses.Auth.KeyFile }},
		// Custom Dashboards Prometheus
		{SecretFileCustomDashboardsPrometheusUsername, "xyz-cd-prom-user", func(c *Config) Credential { return c.ExternalServices.CustomDashboards.Prometheus.Auth.Username }},
		{SecretFileCustomDashboardsPrometheusPassword, "xyz-cd-prom-pass", func(c *Config) Credential { return c.ExternalServices.CustomDashboards.Prometheus.Auth.Password }},
		{SecretFileCustomDashboardsPrometheusToken, "xyz-cd-prom-token", func(c *Config) Credential { return c.ExternalServices.CustomDashboards.Prometheus.Auth.Token }},
		{SecretFileCustomDashboardsPrometheusCert, "xyz-cd-prom-cert", func(c *Config) Credential { return c.ExternalServices.CustomDashboards.Prometheus.Auth.CertFile }},
		{SecretFileCustomDashboardsPrometheusKey, "xyz-cd-prom-key", func(c *Config) Credential { return c.ExternalServices.CustomDashboards.Prometheus.Auth.KeyFile }},
		// Login Token Signing Key
		{SecretFileLoginTokenSigningKey, "xyz-16-byte-sign", func(c *Config) Credential { return c.LoginToken.SigningKey }},
	}

	// Create temporary directories
	tmpDir := t.TempDir()
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")

	// Create all secret files
	for _, test := range tests {
		dir := filepath.Join(secretsBaseDir, test.secretFileName)
		require.NoError(t, os.MkdirAll(dir, 0755))
		require.NoError(t, os.WriteFile(filepath.Join(dir, "value.txt"), []byte(test.expectedValue), 0600))
	}

	// Create minimal config file
	configFile := filepath.Join(tmpDir, "config.yaml")
	require.NoError(t, os.WriteFile(configFile, []byte("server:\n  port: 20001\n"), 0600))

	// Temporarily override the package-level overrideSecretsDir variable for this test
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)

	// Verify all credentials
	for _, test := range tests {
		configValue := test.getConfigValue(conf)

		// Verify the override mechanism set the config value to a file path (not a literal)
		assert.True(t, strings.HasPrefix(configValue.String(), secretsBaseDir),
			"Expected [%s] config value to be a file path under [%s], got: [%s]", test.secretFileName, secretsBaseDir, configValue)

		// Verify GetCredential reads the file and returns the expected content
		credential, err := conf.GetCredential(configValue)
		assert.NoError(t, err, "GetCredential failed for %s", test.secretFileName)
		assert.Equal(t, test.expectedValue, credential, "Value mismatch for %s", test.secretFileName)
	}
}

// TestSecretOverride_ChatAIProviderKey tests that chat_ai provider key secrets are detected and used
func TestSecretOverride_ChatAIProviderKey(t *testing.T) {
	// Create temporary config file with chat_ai provider
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
chat_ai:
  enabled: true
  default_provider: openai
  providers:
  - name: openai
    type: openai
    config: default
    enabled: true
    default_model: gpt4
    models:
    - name: gpt4
      model: gpt-4
      enabled: true
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secret directory structure
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")
	providerSecretDir := filepath.Join(secretsBaseDir, chatAIProviderSecretFileName("openai"))
	err = os.MkdirAll(providerSecretDir, 0755)
	require.NoError(t, err)

	// Write secret value
	secretFile := filepath.Join(providerSecretDir, "value.txt")
	err = os.WriteFile(secretFile, []byte("my-openai-api-key"), 0600)
	require.NoError(t, err)

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify that provider Key was set to the file path
	require.Len(t, conf.ChatAI.Providers, 1)
	assert.Equal(t, Credential(secretFile), conf.ChatAI.Providers[0].Key,
		"Expected provider Key to be set to the secret file path")

	// Verify we can read the key from the file
	key, err := conf.GetCredential(conf.ChatAI.Providers[0].Key)
	assert.NoError(t, err)
	assert.Equal(t, "my-openai-api-key", key)
}

// TestSecretOverride_ChatAIModelKey tests that chat_ai model key secrets are detected and used
func TestSecretOverride_ChatAIModelKey(t *testing.T) {
	// Create temporary config file with chat_ai model
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
chat_ai:
  enabled: true
  default_provider: openai
  providers:
  - name: openai
    type: openai
    config: default
    enabled: true
    default_model: gpt4
    models:
    - name: gpt4
      model: gpt-4
      enabled: true
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secret directory structure
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")
	modelSecretDir := filepath.Join(secretsBaseDir, chatAIModelSecretFileName("openai", "gpt4"))
	err = os.MkdirAll(modelSecretDir, 0755)
	require.NoError(t, err)

	// Write secret value
	secretFile := filepath.Join(modelSecretDir, "value.txt")
	err = os.WriteFile(secretFile, []byte("my-gpt4-model-key"), 0600)
	require.NoError(t, err)

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify that model Key was set to the file path
	require.Len(t, conf.ChatAI.Providers, 1)
	require.Len(t, conf.ChatAI.Providers[0].Models, 1)
	assert.Equal(t, Credential(secretFile), conf.ChatAI.Providers[0].Models[0].Key,
		"Expected model Key to be set to the secret file path")

	// Verify we can read the key from the file
	key, err := conf.GetCredential(conf.ChatAI.Providers[0].Models[0].Key)
	assert.NoError(t, err)
	assert.Equal(t, "my-gpt4-model-key", key)
}

// TestSecretOverride_ChatAIMultiple tests that multiple chat_ai provider and model secrets work together
func TestSecretOverride_ChatAIMultiple(t *testing.T) {
	// Create temporary config file with multiple providers and models
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
chat_ai:
  enabled: true
  default_provider: openai
  providers:
  - name: openai
    type: openai
    config: default
    enabled: true
    default_model: gpt4
    models:
    - name: gpt4
      model: gpt-4
      enabled: true
    - name: gpt35
      model: gpt-3.5-turbo
      enabled: true
  - name: azure
    type: openai
    config: azure
    enabled: true
    default_model: azure-gpt4
    models:
    - name: azure-gpt4
      model: gpt-4
      enabled: true
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secret directory structure
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")

	// Create provider-level key for openai
	openaiProviderDir := filepath.Join(secretsBaseDir, chatAIProviderSecretFileName("openai"))
	require.NoError(t, os.MkdirAll(openaiProviderDir, 0755))
	openaiProviderFile := filepath.Join(openaiProviderDir, "value.txt")
	require.NoError(t, os.WriteFile(openaiProviderFile, []byte("openai-provider-key"), 0600))

	// Create model-level key for gpt35 (overrides provider key)
	gpt35ModelDir := filepath.Join(secretsBaseDir, chatAIModelSecretFileName("openai", "gpt35"))
	require.NoError(t, os.MkdirAll(gpt35ModelDir, 0755))
	gpt35ModelFile := filepath.Join(gpt35ModelDir, "value.txt")
	require.NoError(t, os.WriteFile(gpt35ModelFile, []byte("gpt35-model-key"), 0600))

	// Create provider-level key for azure
	azureProviderDir := filepath.Join(secretsBaseDir, chatAIProviderSecretFileName("azure"))
	require.NoError(t, os.MkdirAll(azureProviderDir, 0755))
	azureProviderFile := filepath.Join(azureProviderDir, "value.txt")
	require.NoError(t, os.WriteFile(azureProviderFile, []byte("azure-provider-key"), 0600))

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify openai provider key
	require.Len(t, conf.ChatAI.Providers, 2)
	openaiKey, err := conf.GetCredential(conf.ChatAI.Providers[0].Key)
	assert.NoError(t, err)
	assert.Equal(t, "openai-provider-key", openaiKey)

	// Verify gpt35 model key (model-level override)
	require.Len(t, conf.ChatAI.Providers[0].Models, 2)
	gpt35Key, err := conf.GetCredential(conf.ChatAI.Providers[0].Models[1].Key)
	assert.NoError(t, err)
	assert.Equal(t, "gpt35-model-key", gpt35Key)

	// Verify azure provider key
	azureKey, err := conf.GetCredential(conf.ChatAI.Providers[1].Key)
	assert.NoError(t, err)
	assert.Equal(t, "azure-provider-key", azureKey)
}

// TestSecretOverride_ChatAISanitization tests that provider/model names are sanitized correctly
func TestSecretOverride_ChatAISanitization(t *testing.T) {
	// Create temporary config file with names that need sanitization
	tmpDir := t.TempDir()
	configFile := filepath.Join(tmpDir, "config.yaml")
	configContent := `
server:
  port: 20001
chat_ai:
  enabled: true
  default_provider: My_Provider
  providers:
  - name: My_Provider
    type: openai
    config: default
    enabled: true
    default_model: My Model
    models:
    - name: My Model
      model: test-model
      enabled: true
`
	err := os.WriteFile(configFile, []byte(configContent), 0600)
	require.NoError(t, err)

	// Create temporary secret directory structure
	// Names should be sanitized: "My_Provider" -> "my-provider", "My Model" -> "my-model"
	secretsBaseDir := filepath.Join(tmpDir, "kiali-override-secrets")
	providerSecretDir := filepath.Join(secretsBaseDir, chatAIProviderSecretFileName("My_Provider"))
	err = os.MkdirAll(providerSecretDir, 0755)
	require.NoError(t, err)

	// Verify the sanitization produces expected directory name
	expectedProviderDir := "chat-ai-provider-my-provider"
	assert.Equal(t, expectedProviderDir, chatAIProviderSecretFileName("My_Provider"),
		"Provider name sanitization mismatch")

	expectedModelDir := "chat-ai-model-my-provider-my-model"
	assert.Equal(t, expectedModelDir, chatAIModelSecretFileName("My_Provider", "My Model"),
		"Model name sanitization mismatch")

	// Write secret value
	secretFile := filepath.Join(providerSecretDir, "value.txt")
	err = os.WriteFile(secretFile, []byte("sanitized-key"), 0600)
	require.NoError(t, err)

	// Temporarily override the secrets directory
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = secretsBaseDir
	defer func() { overrideSecretsDir = originalSecretsDir }()

	// Load config
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	require.NotNil(t, conf)

	// Verify that provider Key was set to the file path with sanitized name
	require.Len(t, conf.ChatAI.Providers, 1)
	key, err := conf.GetCredential(conf.ChatAI.Providers[0].Key)
	assert.NoError(t, err)
	assert.Equal(t, "sanitized-key", key)
}
