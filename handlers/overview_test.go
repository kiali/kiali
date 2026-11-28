package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
)

// TestHasAllClusterNamespaceAccessFullAccess tests that a user with the same namespace access
// as the Kiali SA across all clusters returns true.
func TestHasAllClusterNamespaceAccessFullAccess(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// Both user and SA have the same namespaces on the same clusters.
	// Use distinct tokens so user and SA don't share namespace cache entries.
	userEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("alpha"))
	userEast.Token = "user-token"
	userWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("beta"))
	userWest.Token = "user-token"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": userEast,
		"west": userWest,
	}

	saEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("alpha"))
	saEast.Token = "sa-token"
	saWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("beta"))
	saWest.Token = "sa-token"
	saClients := map[string]kubernetes.ClientInterface{
		"east": saEast,
		"west": saWest,
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsService := business.NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	layer := &business.Layer{Namespace: nsService}

	result := hasAllClusterNamespaceAccess(context.TODO(), layer, kialiCache, "")
	require.True(result)

	skipped, err := cache.NewKialiCache(t.Context(), saClients, map[string]ctrlclient.Reader{"east": saEast, "west": saWest}, *conf, cache.WithSkippedClusters([]string{"unavailable"}))
	require.NoError(err)
	cf := kubetest.NewFakeClientFactory(conf, userClients)
	cf.SAClients = saClients
	loader := func() tracing.ClientInterface { return nil }
	checkQueries := func(t *testing.T, c cache.KialiCache, expected map[string]string) {
		t.Helper()
		prom := &prometheustest.PromClientMock{}
		queries := &prometheustest.PromAPIMock{}
		prom.On("API").Return(queries)
		queries.On("Query", mock.Anything, mock.Anything, mock.Anything).Return(model.Vector{})
		for _, handler := range []http.HandlerFunc{
			OverviewServiceLatencies(conf, c, cf, nil, prom, loader, nil, discovery),
			OverviewServiceThroughput(conf, c, cf, nil, prom, loader, nil, discovery),
		} {
			queries.Calls = nil
			w := httptest.NewRecorder()
			WithFakeAuthInfo(conf, handler)(w, httptest.NewRequest(http.MethodGet, "/", nil))
			assert.Equal(t, http.StatusOK, w.Code, w.Body.String())
			got := map[string]int{}
			for _, call := range queries.Calls {
				query := call.Arguments.String(1)
				for cluster, nsMatcher := range expected {
					if strings.Contains(query, `destination_cluster="`+cluster+`"`) && strings.Contains(query, nsMatcher) {
						got[cluster]++
					}
				}
			}
			assert.Len(t, queries.Calls, len(expected))
			for cluster := range expected {
				assert.Equal(t, 1, got[cluster], "expected one scoped query for %s", cluster)
			}
		}
	}
	t.Run("skipped", func(t *testing.T) { checkQueries(t, skipped, map[string]string{"east": "", "west": ""}) })

	incomplete, err := cache.NewKialiCache(t.Context(), saClients, map[string]ctrlclient.Reader{"east": saEast, "west": saWest}, *conf, cache.WithUnreadableRemoteSecrets([]string{"unreadable-secret"}))
	require.NoError(err)
	require.False(hasAllClusterNamespaceAccess(context.TODO(), layer, incomplete, ""), "an unreadable remote secret must disable the unscoped query")
	t.Run("unreadable remote secret", func(t *testing.T) { checkQueries(t, incomplete, map[string]string{"east": "", "west": ""}) })

	access := cache.NewClusterAccess(func(_ context.Context, _, _, resource string) (cache.DeniedAccess, error) {
		if resource == "pods" {
			return cache.DeniedAccess{Cluster: true}, nil
		}
		return cache.DeniedAccess{Namespaces: []string{"beta"}}, nil
	})
	tracked, err := cache.NewKialiCache(t.Context(), saClients, map[string]ctrlclient.Reader{"east": saEast, "west": saWest}, *conf, cache.WithClusterAccess(access))
	require.NoError(err)
	require.False(access.ConfirmRevoked(t.Context(), "west", "apps", "deployments"))
	t.Run("partially revoked", func(t *testing.T) {
		checkQueries(t, tracked, map[string]string{"east": "", "west": `destination_service_namespace=~"^(?:bookinfo)$"`})
	})
	require.True(access.ConfirmRevoked(t.Context(), "west", "", "pods"))
	t.Run("fully revoked", func(t *testing.T) { checkQueries(t, tracked, map[string]string{"east": ""}) })
}

// TestHasAllClusterNamespaceAccessLimitedNamespaces tests that a user with fewer namespaces
// than the Kiali SA on a cluster returns false.
func TestHasAllClusterNamespaceAccessLimitedNamespaces(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// User has only bookinfo, SA has bookinfo and alpha
	userEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	userEast.Token = "user-token"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": userEast,
	}

	saEast := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("alpha"),
	)
	saEast.Token = "sa-token"
	saClients := map[string]kubernetes.ClientInterface{
		"east": saEast,
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsService := business.NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	layer := &business.Layer{Namespace: nsService}

	result := hasAllClusterNamespaceAccess(context.TODO(), layer, kialiCache, "")
	require.False(result)
}

// TestHasAllClusterNamespaceAccessLimitedClusters tests that a user who does not have access
// to all Kiali SA clusters returns false (even if they have full namespace access on their clusters).
func TestHasAllClusterNamespaceAccessLimitedClusters(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// User has access to "east" only, SA has "east" and "west"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}
	saClients := map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
		"west": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsService := business.NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	layer := &business.Layer{Namespace: nsService}

	// With cluster="" it checks all SA clusters; user is missing "west"
	result := hasAllClusterNamespaceAccess(context.TODO(), layer, kialiCache, "")
	require.False(result)
}

// TestHasAllClusterNamespaceAccessSpecificCluster tests the function with a specific cluster name.
func TestHasAllClusterNamespaceAccessSpecificCluster(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// User has full access on "east" but limited on "west".
	// Use distinct tokens so user and SA don't share namespace cache entries.
	userEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("alpha"))
	userEast.Token = "user-token"
	userWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	userWest.Token = "user-token"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": userEast,
		"west": userWest,
	}

	saEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("alpha"))
	saEast.Token = "sa-token"
	saWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("beta"))
	saWest.Token = "sa-token"
	saClients := map[string]kubernetes.ClientInterface{
		"east": saEast,
		"west": saWest,
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsService := business.NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	layer := &business.Layer{Namespace: nsService}

	// "east" should pass - user has full access
	result := hasAllClusterNamespaceAccess(context.TODO(), layer, kialiCache, "east")
	require.True(result)

	// "west" should fail - user is missing "beta"
	result = hasAllClusterNamespaceAccess(context.TODO(), layer, kialiCache, "west")
	require.False(result)

	// "" should fail - because "west" fails
	result = hasAllClusterNamespaceAccess(context.TODO(), layer, kialiCache, "")
	require.False(result)
}
