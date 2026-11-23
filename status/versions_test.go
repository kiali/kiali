package status

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
)

func TestTracingVersionSkipsJaegerGRPC(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing = config.TracingConfig{
		Auth:        config.Auth{Type: config.AuthTypeBearer, UseKialiToken: true},
		Enabled:     true,
		ExternalURL: "https://tracing.example/jaeger",
		InternalURL: "http://tracing.example:16685",
		Provider:    config.JaegerProvider,
		UseGRPC:     true,
	}

	// Version metadata is best-effort. A gRPC configuration needs no HTTP
	// request and can return the integration info without a credential source.
	product, err := tracingVersion(conf, nil)
	require.NoError(t, err)
	require.NotNil(t, product)
	assert.Equal(t, "jaeger", product.Name)
	assert.Equal(t, "https://tracing.example/jaeger", product.Url)
	assert.Empty(t, product.Version)
}

func TestTracingVersionUsesConfiguredJaegerHTTPURL(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/jaeger", r.URL.Path)
		_, _ = io.WriteString(w, `const JAEGER_VERSION = {"gitVersion":"v1.2.3"};`)
	}))
	t.Cleanup(backend.Close)

	conf := config.NewConfig()
	conf.ExternalServices.Tracing = config.TracingConfig{
		Enabled:     true,
		InternalURL: backend.URL + "/jaeger",
		Provider:    config.JaegerProvider,
	}

	product, err := tracingVersion(conf, nil)
	require.NoError(t, err)
	require.NotNil(t, product)
	assert.Equal(t, "v1.2.3", product.Version)
}
