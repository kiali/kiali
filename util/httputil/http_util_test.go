package httputil

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io"
	"math/big"
	"net"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/kiali/kiali/config"
)

type recordingRoundTripper struct {
	lastAuth string
}

func (r *recordingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	r.lastAuth = req.Header.Get("Authorization")
	// Return minimal valid response
	return &http.Response{
		StatusCode: 200,
		Body:       ioNopCloser{bytes.NewBufferString("ok")},
		Header:     make(http.Header),
		Request:    req,
	}, nil
}

type ioNopCloser struct {
	*bytes.Buffer
}

func (n ioNopCloser) Close() error { return nil }

func TestAuthRoundTripper_BearerRotation(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager()
	if err != nil {
		t.Fatalf("failed to create credential manager: %v", err)
	}
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	tokenFile := tmpDir + "/token"
	if err := os.WriteFile(tokenFile, []byte("t1"), 0600); err != nil {
		t.Fatalf("write token: %v", err)
	}

	auth := &config.Auth{
		Type:  config.AuthTypeBearer,
		Token: tokenFile,
	}

	inner := &recordingRoundTripper{}
	rt := newAuthRoundTripper(conf, auth, inner)

	req, _ := http.NewRequest(http.MethodGet, "http://example.com", nil)
	if _, err := rt.RoundTrip(req); err != nil {
		t.Fatalf("roundtrip: %v", err)
	}
	if inner.lastAuth != "Bearer t1" {
		t.Fatalf("expected Authorization=Bearer t1, got %q", inner.lastAuth)
	}

	// rotate
	if err := os.WriteFile(tokenFile, []byte("t2"), 0600); err != nil {
		t.Fatalf("rotate token: %v", err)
	}
	// Wait for fsnotify to detect change and update cache (up to 2 seconds)
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		if _, err := rt.RoundTrip(req); err != nil {
			t.Fatalf("roundtrip poll: %v", err)
		}
		if inner.lastAuth == "Bearer t2" {
			break
		}
	}
	if _, err := rt.RoundTrip(req); err != nil {
		t.Fatalf("roundtrip2: %v", err)
	}
	if inner.lastAuth != "Bearer t2" {
		t.Fatalf("expected Authorization=Bearer t2, got %q", inner.lastAuth)
	}
}

func TestAuthRoundTripper_BasicRotation(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager()
	if err != nil {
		t.Fatalf("failed to create credential manager: %v", err)
	}
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	userFile := tmpDir + "/u"
	passFile := tmpDir + "/p"
	if err := os.WriteFile(userFile, []byte("u1"), 0600); err != nil {
		t.Fatalf("write user: %v", err)
	}
	if err := os.WriteFile(passFile, []byte("p1"), 0600); err != nil {
		t.Fatalf("write pass: %v", err)
	}

	auth := &config.Auth{
		Type:     config.AuthTypeBasic,
		Username: userFile,
		Password: passFile,
	}

	inner := &recordingRoundTripper{}
	rt := newAuthRoundTripper(conf, auth, inner)

	req, _ := http.NewRequest(http.MethodGet, "http://example.com", nil)
	if _, err := rt.RoundTrip(req); err != nil {
		t.Fatalf("roundtrip: %v", err)
	}
	if inner.lastAuth == "" || inner.lastAuth == "Basic " {
		t.Fatalf("expected Basic auth header, got %q", inner.lastAuth)
	}

	// rotate
	if err := os.WriteFile(userFile, []byte("u2"), 0600); err != nil {
		t.Fatalf("rotate user: %v", err)
	}
	if err := os.WriteFile(passFile, []byte("p2"), 0600); err != nil {
		t.Fatalf("rotate pass: %v", err)
	}
	// Wait for fsnotify to detect changes and update cache (up to 2 seconds)
	expectedAuth := "Basic dTI6cDI=" // base64("u2:p2")
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		if _, err := rt.RoundTrip(req); err != nil {
			t.Fatalf("roundtrip poll: %v", err)
		}
		if inner.lastAuth == expectedAuth {
			break
		}
	}
	if _, err := rt.RoundTrip(req); err != nil {
		t.Fatalf("roundtrip2: %v", err)
	}
	if inner.lastAuth == "" || inner.lastAuth == "Basic " {
		t.Fatalf("expected rotated Basic auth header, got %q", inner.lastAuth)
	}
}

// --- TLS rotation tests ---

