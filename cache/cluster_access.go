package cache

import (
	"context"
	"slices"
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

// checkVerdict is the outcome of one live access check, shared by the debounce store and
// the in-flight handoff.
type checkVerdict struct {
	denied  DeniedAccess
	unknown bool
}

type accessCheckResult struct {
	at time.Time
	checkVerdict
}

// inFlightKey identifies one running access check.
type inFlightKey struct {
	cluster string
	gr      groupResource
}

// inFlightCheck carries one running access check so concurrent callers for the same cluster
// and resource share a single sweep. In non-cluster-wide-access mode each namespace has its
// own informer per resource type, so a revocation makes many informers fire the watch error
// handler at once, and without deduplication each would launch its own full sweep.
type inFlightCheck struct {
	checkVerdict
	done chan struct{}
}

// ClusterAccess decides whether a Forbidden watch error means a cluster's access was really
// revoked, remembers the clusters whose cache was torn down because of it, and clears them
// again once a probe sees that access is back. It also tracks partial revocations at
// namespace grain: namespaces that are denied while the rest of the cluster remains
// readable, so that callers can stop serving their frozen informer snapshots.
type ClusterAccess struct {
	check AccessCheck
	// degraded records when each cluster lost all access.
	degraded map[string]time.Time
	// inFlight dedupes concurrent live checks per cluster and resource.
	inFlight  map[inFlightKey]*inFlightCheck
	lastCheck map[string]map[groupResource]accessCheckResult
	mu        sync.Mutex
	now       func() time.Time
	// nsRevoked remembers, per cluster and per resource that found denials, the
	// namespaces that denied it. A namespace stays excluded while any tracked
	// resource still denies it; the probe re-checks and drops recovered entries.
	nsRevoked map[string]map[groupResource]map[string]struct{}
	revoked   map[string]map[groupResource]struct{}
}

// NewClusterAccess returns a ClusterAccess that confirms revocations through the given live
// access check. Callers that cannot check access live (cmd/gather) simply pass no
// ClusterAccess at all rather than constructing one.
func NewClusterAccess(check AccessCheck) *ClusterAccess {
	return &ClusterAccess{
		check:     check,
		degraded:  map[string]time.Time{},
		inFlight:  map[inFlightKey]*inFlightCheck{},
		lastCheck: map[string]map[groupResource]accessCheckResult{},
		now:       time.Now,
		nsRevoked: map[string]map[groupResource]map[string]struct{}{},
		revoked:   map[string]map[groupResource]struct{}{},
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
	result, unknown := a.checkDebounced(ctx, cluster, gr)

	if unknown {
		log.Infof("Unable to tell whether access to [%s] in cluster [%s] was revoked. Keeping the cache and retrying later.", resource, cluster)
		return false
	}

	if !result.Cluster {
		partial := len(result.Namespaces) > 0
		a.mu.Lock()
		if partial {
			// Partial revocation: the cluster stays healthy, but the denied namespaces'
			// informers are frozen. Record them so callers stop serving stale data.
			a.setNsRevokedLocked(cluster, gr, result.Namespaces)
		} else {
			// Everything is readable again, including any namespace this resource
			// previously marked: drop its marks so the namespace is served again.
			a.dropNsRevokedLocked(cluster, gr)
		}
		a.mu.Unlock()
		if partial {
			log.Infof("Access to [%s] in cluster [%s] was revoked in namespaces %v while other namespaces remain readable. Their data is hidden until access is restored.", resource, cluster, result.Namespaces)
		} else {
			log.Infof("Kiali can still read [%s] in cluster [%s]. Keeping the cache.", resource, cluster)
		}
		return false
	}

	a.mu.Lock()
	a.markDegradedLocked(cluster, gr)
	a.mu.Unlock()
	return true
}

// markDegradedLocked records a full revocation of the resource: the cluster's degradation
// timestamp, logged once on the transition, the resource in the revoked set the recovery
// probe re-checks, and the resource's namespace marks subsumed by the cluster-grain
// degradation. It must be called with a.mu held.
func (a *ClusterAccess) markDegradedLocked(cluster string, gr groupResource) {
	if _, found := a.degraded[cluster]; !found {
		a.degraded[cluster] = a.now()
		log.Warningf("Kiali lost access to [%s] in cluster [%s]. Reads from that cluster will fail until access is restored.", gr.resource, cluster)
	}
	if a.revoked[cluster] == nil {
		a.revoked[cluster] = map[groupResource]struct{}{}
	}
	a.revoked[cluster][gr] = struct{}{}
	a.deleteNsRevokedLocked(cluster, gr)
}

// DegradedSince returns when the cluster was marked degraded, and whether it is.
func (a *ClusterAccess) DegradedSince(cluster string) (time.Time, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	since, found := a.degraded[cluster]
	return since, found
}

// RevokedNamespaces returns the union of the cluster's partially-revoked namespaces, sorted.
// See the KialiCache interface method for the full contract.
func (a *ClusterAccess) RevokedNamespaces(cluster string) []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.revokedNamespacesLocked(cluster)
}

// revokedNamespacesLocked returns the sorted union of the cluster's partially-revoked
// namespaces across the per-resource sets. It must be called with a.mu held.
func (a *ClusterAccess) revokedNamespacesLocked(cluster string) []string {
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
	slices.Sort(result)
	return result
}

// Probe checks every degraded cluster and clears the ones whose access is back. A cluster
// counts as restored when its access is no longer *fully* revoked - the negation of the
// degradation condition - so namespaces that are still denied while others are readable no
// longer hold the whole cluster down; their marks are seeded instead so callers keep hiding
// their frozen data. The next read through the cache re-creates informers. The probe also
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
		// Namespaces that remain denied once the cluster's access is back: seeded as
		// partial-revocation marks so their data stays hidden.
		remaining := map[groupResource][]string{}
		for _, gr := range resources {
			denied, unknown := a.checkDebounced(ctx, cluster, gr)
			if unknown || denied.Cluster {
				restored = false
				break
			}
			if len(denied.Namespaces) > 0 {
				remaining[gr] = denied.Namespaces
			}
		}
		if !restored {
			continue
		}
		// The checks ran without the lock. A resource revoked *again* while they were
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
		for gr, namespaces := range remaining {
			a.setNsRevokedLocked(cluster, gr, namespaces)
		}
		// Right after the reseed, the cluster's marks are exactly the remaining denials.
		remainingNamespaces := a.revokedNamespacesLocked(cluster)
		a.mu.Unlock()
		if len(remainingNamespaces) == 0 {
			log.Infof("Kiali can read cluster [%s] again. Its cache will be rebuilt on the next read.", cluster)
		} else {
			log.Infof("Kiali can read cluster [%s] again, except namespaces %v which remain revoked. Their data is hidden until access is restored.", cluster, remainingNamespaces)
		}
	}

	// Partial revocations: re-check each resource that found denied namespaces and
	// replace its denied set with the fresh verdict. A namespace recovers when no
	// tracked resource denies it anymore.
	for cluster, resources := range nsPending {
		for gr := range resources {
			denied, unknown := a.checkDebounced(ctx, cluster, gr)
			a.mu.Lock()
			switch {
			case unknown:
				// Cannot tell: keep the current marks, retry on the next probe.
			case denied.Cluster:
				// The cluster's access is now gone entirely. Degrade it right away
				// rather than wait for a watch error to do it: until one fires, the
				// frozen informers would serve stale data for every namespace. The
				// marks are dropped without the recovery log - this data is not
				// served again, and neither is the cluster.
				a.markDegradedLocked(cluster, gr)
			case len(denied.Namespaces) == 0:
				a.dropNsRevokedLocked(cluster, gr)
			default:
				// The cluster's marks may be gone since the snapshot: the loop above
				// drops them when the cluster recovers, and ConfirmRevoked drops them
				// when its own check comes back all-allowed. setNsRevokedLocked
				// re-creates the entry if needed.
				a.setNsRevokedLocked(cluster, gr, denied.Namespaces)
			}
			a.mu.Unlock()
		}
	}
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

