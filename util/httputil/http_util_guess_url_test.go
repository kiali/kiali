package httputil_test

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/httputil"
)

func setupAndCreateRequest() (*config.Config, *http.Request) {
	conf := config.NewConfig()
	conf.Server.WebRoot = "/custom/kiali"
	conf.Server.Port = 700

	request, _ := http.NewRequest("GET", "https://kiali:2800/custom/kiali/path/", nil)
	return conf, request
}

func TestGuessKialiURLParsesFromRequest(t *testing.T) {
	guessedUrl := httputil.GuessKialiURL(setupAndCreateRequest())

	assert.Equal(t, "https://kiali:2800/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsForwardedSchema(t *testing.T) {
	// See reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Proto

	conf, request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Proto", "http")
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "http://kiali:2800/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsForwardedHost(t *testing.T) {
	// See reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host

	conf, request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Host", "id42.example-cdn.com")
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "https://id42.example-cdn.com:2800/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsForwardedPort(t *testing.T) {
	// See reference: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/x-forwarded-headers.html#x-forwarded-port

	conf, request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Port", "123456")
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "https://kiali:123456/custom/kiali", guessedUrl)
}

func TestGuessKialiURLWebFQDNPort(t *testing.T) {
	// See reference: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/x-forwarded-headers.html#x-forwarded-port

	conf := config.NewConfig()
	conf.Server.WebRoot = "/custom/kiali"
	conf.Server.WebPort = "1234"
	conf.Server.Port = 700

	request, _ := http.NewRequest("GET", "https://kiali:2800/custom/kiali/path/", nil)
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "https://kiali:1234/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsHostPortFromRequestUrlAttr(t *testing.T) {
	conf, request := setupAndCreateRequest()
	request.URL.Host = "myHost:8000"
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "https://myHost:8000/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsHostPortFromHostAttr(t *testing.T) {
	conf, request := setupAndCreateRequest()
	request.URL.Host = ""
	request.Host = "example.com:901"
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "https://example.com:901/custom/kiali", guessedUrl)
}

func TestGuessKialiURLReadsHostPortFromHostAttrDefault(t *testing.T) {
	conf, request := setupAndCreateRequest()
	request.URL.Host = "example.com"
	request.Host = "example.com"
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "https://example.com/custom/kiali", guessedUrl)
}

func TestGuessKialiURLOmitsStandardPlainHttpPort(t *testing.T) {
	// See reference: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/x-forwarded-headers.html#x-forwarded-port

	conf, request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Port", "80")
	request.Header.Add("X-Forwarded-Proto", "http")
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "http://kiali/custom/kiali", guessedUrl)
}

func TestGuessKialiURLOmitsStandardSecureHttpsPort(t *testing.T) {
	// See reference: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/x-forwarded-headers.html#x-forwarded-port

	conf, request := setupAndCreateRequest()
	request.Header.Add("X-Forwarded-Port", "443")
	request.Header.Add("X-Forwarded-Proto", "https")
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "https://kiali/custom/kiali", guessedUrl)
}

func TestGuessKialiURLPrioritizesConfig(t *testing.T) {
	conf, request := setupAndCreateRequest()

	conf.Server.WebFQDN = "subdomain.domain.dev"
	conf.Server.WebPort = "4321"
	conf.Server.WebRoot = "/foo/bar"
	conf.Server.WebSchema = "http"
	conf.Server.Port = 700

	request.Header.Add("X-Forwarded-Port", "443")
	request.Header.Add("X-Forwarded-Proto", "https")
	guessedUrl := httputil.GuessKialiURL(conf, request)

	assert.Equal(t, "http://subdomain.domain.dev:4321/foo/bar", guessedUrl)
}

func TestHTTPPostSendsPostRequest(t *testing.T) {
	assert := assert.New(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(r.Method, http.MethodPost)
		w.WriteHeader(200)
	}))
	t.Cleanup(server.Close)

	_, _, _, err := httputil.HttpPost(server.URL, nil, nil, time.Second, nil, config.NewConfig())
	assert.NoError(err)
}

// generateTestCertificate creates a self-signed certificate and key for testing
func generateTestCertificate(t *testing.T, cn string) (certPEM, keyPEM []byte) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("Failed to generate private key: %v", err)
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			CommonName: cn,
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		t.Fatalf("Failed to create certificate: %v", err)
	}

	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	keyPEM = pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)})

	return certPEM, keyPEM
}

func TestGetTLSConfig_WithCAFile(t *testing.T) {
	// Create a temporary CA file
	tmpDir := t.TempDir()
	caFile := tmpDir + "/ca.crt"

	// Generate a valid test certificate
	caCertPEM, _ := generateTestCertificate(t, "Test CA")

	err := os.WriteFile(caFile, caCertPEM, 0600)
	if err != nil {
		t.Fatalf("Failed to create temp CA file: %v", err)
	}

	conf := config.NewConfig()
	auth := &config.Auth{CAFile: caFile}

	tlsConfig, err := httputil.GetTLSConfig(conf, auth)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if tlsConfig == nil {
		t.Error("Expected TLS config, got nil")
	}
	if tlsConfig != nil && tlsConfig.RootCAs == nil {
		t.Error("Expected RootCAs to be set")
	}
}

