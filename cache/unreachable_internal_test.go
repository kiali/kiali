package cache

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	authv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

// TestIsAmbientEnabledDoesNotMarkDegradedClusterUnreachable verifies the ambient check's
// classification when the cluster's cache is degraded (the SA lost access): the cluster is
// reachable at the transport level, so the check must not mark it unreachable. Marking it
// flapped against the background prober, which correctly cleared the mark on the next
// probe, oscillating the UI between the degraded and the unreachable presentations.
func TestIsAmbientEnabledDoesNotMarkDegradedClusterUnreachable(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	kialiCache := NewTestingCacheWithClients(t, map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
		"west": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
	}, *conf)
	cluster := "west"

	// Degrade the cluster the way the access check does on a confirmed revocation. The
	// testing cache has no cluster access by default (cmd/gather-style), so attach one.
	impl := kialiCache.(*kialiCacheImpl)
	impl.clusterAccess = NewClusterAccess(nil)
	impl.clusterAccess.mu.Lock()
	impl.clusterAccess.markDegradedLocked(cluster, groupResource{resource: "pods"})
	impl.clusterAccess.mu.Unlock()

	// The ambient check fails on the degraded cache but must not classify the cluster
	// as unreachable: only a transport failure may.
	require.False(kialiCache.IsAmbientEnabled(context.Background(), cluster))
	require.False(kialiCache.IsClusterUnreachable(cluster), "a degraded cache must not be classified as an unreachable cluster")
}

// TestCanListWebhooksSkipsUnreachableCluster pins the webhook re-check's respect for the
// shared unreachable signal: a cluster marked unreachable is not live-probed - the
// background prober owns its recovery detection, the invariant every request-path probe
// follows - and the re-check resumes once the mark is cleared.
func TestCanListWebhooksSkipsUnreachableCluster(t *testing.T) {
	var probes atomic.Int32
	forbidden := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		probes.Add(1)
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(&metav1.Status{
			Status: metav1.StatusFailure,
			Reason: metav1.StatusReasonForbidden,
			Code:   http.StatusForbidden,
		})
	}))
	t.Cleanup(forbidden.Close)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	kialiCache := NewTestingCacheWithClients(t, map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
		"west": newCacheTestClient(t, "west", forbidden.URL),
	}, *conf)

	// The startup check already probed west once; count from here.
	baseline := probes.Load()
	impl := kialiCache.(*kialiCacheImpl)

	// A stale transient failure (backoff expired) plus the unreachable mark: the
	// re-check must not probe the cluster while it is marked.
	impl.canReadWebhookMutex.Lock()
	impl.webhookCheckFailures["west"] = time.Now().Add(-2 * webhookCheckBackoff)
	impl.canReadWebhookMutex.Unlock()
	kialiCache.MarkClusterUnreachable("west")

	require.False(t, kialiCache.CanListWebhooks("west"))
	require.Equal(t, baseline, probes.Load(), "a cluster marked unreachable must not be live-probed by the webhook re-check")

	// Once the mark is cleared, the re-check resumes.
	kialiCache.ClearClusterUnreachable("west")
	require.False(t, kialiCache.CanListWebhooks("west"))
	require.Equal(t, baseline+1, probes.Load(), "the re-check must resume after the mark is cleared")
}
