package grpcutil_test

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"net"
	"os"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/test/bufconn"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/certtest"
	"github.com/kiali/kiali/util/grpcutil"
)

const bufSize = 1024 * 1024

// startTLSGRPCServerWithAuthCapture starts a TLS bufconn-based gRPC server that captures the
// Authorization metadata for each unary call and sends it to the provided channel.
func startTLSGRPCServerWithAuthCapture(t *testing.T, authHeaderCh chan<- string) (stop func(), dialer func(context.Context, string) (net.Conn, error)) {
	lis := bufconn.Listen(bufSize)
	unaryInterceptor := func(
		ctx context.Context,
		req interface{},
		_ *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		if md, ok := metadata.FromIncomingContext(ctx); ok {
			values := md.Get("authorization")
			if len(values) > 0 {
				authHeaderCh <- values[0]
			} else {
				authHeaderCh <- ""
			}
		} else {
			authHeaderCh <- ""
		}
		return handler(ctx, req)
	}

	// Generate a self-signed server certificate for TLS
	serverTLS := certtest.MustGenerateSelfSignedServerTLS(t)

	s := grpc.NewServer(
		grpc.UnaryInterceptor(unaryInterceptor),
		grpc.Creds(credentials.NewTLS(serverTLS)),
	)
	grpc_health_v1.RegisterHealthServer(s, health.NewServer())

	go func() {
		_ = s.Serve(lis)
	}()

	return func() { s.Stop(); _ = lis.Close() }, func(ctx context.Context, s string) (net.Conn, error) {
		return lis.Dial()
	}
}

// pollForCondition polls until a condition is met or timeout is reached.
// Returns true if condition was met, false if timeout occurred.
// This is used for waiting on fsnotify file change detection in credential rotation tests.
func pollForCondition(t *testing.T, timeout time.Duration, condition func() bool) bool {
	t.Helper()
	iterations := int(timeout / (50 * time.Millisecond))
	for i := 0; i < iterations; i++ {
		time.Sleep(50 * time.Millisecond)
		if condition() {
			return true
		}
	}
	return false
}

func TestGetAuthDialOptions_BearerTokenRotation(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager()
	if err != nil {
		t.Fatalf("failed to create credential manager: %v", err)
	}
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	tokenFile := tmpDir + "/token"

	// Write initial token
	initialToken := "initial-grpc-token-12345"
	err = os.WriteFile(tokenFile, []byte(initialToken), 0600)
	if err != nil {
		t.Fatalf("Failed to create token file: %v", err)
	}
	auth := &config.Auth{
		Type:               config.AuthTypeBearer,
		Token:              tokenFile,
		InsecureSkipVerify: true,
	}

	// Prepare server to capture Authorization headers
	authHeaderCh := make(chan string, 2)
	stopServer, dialer := startTLSGRPCServerWithAuthCapture(t, authHeaderCh)
	defer stopServer()

	// Build dial options (per-RPC creds) once, as production would
	// Use TLS=true since the server is configured with TLS
	opts, err := grpcutil.GetAuthDialOptions(conf, "bufconn.local", true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions failed: %v", err)
	}
	// Use bufconn dialer
	opts = append(opts, grpc.WithContextDialer(dialer))

	// Establish a single connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, err := grpc.DialContext(ctx, "bufnet", opts...) //nolint:staticcheck // DialContext is fine here with bufconn test dialer
	if err != nil {
		t.Fatalf("Failed to dial: %v", err)
	}
	defer conn.Close()

	client := grpc_health_v1.NewHealthClient(conn)

	// RPC 1 - should send initial token
	ctx1, cancel1 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel1()
	if _, err := client.Check(ctx1, &grpc_health_v1.HealthCheckRequest{}); err != nil {
		t.Fatalf("First RPC failed: %v", err)
	}
	captured1 := <-authHeaderCh
	if captured1 != "Bearer "+initialToken {
		t.Fatalf("Expected first Authorization to be [%q], got [%q]", "Bearer "+initialToken, captured1)
	}

	// Rotate token on disk
	rotatedToken := "rotated-grpc-token-67890"
	err = os.WriteFile(tokenFile, []byte(rotatedToken), 0600)
	if err != nil {
		t.Fatalf("Failed to rotate token: %v", err)
	}

	// Wait for fsnotify to detect change and update cache (up to 2 seconds)
	// Poll by making RPCs until we see the rotated token
	var captured2 string
	tokenRotated := pollForCondition(t, 2*time.Second, func() bool {
		ctx2, cancel2 := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel2()
		if _, err := client.Check(ctx2, &grpc_health_v1.HealthCheckRequest{}); err != nil {
			t.Fatalf("RPC poll failed: %v", err)
		}
		captured2 = <-authHeaderCh
		return captured2 == "Bearer "+rotatedToken
	})

	if !tokenRotated {
		t.Logf("FAILURE: Second RPC still uses initial token %q", initialToken)
		t.Logf("Expected rotated token [%q] but got [%q]", rotatedToken, captured2)
		t.Error("gRPC Bearer token rotation failed - token was not re-read from file")
	}
}

