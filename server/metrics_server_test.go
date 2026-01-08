package server

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/certtest"
)

// TestMetricsServerHTTP verifies that the metrics server works with plain HTTP
// when TLS is not configured.
func TestMetricsServerHTTP(t *testing.T) {
	// Use a fixed port for testing to avoid async port detection issues
	testPort := 19090

	conf := config.NewConfig()
	conf.Server.Address = "127.0.0.1"
	conf.Server.Observability.Metrics.Port = testPort
	conf.Server.Observability.Metrics.Enabled = true
	// No certificate files configured - should use HTTP

	// Start metrics server
	StartMetricsServer(conf)
	if metricsServer == nil {
		t.Fatal("metrics server should be created")
	}
	defer StopMetricsServer()

	// Wait for server to start listening
	addr := fmt.Sprintf("127.0.0.1:%d", testPort)
	if !waitForServer(addr, false, 2*time.Second) {
		t.Fatal("metrics server did not start within timeout")
	}

	// Make HTTP request to metrics endpoint
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://" + addr + "/metrics")
	if err != nil {
		t.Fatalf("failed to fetch metrics over HTTP: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got [%d]", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read response body: %v", err)
	}

	// Verify it's actual Prometheus metrics (contains "# HELP" or "# TYPE")
	bodyStr := string(body)
	if !strings.Contains(bodyStr, "# HELP") && !strings.Contains(bodyStr, "# TYPE") {
		t.Fatal("response does not appear to be Prometheus metrics format")
	}
}

// TestMetricsServerHTTPS verifies that the metrics server uses TLS when configured
// and enforces the TLS policy (TLS 1.3 in this test).
func TestMetricsServerHTTPS(t *testing.T) {
	tmpDir := t.TempDir()
	testPort := 19091

	// Create CA and server certificate
	ca, caPEM, caKey := certtest.MustGenCA(t, "TestCA")
	serverCertPEM, serverKeyPEM := certtest.MustServerCertWithIPSignedByCA(t, ca, caKey, []net.IP{net.ParseIP("127.0.0.1")})

	// Write cert and key to files
	certFile := tmpDir + "/server.crt"
	keyFile := tmpDir + "/server.key"
	caFile := tmpDir + "/ca.pem"

	if err := os.WriteFile(certFile, serverCertPEM, 0o600); err != nil {
		t.Fatalf("write cert: %v", err)
	}
	if err := os.WriteFile(keyFile, serverKeyPEM, 0o600); err != nil {
		t.Fatalf("write key: %v", err)
	}
	if err := os.WriteFile(caFile, caPEM, 0o600); err != nil {
		t.Fatalf("write ca: %v", err)
	}

	// Create config with TLS enabled and TLS 1.3 policy
	conf := config.NewConfig()
	conf.Server.Address = "127.0.0.1"
	conf.Server.Observability.Metrics.Port = testPort
	conf.Server.Observability.Metrics.Enabled = true
	conf.Identity.CertFile = certFile
	conf.Identity.PrivateKeyFile = keyFile
	conf.ResolvedTLSPolicy = config.TLSPolicy{
		MinVersion: tls.VersionTLS13,
		MaxVersion: tls.VersionTLS13,
		Source:     config.TLSConfigSourceConfig,
	}

	// Initialize credential manager with CA
	var err error
	conf.Credentials, err = config.NewCredentialManager([]string{caFile})
	if err != nil {
		t.Fatalf("credential manager: %v", err)
	}
	defer conf.Close()

	// Start metrics server
	StartMetricsServer(conf)
	if metricsServer == nil {
		t.Fatal("metrics server should be created")
	}
	defer StopMetricsServer()

	// Wait for server to start listening
	addr := fmt.Sprintf("127.0.0.1:%d", testPort)
	if !waitForServer(addr, true, 2*time.Second) {
		t.Fatal("metrics server did not start within timeout")
	}

	// Create CA pool for client
	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(caPEM) {
		t.Fatal("failed to add CA to pool")
	}

	// Test 1: TLS 1.3 client should successfully connect
	t.Run("TLS1.3 client connects", func(t *testing.T) {
		clientTLS := &tls.Config{
			RootCAs:    certPool,
			MinVersion: tls.VersionTLS13,
			MaxVersion: tls.VersionTLS13,
		}

		client := &http.Client{
			Timeout: 2 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: clientTLS,
			},
		}

		resp, err := client.Get("https://" + addr + "/metrics")
		if err != nil {
			t.Fatalf("TLS 1.3 client should connect successfully: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected status 200, got [%d]", resp.StatusCode)
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("failed to read response: %v", err)
		}

		// Verify metrics content
		bodyStr := string(body)
		if !strings.Contains(bodyStr, "# HELP") && !strings.Contains(bodyStr, "# TYPE") {
			t.Fatal("response does not appear to be Prometheus metrics format")
		}
	})

	// Test 2: TLS 1.2 client should fail (policy enforcement)
	t.Run("TLS1.2 client fails", func(t *testing.T) {
		clientTLS := &tls.Config{
			RootCAs:    certPool,
			MinVersion: tls.VersionTLS12,
			MaxVersion: tls.VersionTLS12,
		}

		client := &http.Client{
			Timeout: 2 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: clientTLS,
			},
		}

		resp, err := client.Get("https://" + addr + "/metrics")
		if err == nil {
			resp.Body.Close()
			t.Fatal("TLS 1.2 client should fail against TLS 1.3-only server")
		}
		// Connection should fail due to version mismatch
		t.Logf("TLS 1.2 client correctly rejected: %v", err)
	})
}

// waitForServer attempts to connect to the given address to verify the server is listening.
// Returns true if server is ready, false if timeout is reached.
func waitForServer(addr string, useTLS bool, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		var conn net.Conn
		var err error

		if useTLS {
			conn, err = tls.Dial("tcp", addr, &tls.Config{InsecureSkipVerify: true})
		} else {
			conn, err = net.Dial("tcp", addr)
		}

		if err == nil {
			conn.Close()
			return true
		}
		time.Sleep(50 * time.Millisecond)
	}
	return false
}
