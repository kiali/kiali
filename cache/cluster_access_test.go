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
	calls  int
	denied map[string]DeniedAccess // keyed by cluster/group/resource
	err    error
	mu     sync.Mutex
}

func (f *fakeAccess) set(cluster, group, resource string, allowed bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if allowed {
		f.denied[cluster+"/"+group+"/"+resource] = DeniedAccess{}
	} else {
		f.denied[cluster+"/"+group+"/"+resource] = DeniedAccess{Cluster: true}
	}
}

// setPartial records a partial revocation: the named namespaces are denied while the
// rest of the cluster stays readable.
func (f *fakeAccess) setPartial(cluster, group, resource string, namespaces []string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.denied[cluster+"/"+group+"/"+resource] = DeniedAccess{Namespaces: namespaces}
}

func (f *fakeAccess) check(_ context.Context, cluster, group, resource string) (DeniedAccess, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.err != nil {
		return DeniedAccess{}, f.err
	}
	return f.denied[cluster+"/"+group+"/"+resource], nil
}

// callCount reads the call counter under the mutex.
func (f *fakeAccess) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls
}

func newTestClusterAccess() (*ClusterAccess, *fakeAccess, *time.Time) {
	fake := &fakeAccess{denied: map[string]DeniedAccess{}}
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
	require.Equal(t, 1, fake.callCount())

	*now = now.Add(accessCheckDebounce)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, 2, fake.callCount())
}

func TestConfirmRevokedDebouncesChecks(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.set("west", "apps", "deployments", true)

	for i := 0; i < 5; i++ {
		require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	}
	require.Equal(t, 1, fake.callCount())

	*now = now.Add(accessCheckDebounce)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, 2, fake.callCount())
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
	require.Equal(t, 1, fake.callCount())

	// After expiry a fresh check runs and sees the denial.
	*now = now.Add(accessCheckDebounce)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, 2, fake.callCount())
	_, degraded = access.DegradedSince("west")
	require.True(t, degraded)
}

// The probe and the watch-error path share one result store: a verdict the watch-error
// path checked moments ago is reused by the probe rather than swept again. (The probe's
// own 30s interval always finds results older than the 10s debounce, so in production the
// reuse only suppresses duplicate sweeps while watch errors are actively firing.)
func TestProbeReusesFreshCheckResults(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	calls := fake.callCount()

	// No clock advance: the probe must reuse the fresh result instead of re-checking.
	access.Probe(context.Background())
	require.Equal(t, calls, fake.callCount(), "the probe reused the watch-error path's fresh verdict")
	require.Equal(t, []string{"bookinfo"}, access.RevokedNamespaces("west"))
}

// Concurrent ConfirmRevoked calls for the same cluster and resource share one in-flight
// sweep: in non-cluster-wide-access mode each namespace has its own informer per resource
// type, so a revocation makes many informers fire at once, and without deduplication each
// would launch its own full sweep.
func TestConcurrentConfirmRevokedRunsOneSweep(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			access.ConfirmRevoked(context.Background(), "west", "apps", "deployments")
		}()
	}
	wg.Wait()

	require.Equal(t, 1, fake.callCount(), "concurrent calls shared a single sweep")
	_, degraded := access.DegradedSince("west")
	require.True(t, degraded)
}

// Probe wipes lastCheck when it clears a recovered cluster, so a revocation that
// follows immediately runs a live check instead of being served the stale cached
// outcome from before the recovery.
func TestProbeWipesLastCheckForRevokedAgainCluster(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))

	fake.set("west", "apps", "deployments", true)
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())
	_, degraded := access.DegradedSince("west")
	require.False(t, degraded, "access was restored")

	// Revoked again right away: the wipe forces a new live check (a stale cached
	// outcome would be served within the debounce window otherwise).
	fake.set("west", "apps", "deployments", false)
	calls := fake.callCount()
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, calls+1, fake.callCount(), "a new live check ran after the probe cleared the cluster")
}

func TestProbeClearsClusterOnlyWhenAllRevokedResourcesAreBack(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)
	fake.set("west", "", "pods", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "", "pods"))

	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())
	_, degraded := access.DegradedSince("west")
	require.True(t, degraded, "nothing is restored yet")

	fake.set("west", "apps", "deployments", true)
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())
	_, degraded = access.DegradedSince("west")
	require.True(t, degraded, "pods are still forbidden")

	fake.set("west", "", "pods", true)
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())
	_, degraded = access.DegradedSince("west")
	require.False(t, degraded)
}

