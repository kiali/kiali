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

type accessCheckResult struct {
	allowed bool
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
// degraded, unless a live check shows the resource is still readable. A check that fails is
// treated as a revocation, which keeps the previous behavior when the cluster can't be reached.
func (a *ClusterAccess) ConfirmRevoked(ctx context.Context, cluster, group, resource string) bool {
	gr := groupResource{group: group, resource: resource}

	a.mu.Lock()
	last, found := a.lastCheck[cluster][gr]
	a.mu.Unlock()

	allowed := last.allowed
	if !found || a.now().Sub(last.at) >= accessCheckDebounce {
		allowed = a.runCheck(ctx, cluster, gr)
		a.mu.Lock()
		if a.lastCheck[cluster] == nil {
			a.lastCheck[cluster] = map[groupResource]accessCheckResult{}
		}
		a.lastCheck[cluster][gr] = accessCheckResult{allowed: allowed, at: a.now()}
		a.mu.Unlock()
	}

	if allowed {
		log.Infof("Watch on [%s] in cluster [%s] was forbidden, but Kiali can still read it. Keeping the cache.", resource, cluster)
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
			if !a.runCheck(ctx, cluster, gr) {
				restored = false
				break
			}
		}
		if !restored {
			continue
		}
		a.mu.Lock()
		delete(a.degraded, cluster)
		delete(a.revoked, cluster)
		delete(a.lastCheck, cluster)
		a.mu.Unlock()
		log.Infof("Kiali can read cluster [%s] again. Its cache will be rebuilt on the next read.", cluster)
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

func (a *ClusterAccess) runCheck(ctx context.Context, cluster string, gr groupResource) bool {
	ctx, cancel := context.WithTimeout(ctx, accessCheckTimeout)
	defer cancel()
	allowed, err := a.check(ctx, cluster, gr.group, gr.resource)
	if err != nil {
		log.Debugf("Unable to check access to [%s] in cluster [%s]: %s", gr.resource, cluster, err)
		return false
	}
	return allowed
}
