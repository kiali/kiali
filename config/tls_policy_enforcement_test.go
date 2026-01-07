package config

import (
	"crypto/tls"
	"net"
	"os"
	"testing"
	"time"

	"github.com/kiali/kiali/util/certtest"
)

// TestTLSPolicyEnforcement_VersionConstraints verifies that the TLS policy correctly
// enforces version constraints. A TLS1.3-only server should reject TLS1.2-only clients
// and vice versa.
func TestTLSPolicyEnforcement_VersionConstraints(t *testing.T) {
	tmpDir := t.TempDir()

	// Create CA and server certificate
	ca, caPEM, caKey := certtest.MustGenCA(t, "TestCA")
	serverCertPEM, serverKeyPEM := certtest.MustServerCertWithIPSignedByCA(t, ca, caKey, []net.IP{net.ParseIP("127.0.0.1")})
	pair, err := tls.X509KeyPair(serverCertPEM, serverKeyPEM)
	if err != nil {
		t.Fatalf("load server keypair: %v", err)
	}

	// Write CA to file for CredentialManager
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0o600); err != nil {
		t.Fatalf("write ca: %v", err)
	}

	tests := []struct {
		name          string
		serverMinTLS  uint16
		serverMaxTLS  uint16
		policyMinTLS  uint16
		policyMaxTLS  uint16
		shouldConnect bool
	}{
		{
			name:          "TLS1.3 client connects to TLS1.3 server",
			serverMinTLS:  tls.VersionTLS13,
			serverMaxTLS:  tls.VersionTLS13,
			policyMinTLS:  tls.VersionTLS13,
			policyMaxTLS:  tls.VersionTLS13,
			shouldConnect: true,
		},
		{
			name:          "TLS1.2-only client fails against TLS1.3-only server",
			serverMinTLS:  tls.VersionTLS13,
			serverMaxTLS:  tls.VersionTLS13,
			policyMinTLS:  tls.VersionTLS12,
			policyMaxTLS:  tls.VersionTLS12,
			shouldConnect: false,
		},
		{
			name:          "TLS1.3-only client fails against TLS1.2-only server",
			serverMinTLS:  tls.VersionTLS12,
			serverMaxTLS:  tls.VersionTLS12,
			policyMinTLS:  tls.VersionTLS13,
			policyMaxTLS:  tls.VersionTLS13,
			shouldConnect: false,
		},
		{
			name:          "TLS1.2+ client connects to TLS1.2+ server",
			serverMinTLS:  tls.VersionTLS12,
			serverMaxTLS:  0, // no max
			policyMinTLS:  tls.VersionTLS12,
			policyMaxTLS:  0, // no max
			shouldConnect: true,
		},
		{
			name:          "TLS1.2-only client connects to TLS1.2+ server",
			serverMinTLS:  tls.VersionTLS12,
			serverMaxTLS:  0,
			policyMinTLS:  tls.VersionTLS12,
			policyMaxTLS:  tls.VersionTLS12,
			shouldConnect: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Start server with specific TLS version constraints
			serverTLSConfig := &tls.Config{
				Certificates: []tls.Certificate{pair},
				MinVersion:   tc.serverMinTLS,
				MaxVersion:   tc.serverMaxTLS,
			}
			ln, err := tls.Listen("tcp", "127.0.0.1:0", serverTLSConfig)
			if err != nil {
				t.Fatalf("listen: %v", err)
			}
			defer ln.Close()

			// Accept connections in background - must complete handshake before closing
			go func() {
				for {
					conn, err := ln.Accept()
					if err != nil {
						return
					}
					go func(c net.Conn) {
						defer c.Close()
						// Read something to ensure handshake completes
						buf := make([]byte, 1)
						_, _ = c.Read(buf)
					}(conn)
				}
			}()

			// Build config with TLS policy
			conf := NewConfig()
			conf.Credentials, err = NewCredentialManager([]string{caFile})
			if err != nil {
				t.Fatalf("credential manager: %v", err)
			}
			t.Cleanup(conf.Close)

			conf.ResolvedTLSPolicy = TLSPolicy{
				MinVersion: tc.policyMinTLS,
				MaxVersion: tc.policyMaxTLS,
				Source:     TLSConfigSourceConfig,
			}

			// Create client TLS config and apply policy
			clientTLSConfig := &tls.Config{
				RootCAs: conf.CertPool(),
			}
			conf.ResolvedTLSPolicy.ApplyTo(clientTLSConfig)

			// Attempt connection with timeout
			dialer := &net.Dialer{Timeout: 2 * time.Second}
			conn, err := tls.DialWithDialer(dialer, "tcp", ln.Addr().String(), clientTLSConfig)
			if tc.shouldConnect {
				if err != nil {
					t.Fatalf("expected connection to succeed: %v", err)
				}
				// Write something to trigger the server's read
				_, _ = conn.Write([]byte("x"))
				conn.Close()
			} else {
				if err == nil {
					conn.Close()
					t.Fatal("expected connection to fail due to TLS version mismatch")
				}
			}
		})
	}
}

