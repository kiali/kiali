package business

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/cache/cachetest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// stallingNamespaceClient stalls every live namespace read, modeling an unreachable
// cluster. It wraps a fake so everything else (cache keys, access reviews) behaves.
type stallingNamespaceClient struct {
	*kubetest.FakeK8sClient
}

func (c *stallingNamespaceClient) GetNamespace(ctx context.Context, name string) (*core_v1.Namespace, error) {
	return nil, errors.New("dial tcp: i/o timeout")
}

func (c *stallingNamespaceClient) GetNamespaces(ctx context.Context, labelSelector string) ([]core_v1.Namespace, error) {
	return nil, errors.New("dial tcp: i/o timeout")
}

// TestNamespaceComputeMarksClusterUnreachableAcrossTokens verifies the consolidation the
// shared signal provides: one token's failed namespace-set computation marks the CLUSTER,
// so a different token's computation is skipped without paying its own probe - the dead
// remote is learned once, not once per subsystem or per token.
func TestNamespaceComputeMarksClusterUnreachableAcrossTokens(t *testing.T) {
	conf := nonCwaConf()
	conf.KubernetesConfig.ClusterName = "east"

	home := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	home.CacheKey = "home-user"
	westOne := &stallingNamespaceClient{FakeK8sClient: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))}
	westOne.CacheKey = "token-one"
	westTwo := &stallingNamespaceClient{FakeK8sClient: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))}
	westTwo.CacheKey = "token-two"

	saClients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
		"west":                            kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}
	kialiCache, _, err := cachetest.NewFakeKialiCache(context.Background(), conf, saClients, nil)
	require.NoError(t, err)
	discovery := istioDiscovery(t, conf, saClients)

	// Token one's computation fails against the stalling cluster and marks it.
	svcOne := NewNamespaceService(kialiCache, conf, discovery, saClients, map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: home,
		"west":                            westOne,
	})
	_, err = svcOne.GetClusterNamespacesForCluster(context.Background(), "west")
	require.Error(t, err, "the stalling cluster's computation must fail")
	require.True(t, kialiCache.IsClusterUnreachable("west"), "the failed computation must mark the cluster")

	// Token two's computation is suppressed by the cluster-level mark: it fails with the
	// unreachable error rather than paying its own probe against the dead cluster.
	svcTwo := NewNamespaceService(kialiCache, conf, discovery, saClients, map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: home,
		"west":                            westTwo,
	})
	_, err = svcTwo.GetClusterNamespacesForCluster(context.Background(), "west")
	require.Error(t, err)
	require.ErrorIs(t, err, cache.ErrClusterUnreachable, "a suppressed computation must fail with the unreachable error, not probe again")
}

// TestGetClusterNamespacesUnreachableIsNotAccessDenial verifies the 503 semantics: a
// cluster marked unreachable has no user client (its session validation was skipped),
// and that must surface as ErrClusterUnreachable - temporarily unavailable - rather
// than the 403 of an access denial.
func TestGetClusterNamespacesUnreachableIsNotAccessDenial(t *testing.T) {
	conf := nonCwaConf()
	conf.KubernetesConfig.ClusterName = "east"

	saClients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		),
	}
	kialiCache, _, err := cachetest.NewFakeKialiCache(context.Background(), conf, saClients, nil)
	require.NoError(t, err)
	kialiCache.MarkClusterUnreachable("west")
	discovery := istioDiscovery(t, conf, saClients)

	// No user client for west (its session was skipped) and the cluster is marked.
	svc := NewNamespaceService(kialiCache, conf, discovery, saClients, map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	})
	_, err = svc.GetClusterNamespacesForCluster(context.Background(), "west")
	require.Error(t, err)
	require.ErrorIs(t, err, cache.ErrClusterUnreachable, "an unreachable cluster must not be reported as an access denial")

	// The detail path (a named namespace) goes through GetClusterNamespace's own
	// no-client branch and must report the same.
	_, err = svc.GetClusterNamespace(context.Background(), "bookinfo", "west")
	require.Error(t, err)
	require.ErrorIs(t, err, cache.ErrClusterUnreachable, "the detail path must report an unreachable cluster as unavailable, not as an access denial")
}
