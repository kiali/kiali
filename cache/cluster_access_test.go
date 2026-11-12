package cache

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// fakeAccess answers access checks from a map and counts the calls.
type fakeAccess struct {
	allowed map[string]bool // keyed by cluster/group/resource
	calls   int
	err     error
	mu      sync.Mutex
}

func (f *fakeAccess) set(cluster, group, resource string, allowed bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.allowed[cluster+"/"+group+"/"+resource] = allowed
}

func (f *fakeAccess) check(_ context.Context, cluster, group, resource string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.err != nil {
		return false, f.err
	}
	return f.allowed[cluster+"/"+group+"/"+resource], nil
}

func newTestClusterAccess() (*ClusterAccess, *fakeAccess, *time.Time) {
	fake := &fakeAccess{allowed: map[string]bool{}}
	access := NewClusterAccess(fake.check)
	now := time.Date(2026, 11, 9, 12, 0, 0, 0, time.UTC)
	access.now = func() time.Time { return now }
	return access, fake, &now
}

func TestConfirmRevokedKeepsCacheWhenStillReadable(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.set("west", "apps", "deployments", true)

	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	_, degraded := access.DegradedSince("west")
	require.False(t, degraded)
}

func TestConfirmRevokedMarksClusterDegraded(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)

	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	since, degraded := access.DegradedSince("west")
	require.True(t, degraded)
	require.Equal(t, *now, since)

	_, degraded = access.DegradedSince("east")
	require.False(t, degraded)
}

// A check that fails or times out is not evidence of a revocation: the cache is kept and
// the cluster is not degraded. Only a definitive "not allowed" tears the cache down.
func TestConfirmRevokedKeepsCacheWhenCheckCannotTell(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.err = context.DeadlineExceeded

	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	_, degraded := access.DegradedSince("west")
	require.False(t, degraded)

	// A network error is treated the same way as a timeout.
	fake.err = errors.New("connection refused")
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	_, degraded = access.DegradedSince("west")
	require.False(t, degraded)
}

// A check that cannot tell is debounced like any other result, so a cluster whose checks
// keep failing does not hammer the API server on every watch error.
func TestConfirmRevokedDebouncesUnknownChecks(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.err = errors.New("connection refused")

	for i := 0; i < 5; i++ {
		require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	}
	require.Equal(t, 1, fake.calls)

	*now = now.Add(accessCheckDebounce)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, 2, fake.calls)
}

func TestConfirmRevokedDebouncesChecks(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.set("west", "apps", "deployments", true)

	for i := 0; i < 5; i++ {
		require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	}
	require.Equal(t, 1, fake.calls)

	*now = now.Add(accessCheckDebounce)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, 2, fake.calls)
}

// A check that could not tell (unknown) is not served past the debounce window: when
// the access really was revoked, the check after expiry must see the denial and degrade
// the cluster instead of replaying the stale unknown forever.
func TestConfirmRevokedRecoversFromUnknownToDenied(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.err = errors.New("connection refused")
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	_, degraded := access.DegradedSince("west")
	require.False(t, degraded)

	// Within the window the cached unknown is served without a new check.
	fake.err = nil
	fake.set("west", "apps", "deployments", false)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, 1, fake.calls)

	// After expiry a fresh check runs and sees the denial.
	*now = now.Add(accessCheckDebounce)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, 2, fake.calls)
	_, degraded = access.DegradedSince("west")
	require.True(t, degraded)
}

// Probe wipes lastCheck when it clears a recovered cluster, so a revocation that
// follows immediately runs a live check instead of being served the stale cached
// outcome from before the recovery.
func TestProbeWipesLastCheckForRevokedAgainCluster(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))

	fake.set("west", "apps", "deployments", true)
	access.Probe(context.Background())
	_, degraded := access.DegradedSince("west")
	require.False(t, degraded, "access was restored")

	// Revoked again right away: the wipe forces a new live check (a stale cached
	// outcome would be served within the debounce window otherwise).
	fake.set("west", "apps", "deployments", false)
	calls := fake.calls
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, calls+1, fake.calls, "a new live check ran after the probe cleared the cluster")
}

