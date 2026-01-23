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
	"github.com/kiali/kiali/util/polltest"
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

func TestGetAuthDialOptions_BearerTokenRotation(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager(nil)
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
		Token:              config.Credential(tokenFile),
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

	// Establish a single connection (NewClient is lazy, connects on first RPC)
	// Use passthrough scheme with bufconn dialer - the dialer ignores the address
	conn, err := grpc.NewClient("passthrough:///bufnet", opts...)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
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
	tokenRotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
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
	conf.Credentials, err = config.NewCredentialManager(nil)
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
		Username:           config.Credential(usernameFile),
		Password:           config.Credential(passwordFile),
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

	// Establish a single connection (NewClient is lazy, connects on first RPC)
	// Use passthrough scheme with bufconn dialer - the dialer ignores the address
	conn, err := grpc.NewClient("passthrough:///bufnet", opts...)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
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
	credsRotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
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
	if confWithoutCA.Credentials, err = config.NewCredentialManager(nil); err != nil {
		t.Fatalf("NewCredentialManager: %v", err)
	}
	t.Cleanup(confWithoutCA.Credentials.Close)
	// Note: No custom CA bundle - will use system CAs which won't trust our custom CA

	optsWithoutCA, err := grpcutil.GetAuthDialOptions(confWithoutCA, serverName, true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions without CA: %v", err)
	}
	optsWithoutCA = append(optsWithoutCA, grpc.WithContextDialer(dialer))

	// This should FAIL because the server's certificate is signed by our custom CA,
	// which is not in the system trust store. NewClient is lazy, so failure happens on RPC.
	connWithoutCA, err := grpc.NewClient("passthrough:///bufnet", optsWithoutCA...)
	if err == nil {
		defer connWithoutCA.Close()
		// Try to make a call - failure happens here with NewClient (lazy connection)
		client := grpc_health_v1.NewHealthClient(connWithoutCA)
		ctxCall, cancelCall := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelCall()
		_, errCall := client.Check(ctxCall, &grpc_health_v1.HealthCheckRequest{})
		if errCall == nil {
			t.Fatal("Expected connection/RPC to fail without custom CA, but it succeeded")
		}
		t.Logf("Negative test passed: RPC failed without custom CA: %v", errCall)
	} else {
		t.Logf("Negative test passed: NewClient failed without custom CA: %v", err)
	}

	// POSITIVE TEST: Now configure custom CA bundle and retry - should succeed
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0600); err != nil {
		t.Fatalf("write ca: %v", err)
	}

	confWithCA := config.NewConfig()
	if confWithCA.Credentials, err = config.NewCredentialManager([]string{caFile}); err != nil {
		t.Fatalf("NewCredentialManager: %v", err)
	}
	t.Cleanup(confWithCA.Credentials.Close)

	// Get dial options with custom CA - should verify server cert against custom CA
	optsWithCA, err := grpcutil.GetAuthDialOptions(confWithCA, serverName, true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions with CA: %v", err)
	}
	optsWithCA = append(optsWithCA, grpc.WithContextDialer(dialer))

	connWithCA, err := grpc.NewClient("passthrough:///bufnet", optsWithCA...)
	if err != nil {
		t.Fatalf("NewClient should succeed with custom CA: %v", err)
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

// TestGetAuthDialOptions_CARotation verifies that gRPC connections properly pick up
// rotated CA bundles via fsnotify. This mirrors TestTracingClientHTTPSWithCARotation
// for HTTP but tests gRPC CA bundle rotation.
func TestGetAuthDialOptions_CARotation(t *testing.T) {
	tmpDir := t.TempDir()
	caFile := tmpDir + "/ca.pem"
	const serverName = "grpc-service.example.com"

	// Generate CA1 and server certificate signed by CA1
	ca1, ca1PEM, ca1Key := certtest.MustGenCA(t, "TestCA1")
	serverCert1PEM, serverKey1PEM := certtest.MustServerCertSignedByCA(t, ca1, ca1Key, []string{serverName})

	// Write CA1 to file
	if err := os.WriteFile(caFile, ca1PEM, 0600); err != nil {
		t.Fatalf("Failed to write CA1 file: %v", err)
	}

	// Create config with CA bundle that watches the CA file
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager([]string{caFile})
	if err != nil {
		t.Fatalf("NewCredentialManager: %v", err)
	}
	t.Cleanup(conf.Close)

	// Start gRPC server with CA1-signed certificate
	stopServer1, dialer1 := startTLSGRPCServerWithCA(t, serverCert1PEM, serverKey1PEM)

	// No authentication credentials - testing CA verification only
	var auth *config.Auth = nil

	// POSITIVE TEST 1: Connect to server with CA1 in bundle - should succeed
	opts1, err := grpcutil.GetAuthDialOptions(conf, serverName, true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions for CA1: %v", err)
	}
	opts1 = append(opts1, grpc.WithContextDialer(dialer1))

	conn1, err := grpc.NewClient("passthrough:///bufnet", opts1...)
	if err != nil {
		t.Fatalf("NewClient should succeed with CA1: %v", err)
	}
	defer conn1.Close()

	client1 := grpc_health_v1.NewHealthClient(conn1)
	ctxCheck1, cancelCheck1 := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancelCheck1()

	resp1, err := client1.Check(ctxCheck1, &grpc_health_v1.HealthCheckRequest{})
	if err != nil {
		t.Fatalf("Health check should succeed with CA1: %v", err)
	}
	if resp1.Status != grpc_health_v1.HealthCheckResponse_SERVING {
		t.Fatalf("Expected SERVING status, got %v", resp1.Status)
	}
	t.Log("Initial connection with CA1 succeeded")

	// Stop server1
	stopServer1()
	conn1.Close()

	// Generate CA2 and server certificate signed by CA2
	ca2, ca2PEM, ca2Key := certtest.MustGenCA(t, "TestCA2")
	serverCert2PEM, serverKey2PEM := certtest.MustServerCertSignedByCA(t, ca2, ca2Key, []string{serverName})

	// Start new gRPC server with CA2-signed certificate
	stopServer2, dialer2 := startTLSGRPCServerWithCA(t, serverCert2PEM, serverKey2PEM)
	defer stopServer2()

	// NEGATIVE TEST: Client still has CA1, server now uses CA2 - should FAIL
	// The CA file has NOT been updated yet, so client's CertPool still contains CA1
	opts2, err := grpcutil.GetAuthDialOptions(conf, serverName, true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions for negative test: %v", err)
	}
	opts2 = append(opts2, grpc.WithContextDialer(dialer2))

	// NewClient is lazy, so failure happens on RPC, not at client creation
	connNegative, err := grpc.NewClient("passthrough:///bufnet", opts2...)
	if err == nil {
		defer connNegative.Close()
		// Try to make a call - failure happens here with NewClient (lazy connection)
		clientNegative := grpc_health_v1.NewHealthClient(connNegative)
		ctxNegative, cancelNegative := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelNegative()
		_, errCall := clientNegative.Check(ctxNegative, &grpc_health_v1.HealthCheckRequest{})
		if errCall == nil {
			t.Fatal("Expected connection/RPC to fail when CA1 doesn't match CA2-signed server cert, but it succeeded")
		}
		t.Logf("Negative test passed: RPC failed with CA mismatch: %v", errCall)
	} else {
		t.Logf("Negative test passed: NewClient failed with CA mismatch: %v", err)
	}

	// Now rotate CA file: write CA2 to the file (overwriting CA1)
	if err := os.WriteFile(caFile, ca2PEM, 0600); err != nil {
		t.Fatalf("Failed to rotate CA file to CA2: %v", err)
	}

	// POSITIVE TEST 2: Wait for fsnotify to detect the CA file change
	// Poll until connection succeeds with the rotated CA
	var conn3 *grpc.ClientConn
	caRotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		// Get fresh dial options (TLS config will use updated CA bundle)
		opts3, err := grpcutil.GetAuthDialOptions(conf, serverName, true, auth)
		if err != nil {
			return false
		}
		opts3 = append(opts3, grpc.WithContextDialer(dialer2))

		conn3, err = grpc.NewClient("passthrough:///bufnet", opts3...)
		if err != nil {
			return false
		}

		// Try an RPC to verify the connection actually works
		client3 := grpc_health_v1.NewHealthClient(conn3)
		ctxCheck3, cancelCheck3 := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelCheck3()

		resp3, errCheck := client3.Check(ctxCheck3, &grpc_health_v1.HealthCheckRequest{})
		if errCheck != nil {
			conn3.Close()
			return false
		}

		if resp3.Status != grpc_health_v1.HealthCheckResponse_SERVING {
			conn3.Close()
			return false
		}

		return true
	})

	if !caRotated {
		t.Fatal("gRPC CA rotation failed - connection did not succeed after CA file was rotated to CA2")
	}
	defer conn3.Close()

	t.Log("CA rotation successful - gRPC connection succeeded after CA bundle was rotated via fsnotify")
}

