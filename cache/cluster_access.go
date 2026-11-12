package cache

import (
	"context"
	"sync"
	"time"

	"github.com/kiali/kiali/log"
)

const (
	// accessCheckDebounce is how long the result of a live access check is reused. The watch
	// error handler fires once per informer per reflector retry, which is frequent during an outage.
	accessCheckDebounce = 10 * time.Second
	// accessCheckTimeout bounds a live access check. It runs on the reflector's goroutine.
	accessCheckTimeout = 5 * time.Second
	// DefaultAccessProbeInterval is how often degraded clusters are checked for restored access.
	DefaultAccessProbeInterval = 30 * time.Second
)

// DeniedAccess is the verdict of a live access check for one resource on one cluster.
// Cluster is set when no accessible namespace grants the read (a full revocation: the
// cluster is degraded and its cache torn down). Namespaces holds the accessible
// namespaces that deny the read while others remain readable (a partial revocation):
// those namespaces' informers cannot refresh, so reads from them would serve stale
// data and callers must exclude them instead. Namespaces is only populated in
// non-cluster-wide-access mode; a cluster-wide check cannot be denied per namespace.
//
// Coarse grain, by design: a namespace counts as denied when it denies any resource
// type the sweep was asked about. A namespace that denies deployments but allows pods
// is still marked revoked in full - its data cannot be served completely anyway, and
// per-resource namespace tracking would multiply the state for little user value.
type DeniedAccess struct {
	Cluster    bool
	Namespaces []string
}

// AccessCheck reports whether Kiali can still list and watch a resource in a cluster,
// and which accessible namespaces are denied. It returns an error when it cannot tell,
// for example when the API server is unreachable.
type AccessCheck func(ctx context.Context, cluster, group, resource string) (DeniedAccess, error)

type groupResource struct {
	group    string
	resource string
}

type accessCheckResult struct {
	at      time.Time
	denied  DeniedAccess
	unknown bool
}

// ClusterAccess decides whether a Forbidden watch error means a cluster's access was really
// revoked, remembers the clusters whose cache was torn down because of it, and clears them
// again once a probe sees that access is back. It also tracks partial revocations at
// namespace grain: namespaces that are denied while the rest of the cluster remains
// readable, so that callers can stop serving their frozen informer snapshots.
type ClusterAccess struct {
	check AccessCheck
	now   func() time.Time

	degraded  map[string]time.Time
	lastCheck map[string]map[groupResource]accessCheckResult
	mu        sync.Mutex
	revoked   map[string]map[groupResource]struct{}
	// nsRevoked remembers, per cluster and per resource that found denials, the
	// namespaces that denied it. A namespace stays excluded while any tracked
	// resource still denies it; the probe re-checks and drops recovered entries.
	nsRevoked map[string]map[groupResource]map[string]struct{}
}

func NewClusterAccess(check AccessCheck) *ClusterAccess {
	return &ClusterAccess{
		check:     check,
		degraded:  map[string]time.Time{},
		lastCheck: map[string]map[groupResource]accessCheckResult{},
		now:       time.Now,
		revoked:   map[string]map[groupResource]struct{}{},
		nsRevoked: map[string]map[groupResource]map[string]struct{}{},
	}
}