func TestGetTLSConfig_WithInsecureSkipVerify(t *testing.T) {
	conf := config.NewConfig()
	auth := &config.Auth{InsecureSkipVerify: true}

	tlsConfig, err := httputil.GetTLSConfig(conf, auth)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if tlsConfig == nil {
		t.Error("Expected TLS config, got nil")
	}
	if tlsConfig != nil && !tlsConfig.InsecureSkipVerify {
		t.Error("Expected InsecureSkipVerify to be true")
	}
}

func TestGetTLSConfig_WithClientCertificate(t *testing.T) {
	// This test verifies that GetTLSConfig sets up the GetClientCertificate callback
	// when cert_file and key_file are provided
	tmpDir := t.TempDir()
	certFile := tmpDir + "/client.crt"
	keyFile := tmpDir + "/client.key"

	// Generate valid test certificate and key
	certPEM, keyPEM := generateTestCertificate(t, "Test Client")

	err := os.WriteFile(certFile, certPEM, 0600)
	if err != nil {
		t.Fatalf("Failed to create temp cert file: %v", err)
	}
	err = os.WriteFile(keyFile, keyPEM, 0600)
	if err != nil {
		t.Fatalf("Failed to create temp key file: %v", err)
	}

	conf := config.NewConfig()
	auth := &config.Auth{CertFile: certFile, KeyFile: keyFile}

	tlsConfig, err := httputil.GetTLSConfig(conf, auth)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if tlsConfig == nil {
		t.Error("Expected TLS config, got nil")
	}
	if tlsConfig != nil && tlsConfig.GetClientCertificate == nil {
		t.Error("Expected GetClientCertificate callback to be set")
	}

	// Test that the callback actually loads the certificate
	if tlsConfig != nil && tlsConfig.GetClientCertificate != nil {
		cert, err := tlsConfig.GetClientCertificate(nil)
		if err != nil {
			t.Errorf("GetClientCertificate callback failed: %v", err)
		}
		if cert == nil {
			t.Error("Expected certificate from callback, got nil")
		}
	}
}

func TestGetTLSConfig_NilAuth(t *testing.T) {
	conf := config.NewConfig()
	tlsConfig, err := httputil.GetTLSConfig(conf, nil)
	if err != nil {
		t.Errorf("Expected no error with nil auth, got: %v", err)
	}
	if tlsConfig != nil {
		t.Error("Expected nil TLS config with nil auth")
	}
}

func TestGetTLSConfig_EmptyAuth(t *testing.T) {
	conf := config.NewConfig()
	auth := &config.Auth{}
	tlsConfig, err := httputil.GetTLSConfig(conf, auth)
	if err != nil {
		t.Errorf("Expected no error with empty auth, got: %v", err)
	}
	if tlsConfig != nil {
		t.Error("Expected nil TLS config with empty auth")
	}
}

func TestGetTLSConfig_ClientCertificateRotation(t *testing.T) {
	// This test verifies that certificate rotation works - when certificate files
	// are updated on disk, the next TLS handshake picks up the new certificate
	tmpDir := t.TempDir()
	certFile := tmpDir + "/client.crt"
	keyFile := tmpDir + "/client.key"

	// Generate initial certificate with CN "Initial Cert"
	certPEM1, keyPEM1 := generateTestCertificate(t, "Initial Cert")
	err := os.WriteFile(certFile, certPEM1, 0600)
	if err != nil {
		t.Fatalf("Failed to create initial cert file: %v", err)
	}
	err = os.WriteFile(keyFile, keyPEM1, 0600)
	if err != nil {
		t.Fatalf("Failed to create initial key file: %v", err)
	}

	conf := config.NewConfig()
	auth := &config.Auth{CertFile: certFile, KeyFile: keyFile}

	tlsConfig, err := httputil.GetTLSConfig(conf, auth)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Load initial certificate via callback
	cert1, err := tlsConfig.GetClientCertificate(nil)
	if err != nil {
		t.Fatalf("Failed to load initial certificate: %v", err)
	}
	if cert1 == nil {
		t.Fatal("Expected initial certificate, got nil")
	}
	// Parse and record CN of first certificate
	cert1Parsed, err := x509.ParseCertificate(cert1.Certificate[0])
	if err != nil {
		t.Fatalf("Failed to parse initial certificate: %v", err)
	}

	// Simulate certificate rotation: update the files with a new certificate
	certPEM2, keyPEM2 := generateTestCertificate(t, "Rotated Cert")
	err = os.WriteFile(certFile, certPEM2, 0600)
	if err != nil {
		t.Fatalf("Failed to write rotated cert file: %v", err)
	}
	err = os.WriteFile(keyFile, keyPEM2, 0600)
	if err != nil {
		t.Fatalf("Failed to write rotated key file: %v", err)
	}

	// Call the callback again - it should load the NEW certificate from disk
	cert2, err := tlsConfig.GetClientCertificate(nil)
	if err != nil {
		t.Fatalf("Failed to load rotated certificate: %v", err)
	}
	if cert2 == nil {
		t.Fatal("Expected rotated certificate, got nil")
	}
	cert2Parsed, err := x509.ParseCertificate(cert2.Certificate[0])
	if err != nil {
		t.Fatalf("Failed to parse rotated certificate: %v", err)
	}
	// Verify CN actually changed to ensure rotation truly occurred
	if cert1Parsed.Subject.CommonName == cert2Parsed.Subject.CommonName {
		t.Errorf("Expected certificate CN to change after rotation, but both are %q", cert1Parsed.Subject.CommonName)
	}
}