// TestTLSPolicyEnforcement_CipherConstraints verifies that the TLS policy correctly
// enforces cipher suite constraints. A server requiring a specific cipher should
// reject clients that don't offer it.
func TestTLSPolicyEnforcement_CipherConstraints(t *testing.T) {
	tmpDir := t.TempDir()

	// Create CA and server certificate
	ca, caPEM, caKey := certtest.MustGenCA(t, "TestCA")
	serverCertPEM, serverKeyPEM := certtest.MustServerCertWithIPSignedByCA(t, ca, caKey, []net.IP{net.ParseIP("127.0.0.1")})
	pair, err := tls.X509KeyPair(serverCertPEM, serverKeyPEM)
	if err != nil {
		t.Fatalf("load server keypair: %v", err)
	}

	// Write CA to file
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0o600); err != nil {
		t.Fatalf("write ca: %v", err)
	}

	// Use TLS 1.2 for cipher suite tests (TLS 1.3 ciphers are not configurable in Go)
	serverCiphers := []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256}
	clientMatchingCiphers := []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256}
	clientNonMatchingCiphers := []uint16{tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384}

	tests := []struct {
		name          string
		policyCiphers []uint16
		shouldConnect bool
	}{
		{
			name:          "matching cipher suites connect",
			policyCiphers: clientMatchingCiphers,
			shouldConnect: true,
		},
		{
			name:          "non-matching cipher suites fail",
			policyCiphers: clientNonMatchingCiphers,
			shouldConnect: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Server with specific cipher suite
			serverTLSConfig := &tls.Config{
				Certificates: []tls.Certificate{pair},
				MinVersion:   tls.VersionTLS12,
				MaxVersion:   tls.VersionTLS12,
				CipherSuites: serverCiphers,
			}
			ln, err := tls.Listen("tcp", "127.0.0.1:0", serverTLSConfig)
			if err != nil {
				t.Fatalf("listen: %v", err)
			}
			defer ln.Close()

			go func() {
				for {
					conn, err := ln.Accept()
					if err != nil {
						return
					}
					go func(c net.Conn) {
						defer c.Close()
						buf := make([]byte, 1)
						_, _ = c.Read(buf)
					}(conn)
				}
			}()

			// Build config with TLS policy
			conf := NewConfig()
			conf.Credentials, err = NewCredentialManager([]string{caFile})
			if err != nil {
				t.Fatalf("credential manager: %v", err)
			}
			t.Cleanup(conf.Close)

			conf.ResolvedTLSPolicy = TLSPolicy{
				MinVersion:   tls.VersionTLS12,
				MaxVersion:   tls.VersionTLS12,
				CipherSuites: tc.policyCiphers,
				Source:       TLSConfigSourceConfig,
			}

			// Create client TLS config and apply policy
			clientTLSConfig := &tls.Config{
				RootCAs: conf.CertPool(),
			}
			conf.ResolvedTLSPolicy.ApplyTo(clientTLSConfig)

			dialer := &net.Dialer{Timeout: 2 * time.Second}
			conn, err := tls.DialWithDialer(dialer, "tcp", ln.Addr().String(), clientTLSConfig)
			if tc.shouldConnect {
				if err != nil {
					t.Fatalf("expected connection to succeed: %v", err)
				}
				_, _ = conn.Write([]byte("x"))
				conn.Close()
			} else {
				if err == nil {
					conn.Close()
					t.Fatal("expected connection to fail due to cipher mismatch")
				}
			}
		})
	}
}

