package business

import (
	"crypto/tls"
	"net/http"
	"testing"
	"time"

	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
)

func TestHttpClientWithPoolEnforcesPolicy(t *testing.T) {
	conf := config.NewConfig()
	conf.ResolvedTLSPolicy = config.TLSPolicy{
		MinVersion: tls.VersionTLS13,
		MaxVersion: tls.VersionTLS13,
		Source:     config.TLSConfigSourceConfig,
	}

	restCfg := rest.Config{
		Host:    "https://example.com",
		Timeout: 5 * time.Second,
	}

	client, err := httpClientWithPool(conf, restCfg)
	if err != nil {
		t.Fatalf("httpClientWithPool: %v", err)
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
}