// ConfirmRevoked is called on a Forbidden watch error. It returns true, and marks the cluster
// degraded, only when a live check definitively says the resource is no longer readable in
// any accessible namespace. A check that cannot tell (timeout, unreachable API server) is
// not evidence of a revocation: tearing down on it could permanently degrade a
// healthy-but-slow cluster, because the recovery probe uses the same check and could then
// never confirm recovery. The cache is kept and the debounce retries.
//
// When some accessible namespaces are still readable, the cluster is kept but the denied
// namespaces are recorded (see RevokedNamespaces): their informers cannot refresh, and
// serving their last-synced snapshot would show resources that no longer exist.
func (a *ClusterAccess) ConfirmRevoked(ctx context.Context, cluster, group, resource string) bool {
	gr := groupResource{group: group, resource: resource}

	a.mu.Lock()
	last, found := a.lastCheck[cluster][gr]
	a.mu.Unlock()

	result := last.denied
	unknown := last.unknown
	if !found || a.now().Sub(last.at) >= accessCheckDebounce {
		result, unknown = a.runCheck(ctx, cluster, gr)
		a.mu.Lock()
		if a.lastCheck[cluster] == nil {
			a.lastCheck[cluster] = map[groupResource]accessCheckResult{}
		}
		a.lastCheck[cluster][gr] = accessCheckResult{at: a.now(), denied: result, unknown: unknown}
		a.mu.Unlock()
	}

	if unknown {
		log.Infof("Unable to tell whether access to [%s] in cluster [%s] was revoked. Keeping the cache and retrying later.", resource, cluster)
		return false
	}

	if !result.Cluster && len(result.Namespaces) == 0 {
		// Everything is readable again, including any namespace this resource previously
		// marked: drop its marks so the namespace is served again.
		a.mu.Lock()
		a.dropNsRevokedLocked(cluster, gr)
		a.mu.Unlock()
		log.Infof("Watch on [%s] in cluster [%s] was forbidden, but Kiali can still read it. Keeping the cache.", resource, cluster)
		return false
	}

	if !result.Cluster {
		// Partial revocation: the cluster stays healthy, but the denied namespaces'
		// informers are frozen. Record them so callers stop serving stale data.
		a.mu.Lock()
		if a.nsRevoked[cluster] == nil {
			a.nsRevoked[cluster] = map[groupResource]map[string]struct{}{}
		}
		namespaces := map[string]struct{}{}
		for _, ns := range result.Namespaces {
			namespaces[ns] = struct{}{}
		}
		a.nsRevoked[cluster][gr] = namespaces
		a.mu.Unlock()
		log.Infof("Access to [%s] in cluster [%s] was revoked in namespaces %v while other namespaces remain readable. Their data is hidden until access is restored.", resource, cluster, result.Namespaces)
		return false
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	if _, found := a.degraded[cluster]; !found {
		a.degraded[cluster] = a.now()
		log.Warningf("Kiali lost access to [%s] in cluster [%s]. Reads from that cluster will fail until access is restored.", resource, cluster)
	}
	if a.revoked[cluster] == nil {
		a.revoked[cluster] = map[groupResource]struct{}{}
	}
	a.revoked[cluster][gr] = struct{}{}
	return true
}

// DegradedSince returns when the cluster was marked degraded, and whether it is.
func (a *ClusterAccess) DegradedSince(cluster string) (time.Time, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	since, found := a.degraded[cluster]
	return since, found
}

// RevokedNamespaces returns the accessible namespaces on the cluster whose access was
// revoked while the rest of the cluster remains readable (a partial revocation). Reads
// from their informers serve stale data - resources that may no longer exist - so
// callers must exclude these namespaces rather than serve frozen state.
func (a *ClusterAccess) RevokedNamespaces(cluster string) []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	union := map[string]struct{}{}
	for _, namespaces := range a.nsRevoked[cluster] {
		for ns := range namespaces {
			union[ns] = struct{}{}
		}
	}
	result := make([]string, 0, len(union))
	for ns := range union {
		result = append(result, ns)
	}
	return result
}

