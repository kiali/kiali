package status

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/version"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
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

// countingVersionClient counts GetServerVersion probes and can be flipped between
// failing and succeeding. It embeds the interface because getKubernetesVersions uses
// nothing else from the client.
type countingVersionClient struct {
	kubernetes.ClientInterface
	fail   bool
	probes *int
}

func (c *countingVersionClient) GetServerVersion() (*version.Info, error) {
	*c.probes++
	if c.fail {
		return nil, errVersionFetch
	}
	return &version.Info{GitVersion: "v1.30.0"}, nil
}

// saclientsOnlyFactory serves getKubernetesVersions, which needs only GetSAClients.
type saclientsOnlyFactory struct {
	kubernetes.ClientFactory
	clients map[string]kubernetes.ClientInterface
}

func (f *saclientsOnlyFactory) GetSAClients() map[string]kubernetes.ClientInterface {
	return f.clients
}

// errVersionFetch stands in for an indeterminate transport failure (unreachable,
// stalled) rather than an authentication or authorization problem.
var errVersionFetch = &timeoutError{}

type timeoutError struct{}

func (e *timeoutError) Error() string { return "context deadline exceeded" }

// TestGetKubernetesVersionsMemoizesFailuresAndSuccesses verifies the version-fetch
// memoization: an indeterminate failure is probed once per backoff window instead of
// on every call (the mesh graph calls this on every render, and an unreachable remote
// would otherwise cost its full request timeout each time), and a successful fetch is
// cached for the process lifetime since a cluster's server version is effectively
// static.
func TestGetKubernetesVersionsMemoizesFailuresAndSuccesses(t *testing.T) {
	require := require.New(t)

	var probes int
	client := &countingVersionClient{fail: true, probes: &probes}
	factory := &saclientsOnlyFactory{clients: map[string]kubernetes.ClientInterface{"east": client}}
	t.Cleanup(func() { kubeVersionCache.Delete("east") })

	// The first call probes the cluster and records the indeterminate failure.
	versions := getKubernetesVersions(factory)
	require.Empty(versions)
	require.Equal(1, probes)

	// Within the backoff window the failure is trusted: no re-probe.
	versions = getKubernetesVersions(factory)
	require.Empty(versions)
	require.Equal(1, probes)

	// After the window expires the cluster is probed again.
	entry, ok := kubeVersionCache.Load("east")
	require.True(ok)
	result := entry.(kubeVersionResult)
	kubeVersionCache.Store("east", kubeVersionResult{failedAt: result.failedAt.Add(-kubeVersionFailureBackoff - time.Second)})
	versions = getKubernetesVersions(factory)
	require.Empty(versions)
	require.Equal(2, probes)

	// A successful fetch is cached for the process lifetime.
	client.fail = false
	kubeVersionCache.Delete("east")
	versions = getKubernetesVersions(factory)
	require.Len(versions, 1)
	require.Equal("v1.30.0", versions[0].Version)
	require.Equal(3, probes)

	versions = getKubernetesVersions(factory)
	require.Len(versions, 1)
	require.Equal("v1.30.0", versions[0].Version)
	require.Equal(3, probes, "a successful fetch must be served from the cache without re-probing")
}
