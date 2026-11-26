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
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/cache/cachetest"
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
// degrades the named cluster ("" degrades none). Extra objects are seeded into the
// remote cluster's client.
func setupClusterSkipServer(t *testing.T, degradedCluster string, remoteObjects ...runtime.Object) *httptest.Server {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	mockClock()
	home := conf.KubernetesConfig.ClusterName

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	remote := kubetest.NewFakeK8sClient(append([]runtime.Object{kubetest.FakeNamespace("bookinfo")}, remoteObjects...)...)
	cf := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{
		home:              k8s,
		clusterSkipRemote: remote,
	})

	// The check denies everything, so ConfirmRevoked degrades whichever cluster it names.
	kialiCache, access, err := cachetest.NewFakeKialiCache(t.Context(), conf, cf.GetSAClients(),
		func(context.Context, string, string, string) (cache.DeniedAccess, error) {
			return cache.DeniedAccess{Cluster: true}, nil
		})
	require.NoError(t, err)
	if degradedCluster != "" {
		require.True(t, access.ConfirmRevoked(context.Background(), degradedCluster, "apps", "deployments"))
	}
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)

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
	check func(t *testing.T, body []byte)
}

func clusterSkipEndpoints() []clusterSkipEndpoint {
	return []clusterSkipEndpoint{
		{
			name: "cluster apps",
			path: "/api/clusters/apps?clusterName=%s",
			check: func(t *testing.T, body []byte) {
				var decoded models.ClusterApps
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Equal(t, clusterSkipRemote, decoded.Cluster)
				require.Empty(t, decoded.Apps)
			},
		},
		{
			name: "cluster services",
			path: "/api/clusters/services?clusterName=%s",
			check: func(t *testing.T, body []byte) {
				var decoded models.ClusterServices
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Equal(t, clusterSkipRemote, decoded.Cluster)
				require.Empty(t, decoded.Services)
			},
		},
		{
			name: "cluster workloads",
			path: "/api/clusters/workloads?clusterName=%s",
			check: func(t *testing.T, body []byte) {
				var decoded models.ClusterWorkloads
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Equal(t, clusterSkipRemote, decoded.Cluster)
				require.Empty(t, decoded.Workloads)
			},
		},
		{
			name: "istio config",
			path: "/api/istio/config?clusterName=%s",
			check: func(t *testing.T, body []byte) {
				// The frontend breaks on a nil array in the JSON ("null"), so the raw
				// body must not contain one. The decoded struct cannot detect it:
				// IstioConfigList.UnmarshalJSON runs ConvertToResponse, which coerces
				// nil arrays to empty ones during decoding.
				var raw struct {
					Resources map[string]json.RawMessage `json:"resources"`
				}
				require.NoError(t, json.Unmarshal(body, &raw))
				for _, key := range []string{kubernetes.DestinationRules.String(), kubernetes.VirtualServices.String()} {
					value, found := raw.Resources[key]
					require.True(t, found, "the %s array is present", key)
					require.NotEqual(t, "null", string(value), "empty istio config must not serialize nil arrays")
				}
				var decoded models.IstioConfigList
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Empty(t, decoded.DestinationRules)
			},
		},
		{
			name: "namespace tls",
			path: "/api/namespaces/bookinfo/tls?clusterName=%s",
			check: func(t *testing.T, body []byte) {
				var decoded models.MTLSStatus
				require.NoError(t, json.Unmarshal(body, &decoded))
				require.Equal(t, models.MTLSStatus{}, decoded)
			},
		},
		{
			name: "clusters tls",
			path: "/api/clusters/tls?clusterName=%s",
			check: func(t *testing.T, body []byte) {
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
			ep.check(t, body)
		})
	}
}

