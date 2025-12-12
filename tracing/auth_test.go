package tracing

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/certtest"
	"github.com/kiali/kiali/util/polltest"
)

// TestTracingBasicAuthFromFiles tests that tracing client properly reads basic auth credentials from files
func TestTracingBasicAuthFromFiles(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
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
	rotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		username, _ = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Username)
		password, _ = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Password)
		return username == rotatedUsername && password == rotatedPassword
	})
	assert.True(t, rotated, "Credentials should be rotated")

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
	conf.Credentials, err = config.NewCredentialManager(nil)
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
	rotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		token, _ = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Token)
		return token == rotatedToken
	})
	assert.True(t, rotated, "Token should be rotated")

	// Verify rotated token can be read
	token, err = conf.GetCredential(conf.ExternalServices.Tracing.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, rotatedToken, token, "Token should be rotated")
}

// TestTracingBearerTokenWithWhitespace tests that tracing properly trims whitespace from token files
func TestTracingBearerTokenWithWhitespace(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
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

// TestTracingUseKialiToken tests that when UseKialiToken is set, client creation succeeds
// and the kiali token is used internally (the config's Auth.Token is NOT modified - a local copy is used)
func TestTracingUseKialiToken(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.InternalURL = "http://jaeger-server:16686/jaeger"
	conf.ExternalServices.Tracing.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Tracing.Auth.UseKialiToken = true
	// Leave Auth.Token empty to verify kiali token is used internally
	conf.ExternalServices.Tracing.Auth.Token = ""

	kialiToken := "kiali-user-token-12345"

	// Create client with the kiali token - this should succeed even though Auth.Token is empty
	// because UseKialiToken=true causes the passed kialiToken to be used internally
	client, err := NewClient(context.Background(), conf, kialiToken, true)
	assert.NoError(t, err)
	assert.NotNil(t, client)

	// The config's Auth.Token should remain unchanged (empty) because newClient
	// creates a local copy of auth and modifies that copy, not the original config
	assert.Equal(t, "", conf.ExternalServices.Tracing.Auth.Token,
		"Config's Auth.Token should remain unchanged - newClient uses a local copy")
}

// TestTracingClientHTTPBearerAuth tests that the tracing client actually sends
// bearer token credentials in HTTP requests, and that credential rotation is
// reflected in subsequent requests.
func TestTracingClientHTTPBearerAuth(t *testing.T) {
	// Create test server that captures Authorization header
	var capturedAuth atomic.Value
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth.Store(r.Header.Get("Authorization"))
		// Return minimal valid Jaeger response for /api/services
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data": []}`))
	}))
	defer server.Close()

	// Setup config with file-based bearer token
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	tokenFile := tmpDir + "/token"
	initialToken := "initial-bearer-token-12345"
	err = os.WriteFile(tokenFile, []byte(initialToken), 0600)
	require.NoError(t, err)

	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = server.URL
	conf.ExternalServices.Tracing.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Tracing.Auth.Token = tokenFile

	// Create tracing client
	ctx := context.Background()
	client, err := NewClient(ctx, conf, "", true)
	require.NoError(t, err)
	require.NotNil(t, client)

	// Make request and verify Authorization header is sent
	_, err = client.GetServiceStatus(ctx)
	require.NoError(t, err)

	auth := capturedAuth.Load()
	require.NotNil(t, auth, "Authorization header should be captured")
	assert.Equal(t, "Bearer "+initialToken, auth.(string),
		"Bearer token should be sent in Authorization header")

	// Rotate token on disk
	rotatedToken := "rotated-bearer-token-67890"
	err = os.WriteFile(tokenFile, []byte(rotatedToken), 0600)
	require.NoError(t, err)

	// Wait for fsnotify to detect change and verify rotated token is used
	tokenRotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		_, _ = client.GetServiceStatus(ctx)
		auth = capturedAuth.Load()
		return auth != nil && auth.(string) == "Bearer "+rotatedToken
	})

	assert.True(t, tokenRotated, "Rotated bearer token should be sent in subsequent requests")
	assert.Equal(t, "Bearer "+rotatedToken, capturedAuth.Load().(string),
		"Authorization header should contain rotated token")
}