// A degraded cluster whose access comes back everywhere except some namespaces is
// restored, and those namespaces are seeded as partially revoked so their frozen data
// stays hidden - the mirror of the degradation condition, not an all-or-nothing recovery.
// A namespace deleted during the outage (its Role dies with it) denies forever, so
// requiring all namespaces back would hold the cluster degraded forever.
func TestProbeRecoversClusterWithPartialRevocation(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	_, degraded := access.DegradedSince("west")
	require.True(t, degraded)

	// Access is back everywhere except bookinfo (e.g. the namespace was deleted during
	// the outage and its Role with it).
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())

	_, degraded = access.DegradedSince("west")
	require.False(t, degraded, "the cluster recovers when any namespace is readable")
	require.Equal(t, []string{"bookinfo"}, access.RevokedNamespaces("west"), "the still-denied namespace's data stays hidden")

	// When bookinfo's access comes back too, its marks drop.
	fake.set("west", "apps", "deployments", true)
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())
	require.Empty(t, access.RevokedNamespaces("west"))
}

// A resource revoked while the probe is mid-check must not be cleared by that probe: the
// checks run without the lock, so the probe re-verifies the revoked set before deleting.
func TestProbeKeepsClusterRevokedAgainDuringCheck(t *testing.T) {
	deploymentsAllowed := false
	podsRevokedDuringCheck := false // recorded by the check, asserted after the probe returns
	var access *ClusterAccess
	access = NewClusterAccess(func(ctx context.Context, cluster, group, resource string) (DeniedAccess, error) {
		if group == "apps" {
			if !deploymentsAllowed {
				return DeniedAccess{Cluster: true}, nil
			}
			// The probe is checking its snapshot (deployments) when another resource
			// gets revoked. The snapshot's check still passes.
			podsRevokedDuringCheck = access.ConfirmRevoked(ctx, "west", "", "pods")
			return DeniedAccess{}, nil
		}
		return DeniedAccess{Cluster: true}, nil // pods are not allowed
	})
	now := time.Date(2026, 11, 9, 12, 0, 0, 0, time.UTC)
	access.now = func() time.Time { return now }

	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	deploymentsAllowed = true
	now = now.Add(accessCheckDebounce)

	access.Probe(context.Background())
	_, degraded := access.DegradedSince("west")
	require.True(t, degraded, "the cluster was revoked again while the probe was checking; it must stay degraded")
	require.True(t, podsRevokedDuringCheck, "the mid-check revocation was confirmed")
	require.Len(t, access.revoked["west"], 2, "both revoked resources are remembered")
}

// A partial revocation that escalates to a full one degrades the cluster directly from
// the probe, rather than waiting for a watch error: until one fires, the frozen informers
// would serve stale data for every namespace.
func TestProbeDegradesClusterWhenPartialEscalates(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, []string{"bookinfo"}, access.RevokedNamespaces("west"))

	// The rest of the cluster's access is now gone too.
	fake.set("west", "apps", "deployments", false)
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())

	_, degraded := access.DegradedSince("west")
	require.True(t, degraded, "the probe degraded the fully-revoked cluster itself")
	require.Empty(t, access.RevokedNamespaces("west"), "the partial marks are subsumed by the degradation")
}

// A probe that cannot tell keeps the current partial marks and retries on the next probe.
func TestProbeKeepsMarksWhenCheckUnknown(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))

	fake.err = errors.New("connection refused")
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())

	require.Equal(t, []string{"bookinfo"}, access.RevokedNamespaces("west"), "an unknown verdict keeps the current marks")
	_, degraded := access.DegradedSince("west")
	require.False(t, degraded)
}

// ConfirmRevoked switching the same resource between partial and full revocation.
func TestConfirmRevokedTransitions(t *testing.T) {
	access, fake, now := newTestClusterAccess()

	// Partial to full: the cluster degrades and the resource's marks are subsumed.
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	fake.set("west", "apps", "deployments", false)
	*now = now.Add(accessCheckDebounce)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	_, degraded := access.DegradedSince("west")
	require.True(t, degraded)
	require.Empty(t, access.RevokedNamespaces("west"), "the marks are subsumed by the degradation")

	// Full to partial: the cluster stays degraded (only the probe clears it), but the
	// denied namespaces are recorded for when it recovers.
	fake.setPartial("west", "", "pods", []string{"ambient-demo"})
	*now = now.Add(accessCheckDebounce)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "", "pods"))
	_, degraded = access.DegradedSince("west")
	require.True(t, degraded, "only the probe clears a degraded cluster")
	require.Equal(t, []string{"ambient-demo"}, access.RevokedNamespaces("west"))
}