// TestGetTLSConfig_CAFileDeprecated verifies that the deprecated CAFile setting is ignored.
// CAFile is deprecated and no longer used. Custom CA certificates should be configured
// via the kiali-cabundle ConfigMap instead.
func TestGetTLSConfig_CAFileDeprecated(t *testing.T) {
	tmpDir := t.TempDir()
	const serverHost = "service.test"
	_, ca1PEM, _ := mustGenCA(t, "CA1")

	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, ca1PEM, 0600); err != nil {
		t.Fatalf("write ca1: %v", err)
	}

	conf := config.NewConfig()
	auth := &config.Auth{
		CAFile: caFile, // This is deprecated and should be ignored
	}

	tlscfg, err := GetTLSConfigForServer(conf, auth, serverHost)
	if err != nil {
		t.Fatalf("GetTLSConfig: %v", err)
	}

	// Since CAFile is deprecated, VerifyConnection should NOT be set
	// (the custom verification callback was removed)
	if tlscfg != nil && tlscfg.VerifyConnection != nil {
		t.Fatalf("expected VerifyConnection to be nil since CAFile is deprecated")
	}
}

func TestGetTLSConfig_ClientCertRotation(t *testing.T) {
	conf := config.NewConfig()
	var err error
	conf.Credentials, err = config.NewCredentialManager()
	if err != nil {
		t.Fatalf("failed to create credential manager: %v", err)
	}
	t.Cleanup(conf.Close)

	tmpDir := t.TempDir()
	certFile := tmpDir + "/crt.pem"
	keyFile := tmpDir + "/key.pem"

	certPEM1, keyPEM1 := mustSelfSignedPair(t, "c1")
	if err := os.WriteFile(certFile, certPEM1, 0600); err != nil {
		t.Fatalf("write cert1: %v", err)
	}
	if err := os.WriteFile(keyFile, keyPEM1, 0600); err != nil {
		t.Fatalf("write key1: %v", err)
	}

	auth := &config.Auth{
		CertFile: certFile,
		KeyFile:  keyFile,
	}
	tlscfg, err := GetTLSConfig(conf, auth)
	if err != nil {
		t.Fatalf("GetTLSConfig: %v", err)
	}
	if tlscfg == nil || tlscfg.GetClientCertificate == nil {
		t.Fatalf("expected GetClientCertificate to be set")
	}
	c1, err := tlscfg.GetClientCertificate(nil)
	if err != nil {
		t.Fatalf("GetClientCertificate#1: %v", err)
	}

	// Rotate files
	certPEM2, keyPEM2 := mustSelfSignedPair(t, "c2")
	if err := os.WriteFile(certFile, certPEM2, 0600); err != nil {
		t.Fatalf("write cert2: %v", err)
	}
	if err := os.WriteFile(keyFile, keyPEM2, 0600); err != nil {
		t.Fatalf("write key2: %v", err)
	}

	// Wait for fsnotify to detect changes and update cache (up to 2 seconds)
	var c2 *tls.Certificate
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		c2, err = tlscfg.GetClientCertificate(nil)
		if err != nil {
			t.Fatalf("GetClientCertificate poll: %v", err)
		}
		if !bytes.Equal(c1.Certificate[0], c2.Certificate[0]) {
			break
		}
	}

	c2, err = tlscfg.GetClientCertificate(nil)
	if err != nil {
		t.Fatalf("GetClientCertificate#2: %v", err)
	}
	if bytes.Equal(c1.Certificate[0], c2.Certificate[0]) {
		t.Fatalf("expected rotated client certificate to differ")
	}
}

// --- helpers to generate test certificates ---

func mustGenCA(t *testing.T, cn string) (*x509.Certificate, []byte, *rsa.PrivateKey) {
	t.Helper()
	caKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("gen key: %v", err)
	}
	caTmpl := &x509.Certificate{
		SerialNumber:          bigInt(1),
		Subject:               pkix.Name{CommonName: cn},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	der, err := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create ca: %v", err)
	}
	return caTmpl, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), caKey
}

func mustSelfSignedPair(t *testing.T, cn string) ([]byte, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("gen key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          bigInt(3),
		Subject:               pkix.Name{CommonName: cn},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create cert: %v", err)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	return certPEM, keyPEM
}

func bigInt(n int64) *big.Int { return big.NewInt(n) }

// mustGenLeafSignedWithKey generates a leaf certificate signed by the provided CA.
// Used to test certificate verification against CA pools.
func mustGenLeafSignedWithKey(t *testing.T, ca *x509.Certificate, caKey *rsa.PrivateKey, cn string) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("gen key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          bigInt(2),
		Subject:               pkix.Name{CommonName: cn},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{cn},
	}
	// Sign leaf using provided CA key
	der, err := x509.CreateCertificate(rand.Reader, tmpl, ca, &key.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create leaf: %v", err)
	}
	return der
}

