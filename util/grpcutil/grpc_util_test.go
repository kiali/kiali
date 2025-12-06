package grpcutil_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"math/big"
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
	serverTLS := mustGenerateSelfSignedServerTLS(t)

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

func mustGenerateSelfSignedServerTLS(t *testing.T) *tls.Config {
	t.Helper()

	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}
	template := &x509.Certificate{
		SerialNumber:          bigOne(),
		Subject:               pkix.Name{CommonName: "bufconn.local"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}
	derBytes, err := x509.CreateCertificate(rand.Reader, template, template, &priv.PublicKey, priv)
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)})
	cert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		t.Fatalf("failed to load key pair: %v", err)
	}
	return &tls.Config{Certificates: []tls.Certificate{cert}}
}

func bigOne() *big.Int {
	return big.NewInt(1)
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
	tokenRotated := false
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		ctx2, cancel2 := context.WithTimeout(context.Background(), 3*time.Second)
		if _, err := client.Check(ctx2, &grpc_health_v1.HealthCheckRequest{}); err != nil {
			cancel2()
			t.Fatalf("RPC poll failed: %v", err)
		}
		captured2 = <-authHeaderCh
		cancel2()
		if captured2 == "Bearer "+rotatedToken {
			tokenRotated = true
			break
		}
	}

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
	credsRotated := false
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		ctx2Poll, cancel2Poll := context.WithTimeout(context.Background(), 3*time.Second)
		if _, err = client.Check(ctx2Poll, &grpc_health_v1.HealthCheckRequest{}); err != nil {
			cancel2Poll()
			t.Fatalf("RPC poll failed: %v", err)
		}
		captured2 = <-authHeaderCh
		cancel2Poll()
		if captured2 == expectedRotated {
			credsRotated = true
			break
		}
	}

	if !credsRotated {
		t.Logf("FAILURE: Second RPC still uses initial credentials %q", expectedInitial)
		t.Logf("Expected rotated credentials [%q] but got [%q]", expectedRotated, captured2)
		t.Error("gRPC Basic auth rotation failed - credentials were not re-read from files")
	}
}