func TestRunProbesUntilContextIsDone(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.set("west", "apps", "deployments", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	fake.set("west", "apps", "deployments", true)
	// Expire the debounced denial so the probe's first check runs live and sees the
	// restored access.
	*now = now.Add(accessCheckDebounce)

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

// A partial revocation records the denied namespaces without degrading the cluster:
// the cluster keeps serving, and callers hide the frozen namespaces' data.
func TestConfirmRevokedMarksNamespacesOnPartialDenial(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})

	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	_, degraded := access.DegradedSince("west")
	require.False(t, degraded, "the cluster stays healthy when other namespaces are readable")
	require.Equal(t, []string{"bookinfo"}, access.RevokedNamespaces("west"))
	require.Empty(t, access.RevokedNamespaces("east"))

	// A second resource adds its own denied namespaces; the union is what callers see.
	fake.setPartial("west", "", "pods", []string{"ambient-demo"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "", "pods"))
	require.Equal(t, []string{"ambient-demo", "bookinfo"}, access.RevokedNamespaces("west"))
}

// When a resource that previously found denied namespaces now sees everything readable,
// its marks are dropped so the namespaces are served again.
func TestConfirmRevokedDropsNamespaceMarksWhenAllowed(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Equal(t, []string{"bookinfo"}, access.RevokedNamespaces("west"))

	// Past the debounce window, a fresh check sees everything readable and the marks drop.
	fake.set("west", "apps", "deployments", true)
	*now = now.Add(accessCheckDebounce)
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.Empty(t, access.RevokedNamespaces("west"), "a namespace denied by no tracked resource is served again")
}

// The probe re-checks partially-revoked namespaces and drops the recovered ones, and
// replaces a resource's denied set with the fresh verdict.
func TestProbeUpdatesRevokedNamespaces(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo", "ambient-demo"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))

	// One namespace recovered: the probe replaces the set.
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())
	require.Equal(t, []string{"bookinfo"}, access.RevokedNamespaces("west"))

	// Everything recovered: the marks are gone.
	fake.set("west", "apps", "deployments", true)
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())
	require.Empty(t, access.RevokedNamespaces("west"))
}

// RevokedNamespaces returns its union sorted, so logs and tests are deterministic.
func TestRevokedNamespacesSorted(t *testing.T) {
	access, fake, _ := newTestClusterAccess()
	fake.setPartial("west", "apps", "deployments", []string{"zeta", "alpha"})
	fake.setPartial("west", "", "pods", []string{"mid"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "", "pods"))
	require.Equal(t, []string{"alpha", "mid", "zeta"}, access.RevokedNamespaces("west"))
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

	access, fake, now := newTestClusterAccess()
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
	require.ErrorIs(t, err, ErrClusterDegraded, "a degraded cache is distinguishable for status mapping")
	_, err = kialiCache.GetKubeCache(home)
	require.NoError(t, err, "other clusters are not affected")

	_, err = kialiCache.GetKubeCache("unknown")
	require.ErrorIs(t, err, ErrClusterNotCached, "a cluster with no cache configured is distinguishable from a degraded one")

	fake.set("west", "apps", "deployments", true)
	*now = now.Add(accessCheckDebounce)
	access.Probe(context.Background())
	reader, err = kialiCache.GetKubeCache("west")
	require.NoError(t, err)
	require.Same(t, remote, reader)
}

// A cluster can be partially revoked for one resource and fully revoked for another.
// When the probe clears the full revocation, the partial one must survive the same
// probe instead of writing into the marks it just dropped.
func TestProbeKeepsPartialRevocationWhenClusterRecovers(t *testing.T) {
	access, fake, now := newTestClusterAccess()
	fake.setPartial("west", "apps", "deployments", []string{"bookinfo"})
	require.False(t, access.ConfirmRevoked(context.Background(), "west", "apps", "deployments"))
	fake.set("west", "", "pods", false)
	require.True(t, access.ConfirmRevoked(context.Background(), "west", "", "pods"))

	fake.set("west", "", "pods", true)
	*now = now.Add(accessCheckDebounce)
	require.NotPanics(t, func() { access.Probe(context.Background()) })

	_, degraded := access.DegradedSince("west")
	require.False(t, degraded, "pods are readable again")
	require.Equal(t, []string{"bookinfo"}, access.RevokedNamespaces("west"), "deployments still deny bookinfo")
}
