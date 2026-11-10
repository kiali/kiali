package cache

// Assisted-by: Claude Code

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

// AccessCheck reports whether Kiali can still list and watch a resource in a cluster.
// It returns an error when it cannot tell, for example when the API server is unreachable.
type AccessCheck func(ctx context.Context, cluster, group, resource string) (bool, error)

type groupResource struct {
	group    string
	resource string
}

// checkOutcome classifies the result of a live access check.
type checkOutcome int

const (
	// checkAllowed means the check says the resource is readable.
	checkAllowed checkOutcome = iota
	// checkDenied means the check definitively says the resource is not readable.
	checkDenied
	// checkUnknown means the check could not tell, e.g. it timed out or the API server
	// was unreachable. It is not evidence of a revocation.
	checkUnknown
)

type accessCheckResult struct {
	outcome checkOutcome
	at      time.Time
}

// ClusterAccess decides whether a Forbidden watch error means a cluster's access was really
// revoked, remembers the clusters whose cache was torn down because of it, and clears them
// again once a probe sees that access is back.
type ClusterAccess struct {
	check AccessCheck
	now   func() time.Time

	mu        sync.Mutex
	degraded  map[string]time.Time
	revoked   map[string]map[groupResource]struct{}
	lastCheck map[string]map[groupResource]accessCheckResult
}

func NewClusterAccess(check AccessCheck) *ClusterAccess {
	return &ClusterAccess{
		check:     check,
		now:       time.Now,
		degraded:  map[string]time.Time{},
		revoked:   map[string]map[groupResource]struct{}{},
		lastCheck: map[string]map[groupResource]accessCheckResult{},
	}
}

// ConfirmRevoked is called on a Forbidden watch error. It returns true, and marks the cluster
// degraded, only when a live check definitively says the resource is no longer readable. A
// check that cannot tell (timeout, unreachable API server) is not evidence of a revocation:
// tearing down on it could permanently degrade a healthy-but-slow cluster, because the
// recovery probe uses the same check and could then never confirm recovery. The cache is
// kept and the debounce retries.
func (a *ClusterAccess) ConfirmRevoked(ctx context.Context, cluster, group, resource string) bool {
	gr := groupResource{group: group, resource: resource}

	a.mu.Lock()
	last, found := a.lastCheck[cluster][gr]
	a.mu.Unlock()

	outcome := last.outcome
	if !found || a.now().Sub(last.at) >= accessCheckDebounce {
		outcome = a.runCheck(ctx, cluster, gr)
		a.mu.Lock()
		if a.lastCheck[cluster] == nil {
			a.lastCheck[cluster] = map[groupResource]accessCheckResult{}
		}
		a.lastCheck[cluster][gr] = accessCheckResult{outcome: outcome, at: a.now()}
		a.mu.Unlock()
	}

	switch outcome {
	case checkAllowed:
		log.Infof("Watch on [%s] in cluster [%s] was forbidden, but Kiali can still read it. Keeping the cache.", resource, cluster)
		return false
	case checkUnknown:
		log.Infof("Unable to tell whether access to [%s] in cluster [%s] was revoked. Keeping the cache and retrying later.", resource, cluster)
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

// Probe checks every degraded cluster and clears the ones whose revoked resources are all
// readable again. The next read through the cache re-creates their informers.
func (a *ClusterAccess) Probe(ctx context.Context) {
	a.mu.Lock()
	pending := map[string][]groupResource{}
	for cluster, resources := range a.revoked {
		for gr := range resources {
			pending[cluster] = append(pending[cluster], gr)
		}
	}
	a.mu.Unlock()

	for cluster, resources := range pending {
		restored := true
		for _, gr := range resources {
			if a.runCheck(ctx, cluster, gr) != checkAllowed {
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
		a.mu.Unlock()
		log.Infof("Kiali can read cluster [%s] again. Its cache will be rebuilt on the next read.", cluster)
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

func (a *ClusterAccess) runCheck(ctx context.Context, cluster string, gr groupResource) checkOutcome {
	ctx, cancel := context.WithTimeout(ctx, accessCheckTimeout)
	defer cancel()
	allowed, err := a.check(ctx, cluster, gr.group, gr.resource)
	switch {
	case err != nil:
		log.Debugf("Unable to check access to [%s] in cluster [%s]: %s", gr.resource, cluster, err)
		return checkUnknown
	case allowed:
		return checkAllowed
	default:
		return checkDenied
	}
}
