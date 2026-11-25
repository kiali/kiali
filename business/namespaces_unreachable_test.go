package business

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/cache/cachetest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// dialTimeoutError models a transport-level failure: it implements net.Error, which
// is how the unreachable signal classifies a dead remote.
type dialTimeoutError struct{}

func (dialTimeoutError) Error() string   { return "dial tcp: i/o timeout" }
func (dialTimeoutError) Timeout() bool   { return true }
func (dialTimeoutError) Temporary() bool { return true }

// stallingNamespaceClient stalls every live namespace read, modeling an unreachable
// cluster. It wraps a fake so everything else (cache keys, access reviews) behaves.
type stallingNamespaceClient struct {
	*kubetest.FakeK8sClient
}

func (c *stallingNamespaceClient) GetNamespace(ctx context.Context, name string) (*core_v1.Namespace, error) {
	return nil, dialTimeoutError{}
}

func (c *stallingNamespaceClient) GetNamespaces(ctx context.Context, labelSelector string) ([]core_v1.Namespace, error) {
	return nil, dialTimeoutError{}
}

// forbiddenListClient answers every namespace list with an authorization denial: the
// cluster is reachable, but the SA may not list namespaces at the cluster scope (e.g. a
// CWA-enabled Kiali paired with a remote that only holds per-namespace roles).
type forbiddenListClient struct {
	*kubetest.FakeK8sClient
}

func (c *forbiddenListClient) GetNamespaces(ctx context.Context, labelSelector string) ([]core_v1.Namespace, error) {
	return nil, k8serrors.NewForbidden(schema.GroupResource{Resource: "namespaces"}, "", errors.New("denied"))
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

// TestNamespaceComputeDoesNotMarkReachableClusterOnDenial verifies the classification the
// compute path makes when the namespace list is denied rather than unreachable: an
// authorization denial is an API-level answer - the cluster is demonstrably reachable -
// so it must not set the unreachable signal. Marking it flapped against the background
// prober, which correctly cleared the mark on its next probe.
func TestNamespaceComputeDoesNotMarkReachableClusterOnDenial(t *testing.T) {
	conf := nonCwaConf()
	conf.KubernetesConfig.ClusterName = "east"
	conf.Deployment.ClusterWideAccess = true

	saClients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
		"west":                            &forbiddenListClient{FakeK8sClient: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))},
	}
	kialiCache, _, err := cachetest.NewFakeKialiCache(context.Background(), conf, saClients, nil)
	require.NoError(t, err)
	discovery := istioDiscovery(t, conf, saClients)

	svc := NewNamespaceService(kialiCache, conf, discovery, saClients, map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
		"west":                            kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	})

	// The denied list fails the computation - the caller still sees the error - but the
	// cluster must not be marked unreachable: only a transport failure may.
	_, err = svc.GetClusterNamespacesForCluster(context.Background(), "west")
	require.Error(t, err, "the denied list must fail the computation")
	require.False(t, kialiCache.IsClusterUnreachable("west"), "an authorization denial is an API-level answer; the cluster is reachable")

	// The SA-path computation holds the same contract.
	_, err = svc.GetKialiSAClusterNamespaces(context.Background(), "west")
	require.Error(t, err)
	require.False(t, kialiCache.IsClusterUnreachable("west"), "the SA path must classify a denial the same way")
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