func TestProbeClearsClusterOnlyWhenAllRevokedResourcesAreBack(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)
	fake.set("west", "", "pods", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "", "pods"))

	access.Probe(context.Background())
	_, degraded := access.DegradedSince("west")
	require.True(t, degraded, "nothing is restored yet")

	fake.set("west", "apps", "deployments", true)
	access.Probe(context.Background())
	_, degraded = access.DegradedSince("west")
	require.True(t, degraded, "pods are still forbidden")

	fake.set("west", "", "pods", true)
	access.Probe(context.Background())
	_, degraded = access.DegradedSince("west")
	require.False(t, degraded)
}

// A resource revoked while the probe is mid-check must not be cleared by that probe: the
// checks run without the lock, so the probe re-verifies the revoked set before deleting.
func TestProbeKeepsClusterRevokedAgainDuringCheck(t *testing.T) {
	deploymentsAllowed := false
	var access *ClusterAccess
	access = NewClusterAccess(func(ctx context.Context, cluster, group, resource string) (bool, error) {
		if group == "apps" {
			if !deploymentsAllowed {
				return false, nil
			}
			// The probe is checking its snapshot (deployments) when another resource
			// gets revoked. The snapshot's check still passes.
			require.True(t, access.ConfirmRevoked(ctx, "west", "", "pods"))
			return true, nil
		}
		return false, nil // pods are not allowed
	})

	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	deploymentsAllowed = true

	access.Probe(context.Background())
	_, degraded := access.DegradedSince("west")
	require.True(t, degraded, "the cluster was revoked again while the probe was checking; it must stay degraded")
	require.Len(t, access.revoked["west"], 2, "both revoked resources are remembered")
}

func TestRunProbesUntilContextIsDone(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	fake.set("west", "apps", "deployments", true)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		access.Run(ctx, 10*time.Millisecond)
		close(done)
	}()

	require.Eventually(t, func() bool {
		_, degraded := access.DegradedSince("west")
		return !degraded
	}, 5*time.Second, 10*time.Millisecond)

	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not return after the context was cancelled")
	}
}

func TestGetKubeCacheFailsFastForDegradedCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.KialiInternal.CacheReadTimeout = 0
	home := conf.KubernetesConfig.ClusterName

	k8s := kubetest.NewFakeK8sClient()
	remote := kubetest.NewFakeK8sClient()
	clients := map[string]kubernetes.ClientInterface{home: k8s, "west": remote}
	readers := map[string]client.Reader{home: k8s, "west": remote}

	access, fake, _ := newTestClusterAccess()
	kialiCache, err := NewKialiCache(t.Context(), clients, readers, *conf, WithClusterAccess(access))
	require.NoError(t, err)

	reader, err := kialiCache.GetKubeCache("west")
	require.NoError(t, err)
	require.Same(t, remote, reader)

	fake.set("west", "apps", "deployments", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))

	_, err = kialiCache.GetKubeCache("west")
	require.ErrorContains(t, err, "cache for cluster [west] is unavailable")
	require.False(t, errors.Is(err, ErrClusterNotCached), "a degraded cache is not a missing one")
	_, err = kialiCache.GetKubeCache(home)
	require.NoError(t, err, "other clusters are not affected")

	_, err = kialiCache.GetKubeCache("unknown")
	require.ErrorIs(t, err, ErrClusterNotCached, "a cluster with no cache configured is distinguishable from a degraded one")

	fake.set("west", "apps", "deployments", true)
	access.Probe(context.Background())
	reader, err = kialiCache.GetKubeCache("west")
	require.NoError(t, err)
	require.Same(t, remote, reader)
}