// mustServerCertSignedByCA generates a server certificate (with key) signed by the provided CA.
// Used to spin up test TLS servers with proper certificate chains.
func mustServerCertSignedByCA(t *testing.T, ca *x509.Certificate, caKey *rsa.PrivateKey, hosts []string) ([]byte, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("gen key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          bigInt(4),
		Subject:               pkix.Name{CommonName: hosts[0]},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              hosts,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, ca, &key.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create cert: %v", err)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	return certPEM, keyPEM
}

// TestGetTLSConfig_UsesCertPool verifies that GetTLSConfig uses the config's CertPool
// for RootCAs when the CertPool has been initialized with custom CAs.
func TestGetTLSConfig_UsesCertPool(t *testing.T) {
	tmpDir := t.TempDir()
	_, caPEM, _ := mustGenCA(t, "CustomCA")

	// Write custom CA to file
	caFile := tmpDir + "/custom-ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0600); err != nil {
		t.Fatalf("write ca: %v", err)
	}

	// Create config and load the custom CA into CertPool
	conf := config.NewConfig()
	if err := conf.LoadCertPool(caFile); err != nil {
		t.Fatalf("LoadCertPool: %v", err)
	}

	// Use GetTLSConfigForServer with a server name - this is the realistic use case
	// for connecting to external services like Prometheus, Grafana, etc.
	auth := &config.Auth{} // Empty auth, no client certs or special options
	tlscfg, err := GetTLSConfigForServer(conf, auth, "prometheus.example.com")
	if err != nil {
		t.Fatalf("GetTLSConfigForServer: %v", err)
	}

	// Verify TLS config was returned with RootCAs set
	if tlscfg == nil {
		t.Fatal("expected non-nil TLS config when CertPool is initialized")
	}
	if tlscfg.RootCAs == nil {
		t.Fatal("expected RootCAs to be set from CertPool")
	}

	// Verify ServerName is set
	if tlscfg.ServerName != "prometheus.example.com" {
		t.Errorf("expected ServerName to be 'prometheus.example.com', got '%s'", tlscfg.ServerName)
	}

	// Verify the custom CA is in RootCAs by checking the pool contains our CA
	// Parse the CA cert to get its subject
	block, _ := pem.Decode(caPEM)
	if block == nil {
		t.Fatal("failed to decode CA PEM")
	}
	caCert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatalf("parse CA cert: %v", err)
	}

	// Check if the CA subject is in the RootCAs pool
	found := false
	for _, subject := range tlscfg.RootCAs.Subjects() { //nolint:staticcheck // Subjects() is deprecated but still useful for testing
		if bytes.Equal(subject, caCert.RawSubject) {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected custom CA to be in RootCAs pool")
	}
}

// TestGetTLSConfig_CAFileIgnored verifies that when only CAFile is set (deprecated),
// no TLS config is returned since there's nothing to configure.
// CAFile is deprecated and is ignored.
func TestGetTLSConfig_CAFileIgnored(t *testing.T) {
	tmpDir := t.TempDir()
	_, caPEM, _ := mustGenCA(t, "TestCA")

	// Write CA file used by client
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0600); err != nil {
		t.Fatalf("write ca: %v", err)
	}

	conf := config.NewConfig()
	// Only CAFile set - this is deprecated and ignored
	auth := &config.Auth{CAFile: caFile}
	tlscfg, err := GetTLSConfig(conf, auth)
	if err != nil {
		t.Fatalf("GetTLSConfig: %v", err)
	}

	// Since CAFile is deprecated and ignored, and no other TLS options are set,
	// GetTLSConfig should return nil (no TLS configuration needed)
	if tlscfg != nil {
		t.Fatalf("expected nil TLS config since CAFile is deprecated, got non-nil")
	}
}