// TestTLSPolicyEnforcement_SkipVerifyDoesNotBypassVersionCiphers verifies that
// InsecureSkipVerify only skips certificate verification but does NOT bypass
// TLS version or cipher suite enforcement.
func TestTLSPolicyEnforcement_SkipVerifyDoesNotBypassVersionCiphers(t *testing.T) {
	tmpDir := t.TempDir()

	// Create CA and server certificate
	ca, caPEM, caKey := certtest.MustGenCA(t, "TestCA")
	serverCertPEM, serverKeyPEM := certtest.MustServerCertWithIPSignedByCA(t, ca, caKey, []net.IP{net.ParseIP("127.0.0.1")})
	pair, err := tls.X509KeyPair(serverCertPEM, serverKeyPEM)
	if err != nil {
		t.Fatalf("load server keypair: %v", err)
	}

	// Write CA to file (not actually needed since we're skipping verify, but setup anyway)
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0o600); err != nil {
		t.Fatalf("write ca: %v", err)
	}
	_ = caFile // silence unused warning

	t.Run("skip-verify still enforces TLS version", func(t *testing.T) {
		// TLS 1.3-only server
		serverTLSConfig := &tls.Config{
			Certificates: []tls.Certificate{pair},
			MinVersion:   tls.VersionTLS13,
			MaxVersion:   tls.VersionTLS13,
		}
		ln, err := tls.Listen("tcp", "127.0.0.1:0", serverTLSConfig)
		if err != nil {
			t.Fatalf("listen: %v", err)
		}
		defer ln.Close()

		go func() {
			for {
				conn, err := ln.Accept()
				if err != nil {
					return
				}
				go func(c net.Conn) {
					defer c.Close()
					buf := make([]byte, 1)
					_, _ = c.Read(buf)
				}(conn)
			}
		}()

		// Client with TLS 1.2-only policy AND skip-verify enabled
		conf := NewConfig()
		conf.Credentials, err = NewCredentialManager(nil)
		if err != nil {
			t.Fatalf("credential manager: %v", err)
		}
		t.Cleanup(conf.Close)

		conf.ResolvedTLSPolicy = TLSPolicy{
			MinVersion: tls.VersionTLS12,
			MaxVersion: tls.VersionTLS12,
			Source:     TLSConfigSourceConfig,
		}

		// Create client TLS config with InsecureSkipVerify AND policy applied
		clientTLSConfig := &tls.Config{
			InsecureSkipVerify: true, // Skip cert verification
		}
		conf.ResolvedTLSPolicy.ApplyTo(clientTLSConfig)

		// Verify InsecureSkipVerify is still true after ApplyTo
		if !clientTLSConfig.InsecureSkipVerify {
			t.Fatal("ApplyTo should preserve InsecureSkipVerify")
		}

		// Verify version constraint is applied despite skip-verify
		if clientTLSConfig.MinVersion != tls.VersionTLS12 {
			t.Fatalf("expected MinVersion TLS1.2, got %x", clientTLSConfig.MinVersion)
		}
		if clientTLSConfig.MaxVersion != tls.VersionTLS12 {
			t.Fatalf("expected MaxVersion TLS1.2, got %x", clientTLSConfig.MaxVersion)
		}

		// Connection should FAIL due to version mismatch even though skip-verify is true
		dialer := &net.Dialer{Timeout: 2 * time.Second}
		conn, err := tls.DialWithDialer(dialer, "tcp", ln.Addr().String(), clientTLSConfig)
		if err == nil {
			conn.Close()
			t.Fatal("skip-verify should NOT bypass TLS version enforcement - expected connection to fail")
		}
		// The error should be about protocol version, not certificate
		t.Logf("Connection correctly failed with skip-verify enabled: %v", err)
	})

	t.Run("skip-verify still enforces cipher suites", func(t *testing.T) {
		// TLS 1.2 server with specific cipher
		serverTLSConfig := &tls.Config{
			Certificates: []tls.Certificate{pair},
			MinVersion:   tls.VersionTLS12,
			MaxVersion:   tls.VersionTLS12,
			CipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
		}
		ln, err := tls.Listen("tcp", "127.0.0.1:0", serverTLSConfig)
		if err != nil {
			t.Fatalf("listen: %v", err)
		}
		defer ln.Close()

		go func() {
			for {
				conn, err := ln.Accept()
				if err != nil {
					return
				}
				go func(c net.Conn) {
					defer c.Close()
					buf := make([]byte, 1)
					_, _ = c.Read(buf)
				}(conn)
			}
		}()

		// Client with different cipher AND skip-verify enabled
		conf := NewConfig()
		conf.Credentials, err = NewCredentialManager(nil)
		if err != nil {
			t.Fatalf("credential manager: %v", err)
		}
		t.Cleanup(conf.Close)

		conf.ResolvedTLSPolicy = TLSPolicy{
			MinVersion:   tls.VersionTLS12,
			MaxVersion:   tls.VersionTLS12,
			CipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384}, // Different cipher
			Source:       TLSConfigSourceConfig,
		}

		clientTLSConfig := &tls.Config{
			InsecureSkipVerify: true,
		}
		conf.ResolvedTLSPolicy.ApplyTo(clientTLSConfig)

		// Verify cipher constraint is applied
		if len(clientTLSConfig.CipherSuites) != 1 || clientTLSConfig.CipherSuites[0] != tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 {
			t.Fatal("ApplyTo should apply cipher suites even with skip-verify")
		}

		// Connection should FAIL due to cipher mismatch even though skip-verify is true
		dialer := &net.Dialer{Timeout: 2 * time.Second}
		conn, err := tls.DialWithDialer(dialer, "tcp", ln.Addr().String(), clientTLSConfig)
		if err == nil {
			conn.Close()
			t.Fatal("skip-verify should NOT bypass cipher suite enforcement - expected connection to fail")
		}
		t.Logf("Connection correctly failed with skip-verify enabled: %v", err)
	})

	t.Run("skip-verify allows connection when version and ciphers match", func(t *testing.T) {
		// This proves skip-verify does allow skipping CERTIFICATE verification
		// while still enforcing version/cipher constraints
		serverTLSConfig := &tls.Config{
			Certificates: []tls.Certificate{pair},
			MinVersion:   tls.VersionTLS12,
			MaxVersion:   tls.VersionTLS12,
			CipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
		}
		ln, err := tls.Listen("tcp", "127.0.0.1:0", serverTLSConfig)
		if err != nil {
			t.Fatalf("listen: %v", err)
		}
		defer ln.Close()

		go func() {
			for {
				conn, err := ln.Accept()
				if err != nil {
					return
				}
				go func(c net.Conn) {
					defer c.Close()
					buf := make([]byte, 1)
					_, _ = c.Read(buf)
				}(conn)
			}
		}()

		// Client WITHOUT the CA but WITH skip-verify and matching policy
		conf := NewConfig()
		conf.Credentials, err = NewCredentialManager(nil) // No CA loaded
		if err != nil {
			t.Fatalf("credential manager: %v", err)
		}
		t.Cleanup(conf.Close)

		conf.ResolvedTLSPolicy = TLSPolicy{
			MinVersion:   tls.VersionTLS12,
			MaxVersion:   tls.VersionTLS12,
			CipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256}, // Matching cipher
			Source:       TLSConfigSourceConfig,
		}

		clientTLSConfig := &tls.Config{
			InsecureSkipVerify: true,
			// No RootCAs - normally would fail cert verification
		}
		conf.ResolvedTLSPolicy.ApplyTo(clientTLSConfig)

		// Connection should SUCCEED because skip-verify allows skipping cert verification
		// and version/ciphers match
		dialer := &net.Dialer{Timeout: 2 * time.Second}
		conn, err := tls.DialWithDialer(dialer, "tcp", ln.Addr().String(), clientTLSConfig)
		if err != nil {
			t.Fatalf("skip-verify should allow connection when version/ciphers match: %v", err)
		}
		_, _ = conn.Write([]byte("x"))
		conn.Close()
	})
}

