package tracing

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

// TestTracingBasicAuthFromFiles tests that tracing client properly reads basic auth credentials from files
func TestTracingBasicAuthFromFiles(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	usernameFile := tmpDir + "/username"
	passwordFile := tmpDir + "/password"

	// Write initial credentials
	initialUsername := "tracing-user1"
	initialPassword := "tracing-pass1"
	err = os.WriteFile(usernameFile, []byte(initialUsername), 0600)
	require.NoError(t, err)
	err = os.WriteFile(passwordFile, []byte(initialPassword), 0600)
	require.NoError(t, err)

	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "tempo"
	conf.ExternalServices.Tracing.UseGRPC = true
	conf.ExternalServices.Tracing.InternalURL = "http://tempo-server:9095"
	conf.ExternalServices.Tracing.Auth.Type = config.AuthTypeBasic
	conf.ExternalServices.Tracing.Auth.Username = usernameFile
	conf.ExternalServices.Tracing.Auth.Password = passwordFile

	// Create client - this should succeed without trying to connect
	client, err := NewClient(context.Background(), conf, "test-token", true)
	assert.NoError(t, err)
	assert.NotNil(t, client)
	assert.NotNil(t, client.grpcClient, "gRPC client should be created for tempo with UseGRPC=true")

	// Verify that the auth credentials can be read
	username, err := conf.GetCredential(conf.ExternalServices.Tracing.Auth.Username)
	assert.NoError(t, err)
	assert.Equal(t, initialUsername, username)

	password, err := conf.GetCredential(conf.ExternalServices.Tracing.Auth.Password)
	assert.NoError(t, err)
	assert.Equal(t, initialPassword, password)

	// Rotate credentials
	rotatedUsername := "tracing-user2"
	rotatedPassword := "tracing-pass2"
	err = os.WriteFile(usernameFile, []byte(rotatedUsername), 0600)
	require.NoError(t, err)
	err = os.WriteFile(passwordFile, []byte(rotatedPassword), 0600)
	require.NoError(t, err)

	// Wait for fsnotify to detect changes and update cache (up to 2 seconds)
	usernameRotated := false
	passwordRotated := false
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		username, _ = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Username)
		password, _ = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Password)
		if username == rotatedUsername {
			usernameRotated = true
		}
		if password == rotatedPassword {
			passwordRotated = true
		}
		if usernameRotated && passwordRotated {
			break
		}
	}

	// Verify rotated credentials can be read (simulates what happens on next request)
	username, err = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Username)
	assert.NoError(t, err)
	assert.Equal(t, rotatedUsername, username, "Username should be rotated")

	password, err = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Password)
	assert.NoError(t, err)
	assert.Equal(t, rotatedPassword, password, "Password should be rotated")
}

// TestTracingBearerTokenFromFile tests that tracing client properly reads bearer token from file
func TestTracingBearerTokenFromFile(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	tokenFile := tmpDir + "/token"

	// Write initial token
	initialToken := "initial-tracing-token-12345"
	err = os.WriteFile(tokenFile, []byte(initialToken), 0600)
	require.NoError(t, err)

	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = "http://jaeger-server:16686/jaeger"
	conf.ExternalServices.Tracing.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Tracing.Auth.Token = tokenFile

	// Create client - this should succeed without trying to connect
	client, err := NewClient(context.Background(), conf, "test-token", true)
	assert.NoError(t, err)
	assert.NotNil(t, client)

	// Verify that the token can be read
	token, err := conf.GetCredential(conf.ExternalServices.Tracing.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, initialToken, token)

	// Rotate token
	rotatedToken := "rotated-tracing-token-67890"
	err = os.WriteFile(tokenFile, []byte(rotatedToken), 0600)
	require.NoError(t, err)

	// Wait for fsnotify to detect change and update cache (up to 2 seconds)
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		token, _ = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Token)
		if token == rotatedToken {
			break
		}
	}

	// Verify rotated token can be read
	token, err = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, rotatedToken, token, "Token should be rotated")
}

// TestTracingBearerTokenWithWhitespace tests that tracing properly trims whitespace from token files
func TestTracingBearerTokenWithWhitespace(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	tokenFile := tmpDir + "/token"

	// Write token with trailing newline (common when using echo or kubectl)
	tokenWithNewline := "my-token-with-newline\n"
	err = os.WriteFile(tokenFile, []byte(tokenWithNewline), 0600)
	require.NoError(t, err)

	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Tracing.Auth.Token = tokenFile

	// Verify that the token is trimmed
	token, err := conf.GetCredential(conf.ExternalServices.Tracing.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, "my-token-with-newline", token, "Token should be trimmed of whitespace")
	assert.NotContains(t, token, "\n", "Token should not contain newlines")
	assert.NotContains(t, token, " ", "Token should not contain leading/trailing spaces")
}

// TestTracingLiteralCredentials tests backward compatibility with literal credential values
func TestTracingLiteralCredentials(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.Auth.Type = config.AuthTypeBasic
	conf.ExternalServices.Tracing.Auth.Username = "literal-user"
	conf.ExternalServices.Tracing.Auth.Password = "literal-password"

	// Create client
	client, err := NewClient(context.Background(), conf, "test-token", true)
	assert.NoError(t, err)
	assert.NotNil(t, client)

	// Verify literal values are returned as-is
	username, err := conf.GetCredential(conf.ExternalServices.Tracing.Auth.Username)
	assert.NoError(t, err)
	assert.Equal(t, "literal-user", username)

	password, err := conf.GetCredential(conf.ExternalServices.Tracing.Auth.Password)
	assert.NoError(t, err)
	assert.Equal(t, "literal-password", password)
}
