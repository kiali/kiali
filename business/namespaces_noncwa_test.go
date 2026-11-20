package business

import (
	"context"
	goerrors "errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/cache/cachetest"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// istioDiscovery builds a mesh discovery over the given SA clients for namespace tests.
func istioDiscovery(t *testing.T, conf *config.Config, saClients map[string]kubernetes.ClientInterface) istio.MeshDiscovery {
	t.Helper()
	kialiCache, _, err := cachetest.NewFakeKialiCache(context.Background(), conf, saClients, nil)
	require.NoError(t, err)
	return istio.NewDiscovery(saClients, kialiCache, conf)
}

// nonCwaConf builds a non-cluster-wide-access config where the home cluster's default scope
// is bookinfo and the west cluster has a name-form override selecting west-ns.
func nonCwaConf() *config.Config {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo"}
	conf.Deployment.DiscoverySelectors.Default = config.DiscoverySelectorsType{
		&config.DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "bookinfo"}},
	}
	conf.Deployment.DiscoverySelectors.Overrides = map[string]config.DiscoverySelectorsType{
		"west": {
			&config.DiscoverySelectorType{
				MatchExpressions: []metav1.LabelSelectorRequirement{
					{
						Key:      "kubernetes.io/metadata.name",
						Operator: metav1.LabelSelectorOpIn,
						Values:   []string{"west-ns"},
					},
				},
			},
		},
	}
	return conf
}

// TestNonCwaDiscoveryUsesClusterScope pins the override-aware discovery: with a west -> west-ns
// override, the remote's namespace set resolves west-ns (not the home default bookinfo), on
// both the user and the SA paths, while the home cluster keeps the default list.
func TestNonCwaDiscoveryUsesClusterScope(t *testing.T) {
	conf := nonCwaConf()

	home := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	home.CacheKey = "home-user"
	west := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("west-ns"))
	west.CacheKey = "west-user"

	saHome := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("west-ns"))
	saClients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: saHome,
		"west":                            saWest,
	}
	userClients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: home,
		"west":                            west,
	}

	kialiCache, _, err := cachetest.NewFakeKialiCache(context.Background(), conf, saClients, nil)
	require.NoError(t, err)
	discovery := istioDiscovery(t, conf, saClients)
	svc := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	// The user path: west resolves its override namespace, not the home default.
	westNamespaces, err := svc.GetClusterNamespacesForCluster(context.Background(), "west")
	require.NoError(t, err)
	require.Equal(t, []string{"west-ns"}, nsNames(westNamespaces))

	// The SA path resolves the same override scope.
	saNamespaces, err := svc.GetKialiSAClusterNamespaces(context.Background(), "west")
	require.NoError(t, err)
	require.Equal(t, []string{"west-ns"}, nsNames(saNamespaces))

	// The home cluster keeps its default list.
	homeNamespaces, err := svc.GetClusterNamespacesForCluster(context.Background(), conf.KubernetesConfig.ClusterName)
	require.NoError(t, err)
	require.Equal(t, []string{"bookinfo"}, nsNames(homeNamespaces))
}

// TestGetClusterNamespaceRevokedGate pins the detail gate: a namespace the user may see but
// the SA partially revoked is refused with ErrNamespaceRevoked (503 through the handler),
// while a readable namespace in the same cluster still serves.
func TestGetClusterNamespaceRevokedGate(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system"}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("istio-system"),
	)
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}
	kialiCache, access, err := cachetest.NewFakeKialiCache(context.Background(), conf, clients,
		func(context.Context, string, string, string) (cache.DeniedAccess, error) {
			return cache.DeniedAccess{Namespaces: []string{"bookinfo"}}, nil
		})
	require.NoError(t, err)
	require.False(t, access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments"))

	discovery := istioDiscovery(t, conf, clients)
	svc := NewNamespaceService(kialiCache, conf, discovery, clients,
		map[string]kubernetes.UserClientInterface{config.DefaultClusterID: k8s})

	// The user can see bookinfo (it is in their accessible set), but it is revoked: the
	// detail gate refuses it with the typed error, so the handler maps 503, not 403/404.
	_, err = svc.GetClusterNamespace(context.Background(), "bookinfo", config.DefaultClusterID)
	require.Error(t, err)
	require.True(t, goerrors.Is(err, cache.ErrNamespaceRevoked))

	// A readable namespace in the same cluster passes the gate.
	ns, err := svc.GetClusterNamespace(context.Background(), "istio-system", config.DefaultClusterID)
	require.NoError(t, err)
	require.Equal(t, "istio-system", ns.Name)

	// The membership check is the cheap form used by the gate.
	require.True(t, kialiCache.IsNamespaceRevoked(config.DefaultClusterID, "bookinfo"))
	require.False(t, kialiCache.IsNamespaceRevoked(config.DefaultClusterID, "istio-system"))
}

// TestCheckNamespaceAccessAllClustersRevokedIsDenied pins the fail-closed rule: a namespace
// that exists on a cluster where it is partially revoked is denied for unscoped queries even
// though the user can see it there.
func TestCheckNamespaceAccessAllClustersRevokedIsDenied(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo"}

	home := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	home.CacheKey = "home-user"
	west := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	west.CacheKey = "west-user"

	saHome := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saClients := map[string]kubernetes.ClientInterface{
		config.DefaultClusterID: saHome,
		"west":                  saWest,
	}

	kialiCache, access, err := cachetest.NewFakeKialiCache(context.Background(), conf, saClients,
		func(context.Context, string, string, string) (cache.DeniedAccess, error) {
			return cache.DeniedAccess{Namespaces: []string{"bookinfo"}}, nil
		})
	require.NoError(t, err)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))

	discovery := istioDiscovery(t, conf, saClients)
	svc := NewNamespaceService(kialiCache, conf, discovery, saClients,
		map[string]kubernetes.UserClientInterface{
			config.DefaultClusterID: home,
			"west":                  west,
		})

	_, err = svc.CheckNamespaceAccessAllClusters(context.Background(), "bookinfo")
	require.Error(t, err)
	require.True(t, IsAccessibleError(err), "the revoked namespace is denied for unscoped queries")
}