// checkDebounced returns the verdict of a live access check, reusing a result no older than
// the debounce window and sharing one in-flight sweep between concurrent callers for the
// same cluster and resource. Every fresh result is stored, so the probe and the watch-error
// path agree on the newest verdict instead of each keeping its own.
func (a *ClusterAccess) checkDebounced(ctx context.Context, cluster string, gr groupResource) (DeniedAccess, bool) {
	key := inFlightKey{cluster: cluster, gr: gr}
	a.mu.Lock()
	if last, found := a.lastCheck[cluster][gr]; found && a.now().Sub(last.at) < accessCheckDebounce {
		a.mu.Unlock()
		return last.denied, last.unknown
	}
	if existing, ok := a.inFlight[key]; ok {
		a.mu.Unlock()
		select {
		case <-existing.done:
			return existing.denied, existing.unknown
		case <-ctx.Done():
			return DeniedAccess{}, true
		}
	}
	call := &inFlightCheck{done: make(chan struct{})}
	a.inFlight[key] = call
	a.mu.Unlock()

	// The sweep is shared by every caller for this cluster and resource, so it must not
	// inherit one caller's cancellation: an aborted request would otherwise store
	// "unknown" for everyone for the whole debounce window. The check's own timeout
	// bounds the detached sweep.
	denied, unknown := a.runCheck(context.WithoutCancel(ctx), cluster, gr)

	a.mu.Lock()
	delete(a.inFlight, key)
	if a.lastCheck[cluster] == nil {
		a.lastCheck[cluster] = map[groupResource]accessCheckResult{}
	}
	verdict := checkVerdict{denied: denied, unknown: unknown}
	a.lastCheck[cluster][gr] = accessCheckResult{at: a.now(), checkVerdict: verdict}
	a.mu.Unlock()

	call.checkVerdict = verdict
	close(call.done)
	return denied, unknown
}