// TestTracingClientHTTPBasicAuth tests that the tracing client actually sends
// basic auth credentials in HTTP requests, and that credential rotation is
// reflected in subsequent requests.
func TestTracingClientHTTPBasicAuth(t *testing.T) {
	// Create test server that captures Authorization header
	var capturedAuth atomic.Value
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth.Store(r.Header.Get("Authorization"))
		// Return minimal valid Jaeger response for /api/services
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data": []}`))
	}))
	defer server.Close()

	// Setup config with file-based basic auth credentials
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	usernameFile := tmpDir + "/username"
	passwordFile := tmpDir + "/password"
	initialUsername := "test-user"
	initialPassword := "test-pass"
	err = os.WriteFile(usernameFile, []byte(initialUsername), 0600)
	require.NoError(t, err)
	err = os.WriteFile(passwordFile, []byte(initialPassword), 0600)
	require.NoError(t, err)

	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = server.URL
	conf.ExternalServices.Tracing.Auth.Type = config.AuthTypeBasic
	conf.ExternalServices.Tracing.Auth.Username = usernameFile
	conf.ExternalServices.Tracing.Auth.Password = passwordFile

	// Create tracing client
	ctx := context.Background()
	client, err := NewClient(ctx, conf, "", true)
	require.NoError(t, err)
	require.NotNil(t, client)

	// Make request and verify Authorization header is sent
	_, err = client.GetServiceStatus(ctx)
	require.NoError(t, err)

	auth := capturedAuth.Load()
	require.NotNil(t, auth, "Authorization header should be captured")

	// Verify Basic auth format
	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(initialUsername+":"+initialPassword))
	assert.Equal(t, expectedAuth, auth.(string),
		"Basic auth credentials should be sent in Authorization header")

	// Rotate credentials on disk
	rotatedUsername := "rotated-user"
	rotatedPassword := "rotated-pass"
	err = os.WriteFile(usernameFile, []byte(rotatedUsername), 0600)
	require.NoError(t, err)
	err = os.WriteFile(passwordFile, []byte(rotatedPassword), 0600)
	require.NoError(t, err)

	// Wait for fsnotify to detect changes and verify rotated credentials are used
	expectedRotatedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(rotatedUsername+":"+rotatedPassword))
	credentialsRotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		_, _ = client.GetServiceStatus(ctx)
		auth = capturedAuth.Load()
		return auth != nil && auth.(string) == expectedRotatedAuth
	})

	assert.True(t, credentialsRotated, "Rotated basic auth credentials should be sent in subsequent requests")
	assert.Equal(t, expectedRotatedAuth, capturedAuth.Load().(string),
		"Authorization header should contain rotated credentials")
}

// TestTracingClientUseKialiTokenIntegration tests that when UseKialiToken is set,
// the kiali token passed to NewClient is actually sent in HTTP requests.
func TestTracingClientUseKialiTokenIntegration(t *testing.T) {
	// Create test server that captures Authorization header
	var capturedAuth atomic.Value
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth.Store(r.Header.Get("Authorization"))
		// Return minimal valid Jaeger response for /api/services
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data": []}`))
	}))
	defer server.Close()

	// Setup config with UseKialiToken enabled
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = server.URL
	conf.ExternalServices.Tracing.Auth.Type = config.AuthTypeBearer
	conf.ExternalServices.Tracing.Auth.UseKialiToken = true
	// Auth.Token is intentionally empty - should use kialiToken instead

	kialiToken := "kiali-user-session-token-xyz789"

	// Create tracing client with the kiali token
	ctx := context.Background()
	client, err := NewClient(ctx, conf, kialiToken, true)
	require.NoError(t, err)
	require.NotNil(t, client)

	// Make request and verify the kiali token is sent in Authorization header
	_, err = client.GetServiceStatus(ctx)
	require.NoError(t, err)

	auth := capturedAuth.Load()
	require.NotNil(t, auth, "Authorization header should be captured")
	assert.Equal(t, "Bearer "+kialiToken, auth.(string),
		"Kiali token should be sent in Authorization header when UseKialiToken=true")
}