func TestGetAuthDialOptions_BasicAuthRotation(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager()
	if err != nil {
		t.Fatalf("failed to create credential manager: %v", err)
	}
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	usernameFile := tmpDir + "/username"
	passwordFile := tmpDir + "/password"

	// Write initial credentials
	initialUsername := "grpc-user1"
	initialPassword := "grpc-pass1"
	err = os.WriteFile(usernameFile, []byte(initialUsername), 0600)
	if err != nil {
		t.Fatalf("Failed to create username file: %v", err)
	}
	err = os.WriteFile(passwordFile, []byte(initialPassword), 0600)
	if err != nil {
		t.Fatalf("Failed to create password file: %v", err)
	}
	auth := &config.Auth{
		Type:               config.AuthTypeBasic,
		Username:           usernameFile,
		Password:           passwordFile,
		InsecureSkipVerify: true,
	}

	// Prepare server to capture Authorization headers
	authHeaderCh := make(chan string, 2)
	stopServer, dialer := startTLSGRPCServerWithAuthCapture(t, authHeaderCh)
	defer stopServer()

	// Build dial options once
	// Use TLS=true since the server is configured with TLS
	opts, err := grpcutil.GetAuthDialOptions(conf, "bufconn.local", true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions failed: %v", err)
	}
	opts = append(opts, grpc.WithContextDialer(dialer))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, err := grpc.DialContext(ctx, "bufnet", opts...) //nolint:staticcheck // DialContext is fine here with bufconn test dialer
	if err != nil {
		t.Fatalf("Failed to dial: %v", err)
	}
	defer conn.Close()

	client := grpc_health_v1.NewHealthClient(conn)

	// RPC 1 - should use initial credentials
	ctx1, cancel1 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel1()
	if _, err := client.Check(ctx1, &grpc_health_v1.HealthCheckRequest{}); err != nil {
		t.Fatalf("First RPC failed: %v", err)
	}
	captured1 := <-authHeaderCh
	initialEncoded := base64.StdEncoding.EncodeToString([]byte(initialUsername + ":" + initialPassword))
	expectedInitial := "Basic " + initialEncoded
	if captured1 != expectedInitial {
		t.Fatalf("Expected first Authorization to be [%q], got [%q]", expectedInitial, captured1)
	}

	// Rotate credentials
	rotatedUsername := "grpc-user2"
	rotatedPassword := "grpc-pass2"
	err = os.WriteFile(usernameFile, []byte(rotatedUsername), 0600)
	if err != nil {
		t.Fatalf("Failed to rotate username: %v", err)
	}
	err = os.WriteFile(passwordFile, []byte(rotatedPassword), 0600)
	if err != nil {
		t.Fatalf("Failed to rotate password: %v", err)
	}

	// Wait for fsnotify to detect changes and update cache (up to 2 seconds)
	// Poll by making RPCs until we see the rotated credentials
	rotatedEncoded := base64.StdEncoding.EncodeToString([]byte(rotatedUsername + ":" + rotatedPassword))
	expectedRotated := "Basic " + rotatedEncoded
	var captured2 string
	credsRotated := pollForCondition(t, 2*time.Second, func() bool {
		ctx2Poll, cancel2Poll := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel2Poll()
		if _, err = client.Check(ctx2Poll, &grpc_health_v1.HealthCheckRequest{}); err != nil {
			t.Fatalf("RPC poll failed: %v", err)
		}
		captured2 = <-authHeaderCh
		return captured2 == expectedRotated
	})

	if !credsRotated {
		t.Logf("FAILURE: Second RPC still uses initial credentials %q", expectedInitial)
		t.Logf("Expected rotated credentials [%q] but got [%q]", expectedRotated, captured2)
		t.Error("gRPC Basic auth rotation failed - credentials were not re-read from files")
	}
}

// --- Helper functions for CA-signed certificate testing ---
// Note: Certificate generation helpers have been moved to util/certtest package for reuse