// TestClusterSkipEndpointsUncachedCluster pins the ErrClusterNotCached contract: a
// cluster with no cache configured (e.g. a mistyped cluster name) is not found - 404,
// the correct answer for a name the server does not know - instead of an empty result.
func TestClusterSkipEndpointsUncachedCluster(t *testing.T) {
	ts := setupClusterSkipServer(t, "")
	for _, ep := range clusterSkipEndpoints() {
		t.Run(ep.name, func(t *testing.T) {
			resp, err := http.Get(ts.URL + fmt.Sprintf(ep.path, "ghost"))
			require.NoError(t, err)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, http.StatusNotFound, resp.StatusCode, string(body))
			require.Contains(t, string(body), "no cache is configured for the cluster", string(body))
		})
	}
}

// TestClusterSkipEndpointsDegradedHome pins the home-cluster contract: the home cluster
// is not skippable, so its cache being unavailable fails the request with a 503 - the
// state is temporary and recovers when access is restored.
func TestClusterSkipEndpointsDegradedHome(t *testing.T) {
	ts := setupClusterSkipServer(t, config.DefaultClusterID)
	for _, ep := range clusterSkipEndpoints() {
		t.Run(ep.name, func(t *testing.T) {
			resp, err := http.Get(ts.URL + fmt.Sprintf(ep.path, config.DefaultClusterID))
			require.NoError(t, err)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, http.StatusServiceUnavailable, resp.StatusCode, string(body))
		})
	}
}

// TestClusterSkipEndpointsHealthyRemote guards against a vacuous pass: every other
// scenario is a failure mode, so a guard that always wrote an empty 200 would pass them.
// With data seeded on a healthy remote, the list endpoints must serve it.
func TestClusterSkipEndpointsHealthyRemote(t *testing.T) {
	deploymentLabels := map[string]string{"app": "ratings", "version": "v2"}
	ts := setupClusterSkipServer(t, "",
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "ratings-v2", Namespace: "bookinfo", Labels: deploymentLabels},
			Spec: appsv1.DeploymentSpec{
				Selector: &metav1.LabelSelector{MatchLabels: deploymentLabels},
				Template: corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: deploymentLabels}},
			},
		},
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "ratings", Namespace: "bookinfo", Labels: map[string]string{"app": "ratings"}}},
	)

	t.Run("cluster workloads serve the seeded data", func(t *testing.T) {
		resp, err := http.Get(ts.URL + fmt.Sprintf("/api/clusters/workloads?clusterName=%s", clusterSkipRemote))
		require.NoError(t, err)
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, string(body))
		var decoded models.ClusterWorkloads
		require.NoError(t, json.Unmarshal(body, &decoded))
		require.Equal(t, clusterSkipRemote, decoded.Cluster)
		require.Len(t, decoded.Workloads, 1, "the healthy cluster's data is served")
		require.Equal(t, "ratings-v2", decoded.Workloads[0].Name)
	})

	t.Run("cluster services serve the seeded data", func(t *testing.T) {
		resp, err := http.Get(ts.URL + fmt.Sprintf("/api/clusters/services?clusterName=%s", clusterSkipRemote))
		require.NoError(t, err)
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, string(body))
		var decoded models.ClusterServices
		require.NoError(t, json.Unmarshal(body, &decoded))
		require.Equal(t, clusterSkipRemote, decoded.Cluster)
		require.Len(t, decoded.Services, 1, "the healthy cluster's data is served")
		require.Equal(t, "ratings", decoded.Services[0].Name)
	})

	t.Run("cluster apps serve the seeded data", func(t *testing.T) {
		resp, err := http.Get(ts.URL + fmt.Sprintf("/api/clusters/apps?clusterName=%s", clusterSkipRemote))
		require.NoError(t, err)
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, string(body))
		var decoded models.ClusterApps
		require.NoError(t, json.Unmarshal(body, &decoded))
		require.Equal(t, clusterSkipRemote, decoded.Cluster)
		require.Len(t, decoded.Apps, 1, "the healthy cluster's data is served")
		require.Equal(t, "ratings", decoded.Apps[0].Name)
	})
}