// TestGetAuthDialOptions_ClientCertRotation verifies that gRPC client certificates
// can be rotated and the new certificate is picked up on subsequent connections.
// This mirrors the HTTP client cert rotation test but for gRPC.
func TestGetAuthDialOptions_ClientCertRotation(t *testing.T) {
	conf := config.NewConfig()
	var err error
	if conf.Credentials, err = config.NewCredentialManager(nil); err != nil {
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
		CertFile:           config.Credential(certFile),
		KeyFile:            config.Credential(keyFile),
		InsecureSkipVerify: true, // Skip server verification to focus on client cert rotation
	}

	// Get dial options with client cert
	opts, err := grpcutil.GetAuthDialOptions(conf, "bufconn.local", true, auth)
	if err != nil {
		t.Fatalf("GetAuthDialOptions: %v", err)
	}
	opts = append(opts, grpc.WithContextDialer(dialer))

	// Establish connection with first certificate
	conn1, err := grpc.NewClient("passthrough:///bufnet", opts...)
	if err != nil {
		t.Fatalf("NewClient with cert1: %v", err)
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
	certRotated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		conn2, err = grpc.NewClient("passthrough:///bufnet", opts...)
		if err != nil {
			// Client creation might fail during rotation, keep polling
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

func startTLSGRPCServerWithPolicyTLS(t *testing.T, min, max uint16) (stop func(), dialer func(context.Context, string) (net.Conn, error)) {
	lis := bufconn.Listen(bufSize)
	// Use a self-signed server cert; clients will skip verification in this test.
	tlsCfg := certtest.MustGenerateSelfSignedServerTLS(t)
	tlsCfg.MinVersion = min
	tlsCfg.MaxVersion = max
	s := grpc.NewServer(grpc.Creds(credentials.NewTLS(tlsCfg)))
	grpc_health_v1.RegisterHealthServer(s, health.NewServer())

	go func() {
		_ = s.Serve(lis)
	}()

	return func() { s.Stop(); _ = lis.Close() }, func(ctx context.Context, s string) (net.Conn, error) {
		return lis.Dial()
	}
}

// TestGetAuthDialOptions_EnforcesTLSVersion ensures TLS policy is enforced for gRPC
// dial options even without auth or custom CAs.
func TestGetAuthDialOptions_EnforcesTLSVersion(t *testing.T) {
	// TLS1.3-only server
	stop, dialer := startTLSGRPCServerWithPolicyTLS(t, tls.VersionTLS13, tls.VersionTLS13)
	defer stop()

	cm, err := config.NewCredentialManager(nil)
	if err != nil {
		t.Fatalf("credential manager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Policy restricted to TLS1.2 should fail
	confFail := config.NewConfig()
	confFail.Credentials = cm
	confFail.ResolvedTLSPolicy = config.TLSPolicy{
		MinVersion: tls.VersionTLS12,
		MaxVersion: tls.VersionTLS12,
		Source:     config.TLSConfigSourceConfig,
	}
	authSkip := &config.Auth{InsecureSkipVerify: true}

	optsFail, err := grpcutil.GetAuthDialOptions(confFail, "bufconn.local", true, authSkip)
	if err != nil {
		t.Fatalf("GetAuthDialOptions fail case: %v", err)
	}
	optsFail = append(optsFail, grpc.WithContextDialer(dialer))
	if conn, err := grpc.NewClient("passthrough:///bufnet", optsFail...); err == nil {
		defer conn.Close()
		client := grpc_health_v1.NewHealthClient(conn)
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if _, errCall := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{}); errCall == nil {
			t.Fatal("expected TLS version mismatch to fail gRPC call")
		}
	}

	// Policy TLS1.3 should succeed
	confOK := config.NewConfig()
	confOK.Credentials = cm
	confOK.ResolvedTLSPolicy = config.TLSPolicy{
		MinVersion: tls.VersionTLS13,
		MaxVersion: tls.VersionTLS13,
		Source:     config.TLSConfigSourceConfig,
	}
	optsOK, err := grpcutil.GetAuthDialOptions(confOK, "bufconn.local", true, authSkip)
	if err != nil {
		t.Fatalf("GetAuthDialOptions success case: %v", err)
	}
	optsOK = append(optsOK, grpc.WithContextDialer(dialer))
	connOK, err := grpc.NewClient("passthrough:///bufnet", optsOK...)
	if err != nil {
		t.Fatalf("expected TLS1.3 client to connect: %v", err)
	}
	defer connOK.Close()
	client := grpc_health_v1.NewHealthClient(connOK)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if _, err := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{}); err != nil {
		t.Fatalf("expected health check to succeed with TLS1.3 policy: %v", err)
	}
}