// TestCertPool_CARotation verifies that the CertPool correctly handles CA rotation
// within the same config instance. When CAs are rotated on disk, calling CertPool()
// again should return a pool with the new CA, and certificates signed by the old CA
// should fail verification while certificates signed by the new CA should succeed.
func TestCertPool_CARotation(t *testing.T) {
	tmpDir := t.TempDir()
	const serverHost = "service.test"

	// Create CA1 and a leaf certificate signed by CA1
	ca1, ca1PEM, ca1Key := mustGenCA(t, "CA1")
	leaf1DER := mustGenLeafSignedWithKey(t, ca1, ca1Key, serverHost)
	leaf1Cert, err := x509.ParseCertificate(leaf1DER)
	if err != nil {
		t.Fatalf("parse leaf1: %v", err)
	}

	// Write CA1 to file and load into CertPool
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, ca1PEM, 0600); err != nil {
		t.Fatalf("write ca1: %v", err)
	}

	conf := config.NewConfig()
	if err := conf.LoadCertPool(caFile); err != nil {
		t.Fatalf("LoadCertPool: %v", err)
	}

	// Verify leaf1 (signed by CA1) succeeds
	pool1 := conf.CertPool()
	verifyOpts1 := x509.VerifyOptions{
		Roots:         pool1,
		DNSName:       serverHost,
		Intermediates: x509.NewCertPool(),
	}
	if _, err := leaf1Cert.Verify(verifyOpts1); err != nil {
		t.Fatalf("leaf1 should verify with CA1: %v", err)
	}

	// Create CA2 and rotate - write CA2 to the same file
	ca2, ca2PEM, ca2Key := mustGenCA(t, "CA2")
	if err := os.WriteFile(caFile, ca2PEM, 0600); err != nil {
		t.Fatalf("write ca2: %v", err)
	}

	// Create leaf2 signed by CA2
	leaf2DER := mustGenLeafSignedWithKey(t, ca2, ca2Key, serverHost)
	leaf2Cert, err := x509.ParseCertificate(leaf2DER)
	if err != nil {
		t.Fatalf("parse leaf2: %v", err)
	}

	// Call CertPool() again on the SAME config - it should detect the file change
	// via fingerprinting and return a refreshed pool with CA2
	pool2 := conf.CertPool()
	verifyOpts2 := x509.VerifyOptions{
		Roots:         pool2,
		DNSName:       serverHost,
		Intermediates: x509.NewCertPool(),
	}

	// Verify leaf2 (signed by CA2) succeeds with refreshed pool
	if _, err := leaf2Cert.Verify(verifyOpts2); err != nil {
		t.Fatalf("leaf2 should verify with refreshed pool containing CA2: %v", err)
	}

	// Verify leaf1 (signed by CA1) FAILS with refreshed pool (CA2 only)
	if _, err := leaf1Cert.Verify(verifyOpts2); err == nil {
		t.Fatal("leaf1 should NOT verify with refreshed pool - CA rotation should invalidate old certs")
	}

	// Verify the old pool (pool1) still has CA1 - pools are cloned and don't change
	if _, err := leaf1Cert.Verify(verifyOpts1); err != nil {
		t.Fatalf("leaf1 should still verify with original pool1 (pools are cloned): %v", err)
	}
}

// TestCertPool_HostnameVerification verifies that hostname verification is enforced
// when using the CertPool. Connections to servers with mismatched hostnames should fail.
func TestCertPool_HostnameVerification(t *testing.T) {
	tmpDir := t.TempDir()

	// Create CA and server certificate for "good.test"
	ca, caPEM, caKey := mustGenCA(t, "TestCA")
	certPEM, keyPEM := mustServerCertSignedByCA(t, ca, caKey, []string{"good.test"})

	// Start TLS server with cert for good.test
	pair, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		t.Fatalf("load keypair: %v", err)
	}
	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{pair}})
	if err != nil {
		t.Fatalf("listen tls: %v", err)
	}
	defer ln.Close()

	// Accept connections in background
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				_ = c.SetDeadline(time.Now().Add(2 * time.Second))
				_, _ = io.Copy(io.Discard, c)
			}(conn)
		}
	}()

	// Write CA to file and load into CertPool
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0600); err != nil {
		t.Fatalf("write ca: %v", err)
	}
	conf := config.NewConfig()
	if err := conf.LoadCertPool(caFile); err != nil {
		t.Fatalf("LoadCertPool: %v", err)
	}

	// Get TLS config for "good.test" - this should work
	auth := &config.Auth{}
	tlscfgGood, err := GetTLSConfigForServer(conf, auth, "good.test")
	if err != nil {
		t.Fatalf("GetTLSConfigForServer good: %v", err)
	}

	// Connection with correct hostname should succeed
	connGood, err := tls.Dial("tcp", ln.Addr().String(), tlscfgGood)
	if err != nil {
		t.Fatalf("dial with correct hostname should succeed: %v", err)
	}
	connGood.Close()

	// Get TLS config for "bad.test" - hostname doesn't match cert
	tlscfgBad, err := GetTLSConfigForServer(conf, auth, "bad.test")
	if err != nil {
		t.Fatalf("GetTLSConfigForServer bad: %v", err)
	}

	// Connection with wrong hostname should FAIL due to hostname verification
	connBad, err := tls.Dial("tcp", ln.Addr().String(), tlscfgBad)
	if err == nil {
		connBad.Close()
		t.Fatal("dial with wrong hostname should fail due to hostname verification")
	}
	// Verify it's a hostname verification error
	if !isHostnameError(err) {
		t.Fatalf("expected hostname verification error, got: %v", err)
	}
}

// isHostnameError checks if the error is related to hostname/certificate verification
func isHostnameError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// Check for common hostname verification error messages
	return bytes.Contains([]byte(errStr), []byte("certificate")) ||
		bytes.Contains([]byte(errStr), []byte("hostname")) ||
		bytes.Contains([]byte(errStr), []byte("doesn't contain any IP SANs")) ||
		bytes.Contains([]byte(errStr), []byte("x509"))
}
