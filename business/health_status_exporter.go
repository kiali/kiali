package business

import (
	"sync"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// entityKey uniquely identifies a health entity for tracking grace state between refresh cycles.
type entityKey struct {
	cluster    string
	healthType internalmetrics.HealthType
	name       string
	namespace  string
}

// NewEntityKey returns the canonical key for a health status metric entity.
func NewEntityKey(cluster, namespace string, healthType internalmetrics.HealthType, name string) entityKey {
	return entityKey{
		cluster:    cluster,
		healthType: healthType,
		name:       name,
		namespace:  namespace,
	}
}

// entityState tracks consecutive NA or missing refresh cycles before deleting a metric series.
type entityState struct {
	naStreak int
}

// HealthStatusExporter manages health status metric export with NA grace handling.
// It tracks per-entity state to avoid deleting metrics on transient NA status.
// seriesPresent records label sets for which SetHealthStatusForItem has succeeded so
// Delete is only invoked when a Prometheus child may exist (avoids redundant deletes
// for entities that always report NA).
type HealthStatusExporter struct {
	conf          *config.Config
	seriesPresent map[entityKey]struct{}
	state         map[entityKey]*entityState
	stateMutex    sync.RWMutex
}

// NewHealthStatusExporter creates a new HealthStatusExporter.
func NewHealthStatusExporter(conf *config.Config) *HealthStatusExporter {
	return &HealthStatusExporter{
		conf:          conf,
		seriesPresent: make(map[entityKey]struct{}),
		state:         make(map[entityKey]*entityState),
	}
}

// deleteHealthStatusSeriesIfPresent removes the Prometheus series only if this exporter
// previously set a value for the key (GaugeVec.Delete is skipped otherwise).
func (e *HealthStatusExporter) deleteHealthStatusSeriesIfPresent(key entityKey) {
	if _, ok := e.seriesPresent[key]; !ok {
		return
	}
	internalmetrics.DeleteHealthStatusForItem(key.cluster, key.namespace, key.healthType, key.name)
	delete(e.seriesPresent, key)
}

// maxConsecutiveNA returns the configured streak length of NA or missing refresh cycles
// before deleting a series. Values <= 0 use the default (3).
func (e *HealthStatusExporter) maxConsecutiveNA() int {
	n := e.conf.Server.Observability.Metrics.HealthStatus.MaxConsecutiveNA
	if n <= 0 {
		return 3
	}
	return n
}

// Observe processes a health status for an entity and updates the metric accordingly.
// If status is NA, it increments a per-entity streak; after MaxConsecutiveNA consecutive
// NA observations (from server config) the series is deleted only if a value was previously set for this key.
// If status is non-NA, it sets the metric and clears streak state.
func (e *HealthStatusExporter) Observe(cluster, namespace string, healthType internalmetrics.HealthType, name, status string) {
	if !e.conf.Server.Observability.Metrics.HealthStatus.Enabled {
		return
	}

	value, ok := internalmetrics.HealthStatusValue(status)
	key := NewEntityKey(cluster, namespace, healthType, name)

	limit := e.maxConsecutiveNA()

	e.stateMutex.Lock()
	defer e.stateMutex.Unlock()

	if ok {
		// Non-NA status: set metric and clear streak state
		internalmetrics.SetHealthStatusForItem(cluster, namespace, healthType, name, value)
		e.seriesPresent[key] = struct{}{}
		delete(e.state, key)
	} else {
		// NA status: count consecutive refresh cycles with NA
		state, exists := e.state[key]
		if !exists {
			if limit <= 1 {
				e.deleteHealthStatusSeriesIfPresent(key)
				return
			}
			e.state[key] = &entityState{naStreak: 1}
		} else {
			state.naStreak++
			if state.naStreak >= limit {
				e.deleteHealthStatusSeriesIfPresent(key)
				delete(e.state, key)
			}
		}
	}
}

// ReconcileNamespace processes entities that were seen in the current refresh cycle
// and increments the streak for entities that are no longer present (treating them as NA).
// Call this after processing all entities in a namespace.
//
// Keys must be reconciled for both NA streak state and seriesPresent: a non-NA Observe
// clears state but leaves seriesPresent set, so an entity that drops out of app/service/workload
// maps would otherwise never be advanced toward deletion.
func (e *HealthStatusExporter) ReconcileNamespace(cluster, namespace string, seenKeys map[entityKey]bool) {
	if !e.conf.Server.Observability.Metrics.HealthStatus.Enabled {
		return
	}

	limit := e.maxConsecutiveNA()

	e.stateMutex.Lock()
	defer e.stateMutex.Unlock()

	candidates := make(map[entityKey]struct{})
	for key := range e.state {
		if key.cluster == cluster && key.namespace == namespace {
			candidates[key] = struct{}{}
		}
	}
	for key := range e.seriesPresent {
		if key.cluster == cluster && key.namespace == namespace {
			candidates[key] = struct{}{}
		}
	}

	for key := range candidates {
		if seenKeys[key] {
			continue
		}
		state, exists := e.state[key]
		if !exists {
			if limit <= 1 {
				e.deleteHealthStatusSeriesIfPresent(key)
				continue
			}
			e.state[key] = &entityState{naStreak: 1}
			continue
		}
		state.naStreak++
		if state.naStreak >= limit {
			e.deleteHealthStatusSeriesIfPresent(key)
			delete(e.state, key)
		}
	}
}

// distinctClusters returns every cluster value present in exporter state or seriesPresent.
func (e *HealthStatusExporter) distinctClusters() []string {
	e.stateMutex.RLock()
	defer e.stateMutex.RUnlock()
	set := make(map[string]struct{})
	for key := range e.state {
		set[key.cluster] = struct{}{}
	}
	for key := range e.seriesPresent {
		set[key.cluster] = struct{}{}
	}
	out := make([]string, 0, len(set))
	for cluster := range set {
		out = append(out, cluster)
	}
	return out
}

// distinctNamespacesForCluster returns every namespace (for the given cluster) present in
// exporter state or seriesPresent.
func (e *HealthStatusExporter) distinctNamespacesForCluster(cluster string) []string {
	e.stateMutex.RLock()
	defer e.stateMutex.RUnlock()
	set := make(map[string]struct{})
	for key := range e.state {
		if key.cluster == cluster {
			set[key.namespace] = struct{}{}
		}
	}
	for key := range e.seriesPresent {
		if key.cluster == cluster {
			set[key.namespace] = struct{}{}
		}
	}
	out := make([]string, 0, len(set))
	for ns := range set {
		out = append(out, ns)
	}
	return out
}

// ReconcileDroppedClusters reconciles health status metrics for every (cluster, namespace)
// still tracked by this exporter whose cluster is not in knownClusters (typically the set
// from the current cache GetClusters() result). Call once at the end of a successful full
// refresh when clusters may have been removed from the cache.
func (e *HealthStatusExporter) ReconcileDroppedClusters(knownClusters map[string]bool) {
	if !e.conf.Server.Observability.Metrics.HealthStatus.Enabled {
		return
	}
	for _, cluster := range e.distinctClusters() {
		if knownClusters[cluster] {
			continue
		}
		for _, ns := range e.distinctNamespacesForCluster(cluster) {
			e.ReconcileNamespace(cluster, ns, nil)
		}
	}
}

// ReconcileDroppedNamespacesForCluster reconciles namespaces that still have exporter state
// for this cluster but were not returned in the current namespace list (cluster-scoped).
// Call only after a successful GetClusterNamespaces for this cluster; visitedNamespaces
// should contain every namespace name from that list.
func (e *HealthStatusExporter) ReconcileDroppedNamespacesForCluster(cluster string, visitedNamespaces map[string]bool) {
	if !e.conf.Server.Observability.Metrics.HealthStatus.Enabled {
		return
	}
	for _, ns := range e.distinctNamespacesForCluster(cluster) {
		if visitedNamespaces[ns] {
			continue
		}
		e.ReconcileNamespace(cluster, ns, nil)
	}
}