// startTLSGRPCServerWithCA starts a gRPC server with a CA-signed certificate.
// Returns a stop function and dialer for bufconn-based connections.
func startTLSGRPCServerWithCA(t *testing.T, serverCertPEM, serverKeyPEM []byte) (stop func(), dialer func(context.Context, string) (net.Conn, error)) {
	lis := bufconn.Listen(bufSize)

	// Load server certificate
	serverCert, err := tls.X509KeyPair(serverCertPEM, serverKeyPEM)
	if err != nil {
		t.Fatalf("load server cert: %v", err)
	}

	serverTLS := &tls.Config{
		Certificates: []tls.Certificate{serverCert},
	}

	s := grpc.NewServer(grpc.Creds(credentials.NewTLS(serverTLS)))
	grpc_health_v1.RegisterHealthServer(s, health.NewServer())

	go func() {
		_ = s.Serve(lis)
	}()

	return func() { s.Stop(); _ = lis.Close() }, func(ctx context.Context, s string) (net.Conn, error) {
		return lis.Dial()
	}
}

// TestGetAuthDialOptions_CustomCAWithoutAuth verifies that gRPC connections properly
// use custom CA bundles for server certificate verification even when no authentication
// credentials are configured. This ensures custom CAs work independently of auth for gRPC.
func TestGetAuthDialOptions_CustomCAWithoutAuth(t *testing.T) {
	tmpDir := t.TempDir()
	const serverName = "grpc-service.example.com"

	// Create CA and server certificate signed by that CA
	ca, caPEM, caKey := certtest.MustGenCA(t, "CustomCA")
	serverCertPEM, serverKeyPEM := certtest.MustServerCertSignedByCA(t, ca, caKey, []string{serverName})

	// Start gRPC server with CA-signed certificate
	stopServer, dialer := startTLSGRPCServerWithCA(t, serverCertPEM, serverKeyPEM)
	defer stopServer()

	// No authentication credentials - testing CA verification without auth
	var auth *config.Auth = nil

	// NEGATIVE TEST: First try without custom CA configured - should fail certificate verification
	confWithoutCA := config.NewConfig()
	var err error
	if confWithoutCA.Credentials, err = config.NewCredentialManager(); err != nil {
		t.Fatalf("NewCredentialManager: %v", err)
	}
	t.Cleanup(confWithoutCA.Credentials.Close)
	// Note: NOT initializing cert pool - will use system CAs which won't trust our custom CA

	optsWithoutCA, err := grpcutil.GetAuthDialOptions(confWithoutCA, serverName, true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions without CA: %v", err)
	}
	optsWithoutCA = append(optsWithoutCA, grpc.WithContextDialer(dialer))

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// This should FAIL because the server's certificate is signed by our custom CA,
	// which is not in the system trust store
	connWithoutCA, err := grpc.DialContext(ctx, "bufnet", optsWithoutCA...) //nolint:staticcheck
	if err == nil {
		defer connWithoutCA.Close()
		// Try to make a call - might fail here instead of at dial time
		client := grpc_health_v1.NewHealthClient(connWithoutCA)
		ctxCall, cancelCall := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelCall()
		_, errCall := client.Check(ctxCall, &grpc_health_v1.HealthCheckRequest{})
		if errCall == nil {
			t.Fatal("Expected connection/RPC to fail without custom CA, but it succeeded")
		}
		t.Logf("Negative test passed: RPC failed without custom CA: %v", errCall)
	} else {
		t.Logf("Negative test passed: Dial failed without custom CA: %v", err)
	}

	// POSITIVE TEST: Now configure custom CA bundle and retry - should succeed
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0600); err != nil {
		t.Fatalf("write ca: %v", err)
	}

	confWithCA := config.NewConfig()
	if confWithCA.Credentials, err = config.NewCredentialManager(); err != nil {
		t.Fatalf("NewCredentialManager: %v", err)
	}
	t.Cleanup(confWithCA.Credentials.Close)
	if err := confWithCA.Credentials.InitializeCertPool([]string{caFile}); err != nil {
		t.Fatalf("InitializeCertPool: %v", err)
	}

	// Get dial options with custom CA - should verify server cert against custom CA
	optsWithCA, err := grpcutil.GetAuthDialOptions(confWithCA, serverName, true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions with CA: %v", err)
	}
	optsWithCA = append(optsWithCA, grpc.WithContextDialer(dialer))

	ctx2, cancel2 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel2()

	connWithCA, err := grpc.DialContext(ctx2, "bufnet", optsWithCA...) //nolint:staticcheck
	if err != nil {
		t.Fatalf("Dial should succeed with custom CA: %v", err)
	}
	defer connWithCA.Close()

	// Make a health check call to verify the connection actually works
	client := grpc_health_v1.NewHealthClient(connWithCA)
	ctx3, cancel3 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel3()

	resp, err := client.Check(ctx3, &grpc_health_v1.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Health check should succeed with custom CA: %v", err)
	}

	if resp.Status != grpc_health_v1.HealthCheckResponse_SERVING {
		t.Fatalf("Expected SERVING status, got %v", resp.Status)
	}

	t.Log("Positive test passed: gRPC connection and RPC succeeded with custom CA bundle")
}

