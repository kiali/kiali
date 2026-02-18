package handlers

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
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

	result := hasAllClusterNamespaceAccess(context.TODO(), layer, "")
	require.True(result)
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

	result := hasAllClusterNamespaceAccess(context.TODO(), layer, "")
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
	result := hasAllClusterNamespaceAccess(context.TODO(), layer, "")
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
	result := hasAllClusterNamespaceAccess(context.TODO(), layer, "east")
	require.True(result)

	// "west" should fail - user is missing "beta"
	result = hasAllClusterNamespaceAccess(context.TODO(), layer, "west")
	require.False(result)

	// "" should fail - because "west" fails
	result = hasAllClusterNamespaceAccess(context.TODO(), layer, "")
	require.False(result)
}
