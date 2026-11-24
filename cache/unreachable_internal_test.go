package cache

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	authv1 "k8s.io/api/authorization/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// failingDaemonsetLister delegates everything to the wrapped fake client except
// daemonset lists, which fail and are counted. The daemonset reads go through the
// controller-runtime reader (not the clientset reactors), so the reader's List is
// what must fail to model an unreachable cluster.
type failingDaemonsetLister struct {
	*kubetest.FakeK8sClient
	lists *atomic.Int32
}

func (f *failingDaemonsetLister) List(ctx context.Context, list ctrlclient.ObjectList, opts ...ctrlclient.ListOption) error {
	if _, ok := list.(*appsv1.DaemonSetList); ok {
		f.lists.Add(1)
		return errors.New("connection refused")
	}
	return f.FakeK8sClient.List(ctx, list, opts...)
}

// answeringClient answers the prober's access review (the cluster is reachable).
type answeringClient struct {
	kubernetes.ClientInterface
	reviews *atomic.Int32
}

func (c *answeringClient) GetSelfSubjectAccessReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*authv1.SelfSubjectAccessReview, error) {
	c.reviews.Add(1)
	// An authorization denial is still an answer: the cluster is reachable.
	return []*authv1.SelfSubjectAccessReview{}, nil
}

// stalledClient never answers the prober (the cluster stays unreachable).
type stalledClient struct {
	kubernetes.ClientInterface
	reviews *atomic.Int32
}

func (c *stalledClient) GetSelfSubjectAccessReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*authv1.SelfSubjectAccessReview, error) {
	c.reviews.Add(1)
	return nil, &transportError{}
}

type transportError struct{}

func (e *transportError) Error() string { return "dial tcp: i/o timeout" }

func (e *transportError) Timeout() bool   { return true }
func (e *transportError) Temporary() bool { return true }

// TestClusterUnreachableSignal verifies the shared signal's core contract: mark,
// consult, clear, and that the home cluster is never marked.
func TestClusterUnreachableSignal(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system"))
	kialiCache := NewTestingCache(t, k8s, *conf)

	home := conf.KubernetesConfig.ClusterName
	require.False(kialiCache.IsClusterUnreachable("west"))
	kialiCache.MarkClusterUnreachable("west")
	require.True(kialiCache.IsClusterUnreachable("west"))
	require.Equal([]string{"west"}, kialiCache.UnreachableClusters())

	// The home cluster is never marked: its failures are exceptional and fail loud.
	kialiCache.MarkClusterUnreachable(home)
	require.False(kialiCache.IsClusterUnreachable(home))

	kialiCache.ClearClusterUnreachable("west")
	require.False(kialiCache.IsClusterUnreachable("west"))
	require.Empty(kialiCache.UnreachableClusters())
}

// TestProbeUnreachableClustersClearsOnAnswer verifies the prober's classification: any
// answer - even an authorization denial - proves reachability and clears the mark,
// while a transport-level failure keeps it.
func TestProbeUnreachableClustersClearsOnAnswer(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	answering := &answeringClient{reviews: &atomic.Int32{}}
	stalled := &stalledClient{reviews: &atomic.Int32{}}
	kialiCache := NewTestingCacheWithClients(t, map[string]kubernetes.ClientInterface{
		"east":  kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
		"west":  stalled,
		"north": answering,
	}, *conf)

	kialiCache.MarkClusterUnreachable("west")
	kialiCache.MarkClusterUnreachable("north")

	// The cache construction runs its own startup access reviews; count only the prober's.
	answering.reviews.Store(0)
	stalled.reviews.Store(0)
	impl := kialiCache.(*kialiCacheImpl)
	impl.probeUnreachableOnce(context.Background())

	require.True(kialiCache.IsClusterUnreachable("west"), "a transport failure must keep the mark")
	require.False(kialiCache.IsClusterUnreachable("north"), "an answered probe must clear the mark, even with an authorization denial")
	require.Equal(int32(1), answering.reviews.Load())
}

// TestIsAmbientEnabledSuspendsOnUnreachableCluster verifies that the ambient check -
// a request-path probe - marks the cluster on failure and skips while it is marked,
// resuming once the mark is cleared.
func TestIsAmbientEnabledSuspendsOnUnreachableCluster(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// The failing cluster must be a remote: the home cluster is never marked
	// unreachable (its failures fail loud instead).
	var lists atomic.Int32
	client := &failingDaemonsetLister{
		FakeK8sClient: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
		lists:         &lists,
	}
	kialiCache := NewTestingCacheWithClients(t, map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
		"west": client,
	}, *conf)
	cluster := "west"

	// The first check probes the cluster and marks it unreachable.
	require.False(kialiCache.IsAmbientEnabled(context.Background(), cluster))
	require.Equal(int32(1), lists.Load())
	require.True(kialiCache.IsClusterUnreachable(cluster), "the ambient check failure must mark the cluster")

	// While marked, the check is suspended: no re-probe.
	require.False(kialiCache.IsAmbientEnabled(context.Background(), cluster))
	require.Equal(int32(1), lists.Load())

	// Once the prober clears the mark, the check probes again.
	kialiCache.ClearClusterUnreachable(cluster)
	require.False(kialiCache.IsAmbientEnabled(context.Background(), cluster))
	require.Equal(int32(2), lists.Load())
}
