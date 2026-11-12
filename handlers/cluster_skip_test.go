package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
)

const clusterSkipRemote = "remote-cluster"

// setupClusterSkipServer registers the six per-cluster endpoints that carry the
// skipUnavailableCluster guard, backed by a two-cluster cache whose ClusterAccess
// degrades the named cluster ("" degrades none).
func setupClusterSkipServer(t *testing.T, degradedCluster string) *httptest.Server {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	mockClock()
	home := conf.KubernetesConfig.ClusterName

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	remote := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	cf := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{
		home:              k8s,
		clusterSkipRemote: remote,
	})

	// The check denies everything, so ConfirmRevoked degrades whichever cluster it names.
	access := cache.NewClusterAccess(func(context.Context, string, string, string) (bool, error) {
		return false, nil
	})
	if degradedCluster != "" {
		require.True(t, access.ConfirmRevoked(context.Background(), degradedCluster, "apps", "deployments"))
	}
	saClients := cf.GetSAClients()
	readers := map[string]ctrlclient.Reader{home: k8s, clusterSkipRemote: remote}
	kialiCache, err := cache.NewKialiCache(t.Context(), saClients, readers, *conf, cache.WithClusterAccess(access))
	require.NoError(t, err)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	promMock := new(prometheustest.PromAPIMock)
	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom, err := prometheus.NewClient(*conf, k8s.GetToken())
	require.NoError(t, err)
	prom.Inject(promMock)

	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return nil }

	mr := mux.NewRouter()
	register := func(pattern string, hf http.HandlerFunc) {
		mr.HandleFunc(pattern, WithFakeAuthInfo(conf, hf))
	}
	register("/api/clusters/apps", ClusterApps(conf, kialiCache, cf, prom, cpm, traceLoader, nil, discovery))
	register("/api/clusters/services", ClustersServices(conf, kialiCache, cf, prom, cpm, traceLoader, nil, discovery))
	register("/api/clusters/workloads", ClusterWorkloads(conf, kialiCache, cf, cpm, prom, traceLoader, nil, discovery))
	register("/api/istio/config", IstioConfigList(conf, kialiCache, cf, prom, traceLoader, discovery, cpm, nil))
	register("/api/namespaces/{namespace}/tls", NamespaceTls(conf, kialiCache, cf, prom, cpm, traceLoader, nil, discovery))
	register("/api/clusters/tls", ClustersTls(conf, kialiCache, cf, prom, cpm, traceLoader, nil, discovery))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts
}

// clusterSkipEndpoint describes one guarded endpoint: a path template taking the cluster
// name and a check of the endpoint's empty response shape. The body is decoded and
// compared rather than only the status code, so a wrong empty shape (a struct where the
// frontend expects an array, or a nil array where it expects an empty one) fails the test.
type clusterSkipEndpoint struct {
	name  string
	path  string
	check func(t *testing.T, body []byte, cluster string)
}

func clusterSkipEndpoints() []clusterSkipEndpoint {
	return []clusterSkipEndpoint{
		{
			name: "cluster apps",
			path: "/api/clusters/apps?clusterName=%s",
			check: func(t *testing.T, body []byte, cluster string) {
				var decoded models.ClusterApps
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Equal(t, cluster, decoded.Cluster)
				require.Empty(t, decoded.Apps)
			},
		},
		{
			name: "cluster services",
			path: "/api/clusters/services?clusterName=%s",
			check: func(t *testing.T, body []byte, cluster string) {
				var decoded models.ClusterServices
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Equal(t, cluster, decoded.Cluster)
				require.Empty(t, decoded.Services)
			},
		},
		{
			name: "cluster workloads",
			path: "/api/clusters/workloads?clusterName=%s",
			check: func(t *testing.T, body []byte, cluster string) {
				var decoded models.ClusterWorkloads
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Equal(t, cluster, decoded.Cluster)
				require.Empty(t, decoded.Workloads)
			},
		},
		{
			name: "istio config",
			path: "/api/istio/config?clusterName=%s",
			check: func(t *testing.T, body []byte, cluster string) {
				var decoded models.IstioConfigList
				require.NoError(t, json.Unmarshal(body, &decoded))
				// ConvertToResponse coerces the nil arrays to empty ones; the
				// frontend breaks on a nil array in the JSON ("null").
				require.NotContains(t, string(body), "null", "empty istio config must not serialize nil arrays")
				require.Empty(t, decoded.DestinationRules)
			},
		},
		{
			name: "namespace tls",
			path: "/api/namespaces/bookinfo/tls?clusterName=%s",
			check: func(t *testing.T, body []byte, cluster string) {
				var decoded models.MTLSStatus
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Equal(t, models.MTLSStatus{}, decoded)
			},
		},
		{
			name: "clusters tls",
			path: "/api/clusters/tls?clusterName=%s",
			check: func(t *testing.T, body []byte, cluster string) {
				var decoded []models.MTLSStatus
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Empty(t, decoded)
			},
		},
	}
}

// TestClusterSkipEndpointsDegradedRemote pins the guard's core contract: a degraded
// remote cluster serves each endpoint's empty result with a 200.
func TestClusterSkipEndpointsDegradedRemote(t *testing.T) {
	ts := setupClusterSkipServer(t, clusterSkipRemote)
	for _, ep := range clusterSkipEndpoints() {
		t.Run(ep.name, func(t *testing.T) {
			resp, err := http.Get(ts.URL + fmt.Sprintf(ep.path, clusterSkipRemote))
			require.NoError(t, err)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.StatusCode, string(body))
			ep.check(t, body, clusterSkipRemote)
		})
	}
}

// TestClusterSkipEndpointsUncachedCluster pins the ErrClusterNotCached contract: a
// cluster with no cache configured (e.g. a mistyped cluster name) fails the request
// instead of silently serving the empty result.
func TestClusterSkipEndpointsUncachedCluster(t *testing.T) {
	ts := setupClusterSkipServer(t, "")
	for _, ep := range clusterSkipEndpoints() {
		t.Run(ep.name, func(t *testing.T) {
			resp, err := http.Get(ts.URL + fmt.Sprintf(ep.path, "ghost"))
			require.NoError(t, err)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, http.StatusInternalServerError, resp.StatusCode, string(body))
			require.Contains(t, string(body), "no cache is configured for the cluster", string(body))
		})
	}
}

// TestClusterSkipEndpointsDegradedHome pins the home-cluster contract: the home cluster
// is not skippable, so its cache being unavailable fails the request.
func TestClusterSkipEndpointsDegradedHome(t *testing.T) {
	ts := setupClusterSkipServer(t, config.DefaultClusterID)
	for _, ep := range clusterSkipEndpoints() {
		t.Run(ep.name, func(t *testing.T) {
			resp, err := http.Get(ts.URL + fmt.Sprintf(ep.path, config.DefaultClusterID))
			require.NoError(t, err)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, http.StatusInternalServerError, resp.StatusCode, string(body))
		})
	}
}