// runCheck runs one live access check, bounded by the check timeout.
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

// setNsRevokedLocked records the namespaces that denied the resource, replacing any previous
// set. The cluster's entry may have been deleted since the caller's snapshot (cluster
// recovery, or the last mark dropping), so it is re-created here. It must be called with
// a.mu held.
func (a *ClusterAccess) setNsRevokedLocked(cluster string, gr groupResource, namespaces []string) {
	if a.nsRevoked[cluster] == nil {
		a.nsRevoked[cluster] = map[groupResource]map[string]struct{}{}
	}
	a.nsRevoked[cluster][gr] = namespaceSet(namespaces)
}

// deleteNsRevokedLocked removes the resource's namespace marks for the cluster silently,
// without the recovery log: used when the cluster is degrading, where the data is not served
// again either. It reports whether the cluster's last mark was removed. It must be called
// with a.mu held.
func (a *ClusterAccess) deleteNsRevokedLocked(cluster string, gr groupResource) bool {
	if a.nsRevoked[cluster] == nil {
		return false
	}
	delete(a.nsRevoked[cluster], gr)
	if len(a.nsRevoked[cluster]) == 0 {
		delete(a.nsRevoked, cluster)
		return true
	}
	return false
}

// dropNsRevokedLocked removes the resource's namespace marks for the cluster and logs
// when the cluster's last mark drops, so a namespace recovery is visible in the logs.
// A cluster with no marks logs nothing: there was nothing hidden to serve again.
// It must be called with a.mu held.
func (a *ClusterAccess) dropNsRevokedLocked(cluster string, gr groupResource) {
	if a.deleteNsRevokedLocked(cluster, gr) {
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

// namespaceSet turns a namespace slice into a set.
func namespaceSet(namespaces []string) map[string]struct{} {
	set := make(map[string]struct{}, len(namespaces))
	for _, ns := range namespaces {
		set[ns] = struct{}{}
	}
	return set
}
