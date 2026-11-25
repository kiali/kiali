package status

import (
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/version"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
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
	probes *atomic.Int32
}

func (c *countingVersionClient) GetServerVersion() (*version.Info, error) {
	c.probes.Add(1)
	if c.fail {
		// A transport-level failure (net.Error), the kind the unreachable signal
		// classifies a dead remote by.
		return nil, dialTimeoutError{}
	}
	return &version.Info{GitVersion: "v1.30.0"}, nil
}

// dialTimeoutError models a transport-level failure: it implements net.Error, which is
// how the unreachable signal classifies a dead remote.
type dialTimeoutError struct{}

func (dialTimeoutError) Error() string   { return "dial tcp: i/o timeout" }
func (dialTimeoutError) Timeout() bool   { return true }
func (dialTimeoutError) Temporary() bool { return true }

// saclientsOnlyFactory serves getKubernetesVersions, which needs only GetSAClients.
type saclientsOnlyFactory struct {
	kubernetes.ClientFactory
	clients map[string]kubernetes.ClientInterface
}

func (f *saclientsOnlyFactory) GetSAClients() map[string]kubernetes.ClientInterface {
	return f.clients
}

// TestGetKubernetesVersionsSuspendsOnUnreachableCluster verifies the version fetch
// through the shared unreachable signal: a failed fetch marks the cluster (the mesh
// graph runs this on every render, and an unreachable remote would otherwise cost its
// request timeout each time), a marked cluster is skipped without probing, and a
// successful fetch is cached for the process lifetime since a cluster's server version
// is effectively static.
func TestGetKubernetesVersionsSuspendsOnUnreachableCluster(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	var probes atomic.Int32
	west := &countingVersionClient{fail: true, probes: &probes}
	// The cache is built from plain fakes (its constructor runs startup access reviews
	// against every client); only the factory - the path getKubernetesVersions probes
	// through - serves the counting client.
	factory := &saclientsOnlyFactory{clients: map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
		"west": west,
	}}
	kialiCache := cache.NewTestingCacheWithClients(t, map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
		"west": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
	}, *conf)
	t.Cleanup(func() { kubeVersionCache.Delete("west") })

	// The first call probes the remote and marks it unreachable; the reachable home
	// cluster's version is still fetched.
	versions := getKubernetesVersions(factory, kialiCache)
	require.Len(versions, 1)
	require.Equal("Kubernetes-east", versions[0].Name)
	require.Equal(int32(1), probes.Load())
	require.True(kialiCache.IsClusterUnreachable("west"))

	// While marked, the remote is skipped: no re-probe.
	versions = getKubernetesVersions(factory, kialiCache)
	require.Len(versions, 1)
	require.Equal("Kubernetes-east", versions[0].Name)
	require.Equal(int32(1), probes.Load())

	// The prober clears the mark on recovery; the fetch probes again and succeeds.
	west.fail = false
	kialiCache.ClearClusterUnreachable("west")
	versions = getKubernetesVersions(factory, kialiCache)
	require.Len(versions, 2)
	versionByName := func(name string) string {
		for _, v := range versions {
			if v.Name == name {
				return v.Version
			}
		}
		return ""
	}
	require.Equal("v1.30.0", versionByName("Kubernetes-west"))
	require.Equal(int32(2), probes.Load())

	// A successful fetch is served from the cache for the process lifetime.
	versions = getKubernetesVersions(factory, kialiCache)
	require.Len(versions, 2)
	require.Equal("v1.30.0", versionByName("Kubernetes-west"))
	require.Equal(int32(2), probes.Load(), "a successful fetch must be served from the cache without re-probing")
}
