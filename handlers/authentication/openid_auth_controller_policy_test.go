package authentication

import (
	"crypto/tls"
	"net/http"
	"testing"

	"github.com/kiali/kiali/config"
)

func TestCreateHttpClientEnforcesPolicy(t *testing.T) {
	conf := config.NewConfig()
	conf.ResolvedTLSPolicy = config.TLSPolicy{
		MinVersion: tls.VersionTLS13,
		MaxVersion: tls.VersionTLS13,
		Source:     config.TLSConfigSourceConfig,
	}
	conf.Auth.OpenId.InsecureSkipVerifyTLS = true

	client, err := createHttpClient(conf, "https://example.com")
	if err != nil {
		t.Fatalf("createHttpClient: %v", err)
	}

	transport, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("expected *http.Transport, got %T", client.Transport)
	}
	if transport.TLSClientConfig == nil {
		t.Fatal("expected TLSClientConfig to be set")
	}
	if transport.TLSClientConfig.MinVersion != tls.VersionTLS13 || transport.TLSClientConfig.MaxVersion != tls.VersionTLS13 {
		t.Fatalf("expected TLS1.3-only policy, got min [%x] max [%x]", transport.TLSClientConfig.MinVersion, transport.TLSClientConfig.MaxVersion)
	}
	if !transport.TLSClientConfig.InsecureSkipVerify {
		t.Fatal("expected InsecureSkipVerify to be preserved")
	}
}
