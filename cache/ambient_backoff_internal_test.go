package cache

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/config"
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

// TestIsAmbientEnabledBacksOffIndeterminateFailures verifies that an indeterminate
// ambient-check failure (an unreachable remote) is probed once per backoff window
// instead of on every request: the check runs on request paths such as /api/config
// and the mesh graph, and re-probing a dead cluster each time would charge every
// request its connection-establishment timeout.
func TestIsAmbientEnabledBacksOffIndeterminateFailures(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()

	var lists atomic.Int32
	client := &failingDaemonsetLister{
		FakeK8sClient: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
		lists:         &lists,
	}

	kialiCache := NewTestingCache(t, client, *conf)
	cluster := conf.KubernetesConfig.ClusterName

	old := ambientCheckFailureBackoff
	ambientCheckFailureBackoff = time.Minute
	t.Cleanup(func() { ambientCheckFailureBackoff = old })

	// The first check probes the cluster and records the indeterminate failure.
	require.False(kialiCache.IsAmbientEnabled(context.Background(), cluster))
	require.Equal(int32(1), lists.Load(), "the first check must probe the cluster")

	// Within the backoff window the failure is trusted: no re-probe.
	require.False(kialiCache.IsAmbientEnabled(context.Background(), cluster))
	require.Equal(int32(1), lists.Load(), "a cached indeterminate failure must not re-probe the cluster")

	// After the window expires the cluster is probed again.
	impl := kialiCache.(*kialiCacheImpl)
	impl.ambientCheckFailuresMu.Lock()
	impl.ambientCheckFailures[cluster] = time.Now().Add(-2 * time.Minute)
	impl.ambientCheckFailuresMu.Unlock()
	require.False(kialiCache.IsAmbientEnabled(context.Background(), cluster))
	require.Equal(int32(2), lists.Load(), "an expired failure must be probed again")
}