// TestTLSPolicyEnforcement_EmptyPolicyDefaultsToTLS12 verifies that when no policy
// is explicitly configured, the ApplyTo method defaults to TLS 1.2 minimum.
func TestTLSPolicyEnforcement_EmptyPolicyDefaultsToTLS12(t *testing.T) {
	// Empty policy (all zero values)
	policy := TLSPolicy{}

	cfg := &tls.Config{}
	policy.ApplyTo(cfg)

	if cfg.MinVersion != tls.VersionTLS12 {
		t.Fatalf("empty policy should default to TLS 1.2 minimum, got %x", cfg.MinVersion)
	}
}

// TestTLSPolicyEnforcement_PolicyOverridesCfgValues verifies that the policy
// always overrides any pre-existing values in the tls.Config.
func TestTLSPolicyEnforcement_PolicyOverridesCfgValues(t *testing.T) {
	policy := TLSPolicy{
		MinVersion:   tls.VersionTLS12,
		MaxVersion:   tls.VersionTLS12,
		CipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
		Source:       TLSConfigSourceConfig,
	}

	// Pre-set cfg with different values
	cfg := &tls.Config{
		MinVersion:   tls.VersionTLS13,
		MaxVersion:   tls.VersionTLS13,
		CipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384},
	}

	policy.ApplyTo(cfg)

	// Policy should override all values
	if cfg.MinVersion != tls.VersionTLS12 {
		t.Fatalf("policy should override cfg.MinVersion, got %x", cfg.MinVersion)
	}
	if cfg.MaxVersion != tls.VersionTLS12 {
		t.Fatalf("policy should override cfg.MaxVersion, got %x", cfg.MaxVersion)
	}
	if len(cfg.CipherSuites) != 1 || cfg.CipherSuites[0] != tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 {
		t.Fatalf("policy should override cfg.CipherSuites, got %v", cfg.CipherSuites)
	}
}

