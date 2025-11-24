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
	t.Cleanup(config.CloseWatchedCredentials)
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
	rt := newAuthRoundTripper(auth, inner)

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
	t.Cleanup(config.CloseWatchedCredentials)
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
	rt := newAuthRoundTripper(auth, inner)

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

func TestGetTLSConfig_CARotation_VerifyConnection(t *testing.T) {
	tmpDir := t.TempDir()
	ca1, ca1PEM, ca1Key := mustGenCA(t, "CA1")
	leaf1 := mustGenLeafSignedWithKey(t, ca1, ca1Key, "leaf1")

	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, ca1PEM, 0600); err != nil {
		t.Fatalf("write ca1: %v", err)
	}

	conf := config.NewConfig()
	auth := &config.Auth{
		CAFile: caFile,
	}

	tlscfg, err := GetTLSConfig(conf, auth)
	if err != nil {
		t.Fatalf("GetTLSConfig: %v", err)
	}
	if tlscfg == nil || tlscfg.VerifyConnection == nil {
		t.Fatalf("expected VerifyConnection to be set")
	}
	// Verify with leaf1 (signed by ca1) succeeds (no DNS name enforced here)
	leaf1Cert, err := x509.ParseCertificate(leaf1)
	if err != nil {
		t.Fatalf("parse leaf1: %v", err)
	}
	if err := tlscfg.VerifyConnection(tls.ConnectionState{PeerCertificates: []*x509.Certificate{leaf1Cert}}); err != nil {
		t.Fatalf("verify with ca1 should succeed: %v", err)
	}

	// Rotate to CA2
	ca2, ca2PEM, ca2Key := mustGenCA(t, "CA2")
	if err := os.WriteFile(caFile, ca2PEM, 0600); err != nil {
		t.Fatalf("write ca2: %v", err)
	}
	leaf2 := mustGenLeafSignedWithKey(t, ca2, ca2Key, "leaf2")
	leaf2Cert, err := x509.ParseCertificate(leaf2)
	if err != nil {
		t.Fatalf("parse leaf2: %v", err)
	}

	// Verify with leaf2 now succeeds
	if err := tlscfg.VerifyConnection(tls.ConnectionState{PeerCertificates: []*x509.Certificate{leaf2Cert}}); err != nil {
		t.Fatalf("verify with ca2 should succeed: %v", err)
	}
	// Old leaf should now fail
	if err := tlscfg.VerifyConnection(tls.ConnectionState{PeerCertificates: []*x509.Certificate{leaf1Cert}}); err == nil {
		t.Fatalf("verify with old ca should fail")
	}
}

func TestGetTLSConfig_ClientCertRotation(t *testing.T) {
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

	conf := config.NewConfig()
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
	c2, err := tlscfg.GetClientCertificate(nil)
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

func mustGenLeafSignedWithKey(t *testing.T, ca *x509.Certificate, caKey *rsa.PrivateKey, cn string) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("gen key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: bigInt(2),
		Subject:      pkix.Name{CommonName: cn},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
	}
	// Sign leaf using provided CA key
	der, err := x509.CreateCertificate(rand.Reader, tmpl, ca, &key.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create leaf: %v", err)
	}
	return der
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

// --- New helper: generate a server certificate signed by given CA with provided DNS SANs ---
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

// --- New test: ensure hostname verification is enforced in dynamic CA mode ---
func TestGetTLSConfig_DynamicCA_HostnameVerification(t *testing.T) {
	tmpDir := t.TempDir()
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
	// Accept connections and discard
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

	// Write CA file used by client
	caFile := tmpDir + "/ca.pem"
	if err := os.WriteFile(caFile, caPEM, 0600); err != nil {
		t.Fatalf("write ca: %v", err)
	}

	conf := config.NewConfig()
	auth := &config.Auth{CAFile: caFile}
	tlscfg, err := GetTLSConfig(conf, auth)
	if err != nil {
		t.Fatalf("GetTLSConfig: %v", err)
	}
	if tlscfg == nil || tlscfg.VerifyConnection == nil {
		t.Fatalf("expected VerifyConnection to be set")
	}

	addr := ln.Addr().String()
	dialer := &net.Dialer{Timeout: 3 * time.Second}

	// 1) Wrong hostname should fail
	tlscfgWrong := tlscfg.Clone()
	tlscfgWrong.ServerName = "wrong.test"
	conn1, err := tls.DialWithDialer(dialer, "tcp", addr, tlscfgWrong)
	if err == nil {
		conn1.Close()
		t.Fatalf("expected hostname verification failure with wrong.test")
	}

	// 2) Correct hostname should succeed
	tlscfgRight := tlscfg.Clone()
	tlscfgRight.ServerName = "good.test"
	conn2, err := tls.DialWithDialer(dialer, "tcp", addr, tlscfgRight)
	if err != nil {
		t.Fatalf("expected success dialing with good.test, got: %v", err)
	}
	_ = conn2.Close()
}