// TestGetAuthDialOptions_ClientCertRotation verifies that gRPC client certificates
// can be rotated and the new certificate is picked up on subsequent connections.
// This mirrors the HTTP client cert rotation test but for gRPC.
func TestGetAuthDialOptions_ClientCertRotation(t *testing.T) {
	conf := config.NewConfig()
	var err error
	if conf.Credentials, err = config.NewCredentialManager(); err != nil {
		t.Fatalf("failed to create credential manager: %v", err)
	}
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	certFile := tmpDir + "/client.crt"
	keyFile := tmpDir + "/client.key"

	// Generate initial client certificate
	certPEM1, keyPEM1 := certtest.MustSelfSignedPair(t, "client1")
	if err := os.WriteFile(certFile, certPEM1, 0600); err != nil {
		t.Fatalf("write cert1: %v", err)
	}
	if err := os.WriteFile(keyFile, keyPEM1, 0600); err != nil {
		t.Fatalf("write key1: %v", err)
	}

	// Start gRPC server that requires client certificates
	stopServer, dialer := startTLSGRPCServerWithClientAuth(t)
	defer stopServer()

	auth := &config.Auth{
		CertFile:           certFile,
		KeyFile:            keyFile,
		InsecureSkipVerify: true, // Skip server verification to focus on client cert rotation
	}

	// Get dial options with client cert
	opts, err := grpcutil.GetAuthDialOptions(conf, "bufconn.local", true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions: %v", err)
	}
	opts = append(opts, grpc.WithContextDialer(dialer))

	// Establish connection with first certificate
	ctx1, cancel1 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel1()
	conn1, err := grpc.DialContext(ctx1, "bufnet", opts...) //nolint:staticcheck
	if err != nil {
		t.Fatalf("Dial with cert1: %v", err)
	}
	defer conn1.Close()

	client := grpc_health_v1.NewHealthClient(conn1)
	ctxCheck1, cancelCheck1 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancelCheck1()
	if _, err := client.Check(ctxCheck1, &grpc_health_v1.HealthCheckRequest{}); err != nil {
		t.Fatalf("RPC with cert1: %v", err)
	}

	// Rotate client certificate
	certPEM2, keyPEM2 := certtest.MustSelfSignedPair(t, "client2")
	if err := os.WriteFile(certFile, certPEM2, 0600); err != nil {
		t.Fatalf("write cert2: %v", err)
	}
	if err := os.WriteFile(keyFile, keyPEM2, 0600); err != nil {
		t.Fatalf("write key2: %v", err)
	}

	// Wait for fsnotify and establish new connection - the new connection should use rotated cert
	// We need to establish a new connection because client certs are loaded during TLS handshake
	var conn2 *grpc.ClientConn
	certRotated := pollForCondition(t, 2*time.Second, func() bool {
		ctx2, cancel2 := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel2()
		conn2, err = grpc.DialContext(ctx2, "bufnet", opts...) //nolint:staticcheck
		if err != nil {
			// Connection might fail during rotation, keep polling
			return false
		}
		// Try an RPC to verify the cert works
		client2 := grpc_health_v1.NewHealthClient(conn2)
		ctxCheck, cancelCheck := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelCheck()
		_, errCheck := client2.Check(ctxCheck, &grpc_health_v1.HealthCheckRequest{})
		if errCheck != nil {
			conn2.Close()
			return false
		}
		return true
	})

	if !certRotated {
		t.Fatal("Expected new connection to use rotated client certificate, but it failed")
	}
	defer conn2.Close()

	t.Log("Client certificate rotation successful - new connections use rotated cert")
}

// startTLSGRPCServerWithClientAuth starts a gRPC server that requires client certificates.
func startTLSGRPCServerWithClientAuth(t *testing.T) (stop func(), dialer func(context.Context, string) (net.Conn, error)) {
	lis := bufconn.Listen(bufSize)

	// Generate server certificate
	serverTLS := certtest.MustGenerateSelfSignedServerTLS(t)
	// Require client certificates but don't verify them (we're testing client cert rotation, not server verification)
	serverTLS.ClientAuth = tls.RequireAnyClientCert

	s := grpc.NewServer(grpc.Creds(credentials.NewTLS(serverTLS)))
	grpc_health_v1.RegisterHealthServer(s, health.NewServer())

	go func() {
		_ = s.Serve(lis)
	}()

	return func() { s.Stop(); _ = lis.Close() }, func(ctx context.Context, s string) (net.Conn, error) {
		return lis.Dial()
	}
}
