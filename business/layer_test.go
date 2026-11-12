package business

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// TestSkipUnavailableCluster covers the degraded-cluster decision the per-cluster list
// and status handlers rely on: a degraded remote cluster is skipped, the home cluster
// and a cluster with no cache configured at all fail, an available cluster proceeds.
func TestSkipUnavailableCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))
	remote := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))

	// The check denies everything, so any ConfirmRevoked call degrades that cluster.
	access := cache.NewClusterAccess(func(context.Context, string, string, string) (cache.DeniedAccess, error) {
		return cache.DeniedAccess{Cluster: true}, nil
	})
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s, "remote-cluster": remote}
	clusterCache, err := cache.NewKialiCache(context.Background(), clients,
		map[string]ctrlclient.Reader{config.DefaultClusterID: k8s, "remote-cluster": remote}, *conf, cache.WithClusterAccess(access))
	require.NoError(t, err)
	layer := NewLayerBuilder(t, conf).
		WithClients(map[string]kubernetes.UserClientInterface{config.DefaultClusterID: k8s, "remote-cluster": remote}).
		WithCache(clusterCache).
		Build()

	// Available clusters proceed.
	skip, err := layer.SkipUnavailableCluster(context.Background(), config.DefaultClusterID)
	assert.NoError(t, err)
	assert.False(t, skip, "an available cluster is not skipped")
	skip, err = layer.SkipUnavailableCluster(context.Background(), "remote-cluster")
	assert.NoError(t, err)
	assert.False(t, skip, "an available remote cluster is not skipped")

	// A degraded remote cluster is skipped, not failed: it recovers when access is
	// restored, and the pages that span clusters render its empty result.
	access.ConfirmRevoked(context.Background(), "remote-cluster", "apps", "deployments")
	skip, err = layer.SkipUnavailableCluster(context.Background(), "remote-cluster")
	assert.NoError(t, err)
	assert.True(t, skip, "a degraded remote cluster is skipped")

	// A cluster Kiali has no cache configured for at all is a configuration error
	// (e.g. a mistyped cluster name): it will not recover on its own, so it fails
	// the request instead of silently resolving to an empty result.
	skip, err = layer.SkipUnavailableCluster(context.Background(), "not-registered")
	assert.Error(t, err)
	assert.ErrorIs(t, err, cache.ErrClusterNotCached)
	assert.False(t, skip, "an uncached cluster fails the request")

	// The home cluster is not skippable: its cache being unavailable fails the request.
	access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments")
	skip, err = layer.SkipUnavailableCluster(context.Background(), config.DefaultClusterID)
	assert.Error(t, err)
	assert.False(t, skip, "the home cluster is never skipped")
}

// A partially-revoked namespace is excluded from workload fetches: its informers cannot
// refresh while the rest of the cluster stays readable, so serving them would show
// workloads that may no longer exist (the stale-data bug BUG-1b fixed).
func TestFetchWorkloadsExcludesRevokedNamespaces(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("istio-system"),
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "ratings-v2", Namespace: "bookinfo", Labels: map[string]string{"app": "ratings"}}},
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "istiod", Namespace: "istio-system", Labels: map[string]string{"app": "istiod"}}},
	)

	// bookinfo is denied while istio-system stays readable: a partial revocation.
	access := cache.NewClusterAccess(func(context.Context, string, string, string) (cache.DeniedAccess, error) {
		return cache.DeniedAccess{Namespaces: []string{"bookinfo"}}, nil
	})
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}
	clusterCache, err := cache.NewKialiCache(context.Background(), clients,
		map[string]ctrlclient.Reader{config.DefaultClusterID: k8s}, *conf, cache.WithClusterAccess(access))
	require.NoError(t, err)
	layer := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(clusterCache).Build()
	require.False(t, access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments"))
	require.Equal(t, []string{"bookinfo"}, clusterCache.RevokedNamespaces(config.DefaultClusterID))

	// A fetch spanning both namespaces serves only the readable one.
	ws, err := layer.Workload.fetchWorkloadsInNamespaces(context.Background(), config.DefaultClusterID, []string{"bookinfo", "istio-system"}, "", nil)
	require.NoError(t, err)
	require.Len(t, ws, 1)
	require.Equal(t, "istiod", ws[0].Name, "the revoked namespace's stale workloads are not served")

	// A fetch of only the revoked namespace serves nothing, without error.
	ws, err = layer.Workload.fetchWorkloadsInNamespaces(context.Background(), config.DefaultClusterID, []string{"bookinfo"}, "", nil)
	require.NoError(t, err)
	require.Empty(t, ws)
}