// Probe checks every degraded cluster and clears the ones whose revoked resources are all
// readable again. The next read through the cache re-creates their informers. It also
// re-checks partially-revoked namespaces and drops the ones that recovered.
func (a *ClusterAccess) Probe(ctx context.Context) {
	a.mu.Lock()
	pending := map[string][]groupResource{}
	for cluster, resources := range a.revoked {
		for gr := range resources {
			pending[cluster] = append(pending[cluster], gr)
		}
	}
	nsPending := map[string]map[groupResource]struct{}{}
	for cluster, resources := range a.nsRevoked {
		nsPending[cluster] = map[groupResource]struct{}{}
		for gr := range resources {
			nsPending[cluster][gr] = struct{}{}
		}
	}
	a.mu.Unlock()

	for cluster, resources := range pending {
		restored := true
		for _, gr := range resources {
			if denied, unknown := a.runCheck(ctx, cluster, gr); unknown || denied.Cluster || len(denied.Namespaces) > 0 {
				restored = false
				break
			}
		}
		if !restored {
			continue
		}
		// The checks ran without the lock. A resource revoked again while they were
		// running must not be cleared by this probe, so re-verify the revoked set is
		// still the one that was checked before deleting anything.
		a.mu.Lock()
		if !a.revokedUnchangedLocked(cluster, resources) {
			a.mu.Unlock()
			continue
		}
		delete(a.degraded, cluster)
		delete(a.revoked, cluster)
		delete(a.lastCheck, cluster)
		delete(a.nsRevoked, cluster)
		a.mu.Unlock()
		log.Infof("Kiali can read cluster [%s] again. Its cache will be rebuilt on the next read.", cluster)
	}

	// Partial revocations: re-check each resource that found denied namespaces and
	// replace its denied set with the fresh verdict. A namespace recovers when no
	// tracked resource denies it anymore.
	for cluster, resources := range nsPending {
		for gr := range resources {
			denied, unknown := a.runCheck(ctx, cluster, gr)
			a.mu.Lock()
			switch {
			case unknown:
				// Cannot tell: keep the current marks, retry on the next probe.
			case denied.Cluster:
				// The whole cluster is now revoked; the cluster-grain skip takes over.
				a.dropNsRevokedLocked(cluster, gr)
			case len(denied.Namespaces) == 0:
				a.dropNsRevokedLocked(cluster, gr)
			default:
				namespaces := map[string]struct{}{}
				for _, ns := range denied.Namespaces {
					namespaces[ns] = struct{}{}
				}
				// The cluster's marks may be gone since the snapshot: the loop above
				// drops them when the cluster recovers, and ConfirmRevoked drops them
				// when its own check comes back all-allowed.
				if a.nsRevoked[cluster] == nil {
					a.nsRevoked[cluster] = map[groupResource]map[string]struct{}{}
				}
				a.nsRevoked[cluster][gr] = namespaces
			}
			a.mu.Unlock()
		}
	}
}

// dropNsRevokedLocked removes the resource's namespace marks for the cluster and logs
// when the cluster's last mark drops, so a namespace recovery is visible in the logs.
// It must be called with a.mu held.
func (a *ClusterAccess) dropNsRevokedLocked(cluster string, gr groupResource) {
	delete(a.nsRevoked[cluster], gr)
	if len(a.nsRevoked[cluster]) == 0 {
		delete(a.nsRevoked, cluster)
		log.Infof("Kiali can read the partially-revoked namespaces of cluster [%s] again. Their data is served again.", cluster)
	}
}

// revokedUnchangedLocked reports whether the cluster's revoked set is still exactly the
// resources the probe checked. It must be called with a.mu held.
func (a *ClusterAccess) revokedUnchangedLocked(cluster string, resources []groupResource) bool {
	current := a.revoked[cluster]
	if len(current) != len(resources) {
		return false
	}
	for _, gr := range resources {
		if _, ok := current[gr]; !ok {
			return false
		}
	}
	return true
}

// Run probes degraded clusters every interval until ctx is done.
func (a *ClusterAccess) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.Probe(ctx)
		}
	}
}

func (a *ClusterAccess) runCheck(ctx context.Context, cluster string, gr groupResource) (DeniedAccess, bool) {
	ctx, cancel := context.WithTimeout(ctx, accessCheckTimeout)
	defer cancel()
	denied, err := a.check(ctx, cluster, gr.group, gr.resource)
	if err != nil {
		log.Debugf("Unable to check access to [%s] in cluster [%s]: %s", gr.resource, cluster, err)
		return DeniedAccess{}, true
	}
	return denied, false
}