// TestTLSPolicyEnforcement_TLS13ClearsCustomCiphers verifies that when the policy
// specifies TLS 1.3, custom cipher suites are cleared (Go manages TLS 1.3 ciphers).
func TestTLSPolicyEnforcement_TLS13ClearsCustomCiphers(t *testing.T) {
	tests := []struct {
		name       string
		minVersion uint16
		maxVersion uint16
	}{
		{"TLS1.3 min only", tls.VersionTLS13, 0},
		{"TLS1.3 max only", 0, tls.VersionTLS13},
		{"TLS1.3 min and max", tls.VersionTLS13, tls.VersionTLS13},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			policy := TLSPolicy{
				MinVersion:   tc.minVersion,
				MaxVersion:   tc.maxVersion,
				CipherSuites: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256}, // Should be cleared
				Source:       TLSConfigSourceConfig,
			}

			cfg := &tls.Config{}
			policy.ApplyTo(cfg)

			// For TLS 1.3, custom ciphers should be cleared
			if cfg.CipherSuites != nil {
				t.Fatalf("TLS 1.3 should clear CipherSuites, got %v", cfg.CipherSuites)
			}
		})
	}
}

// TestTLSPolicyEnforcement_PreservesOtherConfigFields verifies that ApplyTo
// preserves other tls.Config fields like NextProtos and InsecureSkipVerify.
func TestTLSPolicyEnforcement_PreservesOtherConfigFields(t *testing.T) {
	policy := TLSPolicy{
		MinVersion: tls.VersionTLS12,
		Source:     TLSConfigSourceConfig,
	}

	cfg := &tls.Config{
		NextProtos:         []string{"h2", "http/1.1"},
		InsecureSkipVerify: true,
		ServerName:         "test.example.com",
	}

	policy.ApplyTo(cfg)

	// These should be preserved
	if len(cfg.NextProtos) != 2 || cfg.NextProtos[0] != "h2" {
		t.Fatalf("ApplyTo should preserve NextProtos, got %v", cfg.NextProtos)
	}
	if !cfg.InsecureSkipVerify {
		t.Fatal("ApplyTo should preserve InsecureSkipVerify")
	}
	if cfg.ServerName != "test.example.com" {
		t.Fatalf("ApplyTo should preserve ServerName, got %s", cfg.ServerName)
	}
}