// TestTracingClientHTTPSWithCARotation tests that the tracing client correctly uses
// custom CA bundles for TLS verification, and that CA rotation is reflected in
// subsequent HTTPS connections.
func TestTracingClientHTTPSWithCARotation(t *testing.T) {
	tmpDir := t.TempDir()
	caFile := tmpDir + "/ca.pem"

	// Generate CA1 and server certificate signed by CA1
	ca1, ca1PEM, ca1Key := certtest.MustGenCA(t, "TestCA1")
	serverCert1PEM, serverKey1PEM := certtest.MustServerCertSignedByCA(t, ca1, ca1Key, []string{"localhost", "127.0.0.1"})

	// Write CA1 to file
	err := os.WriteFile(caFile, ca1PEM, 0600)
	require.NoError(t, err)

	// Create TLS server with CA1-signed certificate
	serverCert1, err := tls.X509KeyPair(serverCert1PEM, serverKey1PEM)
	require.NoError(t, err)

	// Track requests to verify TLS succeeded
	var requestCount atomic.Int32
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data": []}`))
	})

	// Start HTTPS server with initial cert
	server := httptest.NewUnstartedServer(handler)
	server.TLS = &tls.Config{Certificates: []tls.Certificate{serverCert1}}
	server.StartTLS()
	defer server.Close()

	// Setup config with custom CA bundle
	conf := config.NewConfig()
	conf.Credentials, err = config.NewCredentialManager([]string{caFile})
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.Provider = "jaeger"
	conf.ExternalServices.Tracing.UseGRPC = false
	conf.ExternalServices.Tracing.InternalURL = server.URL
	conf.ExternalServices.Tracing.Auth.InsecureSkipVerify = false

	// Create tracing client
	ctx := context.Background()
	client, err := NewClient(ctx, conf, "", true)
	require.NoError(t, err)
	require.NotNil(t, client)

	// Make HTTPS request - should succeed with CA1
	_, err = client.GetServiceStatus(ctx)
	require.NoError(t, err, "HTTPS request should succeed with CA1")
	assert.Equal(t, int32(1), requestCount.Load(), "Server should have received 1 request")

	// Now rotate the CA - generate CA2 and new server cert
	ca2, ca2PEM, ca2Key := certtest.MustGenCA(t, "TestCA2")
	serverCert2PEM, serverKey2PEM := certtest.MustServerCertSignedByCA(t, ca2, ca2Key, []string{"localhost", "127.0.0.1"})

	// Update server's certificate to one signed by CA2
	serverCert2, err := tls.X509KeyPair(serverCert2PEM, serverKey2PEM)
	require.NoError(t, err)

	// Stop the old server and start a new one with the rotated cert
	server.Close()

	server2 := httptest.NewUnstartedServer(handler)
	server2.TLS = &tls.Config{Certificates: []tls.Certificate{serverCert2}}
	server2.StartTLS()
	defer server2.Close()

	// Update the tracing config to point to the new server
	conf.ExternalServices.Tracing.InternalURL = server2.URL

	// NEGATIVE TEST: Client still has CA1, server now uses CA2 - connection should FAIL
	// The CA file has NOT been updated yet, so client's CertPool still contains CA1
	clientWithOldCA, err := NewClient(ctx, conf, "", true)
	require.NoError(t, err)
	_, err = clientWithOldCA.GetServiceStatus(ctx)
	require.Error(t, err, "Connection should FAIL when client CA (CA1) doesn't match server cert (signed by CA2)")
	assert.Contains(t, err.Error(), "certificate",
		"Error should be a certificate verification failure")

	// Now write CA2 to the file (rotation) so client can pick up the new CA
	err = os.WriteFile(caFile, ca2PEM, 0600)
	require.NoError(t, err)

	// Wait for fsnotify to detect the CA file change and verify connection succeeds
	caRotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		// Create new client with updated config
		client2, err := NewClient(ctx, conf, "", true)
		if err != nil {
			return false
		}

		// Try to make request with new CA
		_, err = client2.GetServiceStatus(ctx)
		return err == nil
	})

	assert.True(t, caRotated, "Tracing client should successfully connect after CA rotation")
	assert.GreaterOrEqual(t, requestCount.Load(), int32(2), "Server should have received at least 2 requests")
}
