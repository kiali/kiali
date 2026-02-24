package cache

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type (
	RegistryStatusCache interface {
		GetRegistryStatus(cluster, revision, istiodNamespace string) *kubernetes.RegistryStatus
		SetRegistryStatus(registryStatus map[string]*kubernetes.RegistryStatus)
	}
)

// RegistryStatusKey returns the cache key for registry status: cluster:revision:istiodNamespace.
// Uniquely identifies a control plane when multiple revisions or meshes exist per cluster.
func RegistryStatusKey(cluster, revision, istiodNamespace string) string {
	return cluster + ":" + models.RevisionOrDefault(revision) + ":" + istiodNamespace
}

func (c *kialiCacheImpl) GetRegistryStatus(cluster, revision, istiodNamespace string) *kubernetes.RegistryStatus {
	key := RegistryStatusKey(cluster, revision, istiodNamespace)
	status, found := c.registryStatusStore.Get(key)
	if found {
		return status
	}
	// When revision and istiodNamespace are empty, return first registry for cluster (single-mesh backward compat).
	if revision == "" && istiodNamespace == "" {
		prefix := cluster + ":"
		for _, k := range c.registryStatusStore.Keys() {
			if strings.HasPrefix(k, prefix) {
				status, found = c.registryStatusStore.Get(k)
				if found {
					return status
				}
			}
		}
	}
	c.zl.Trace().Msgf("Unable to get registry status for cluster [%s] revision [%s] istiodNamespace [%s]. Registry status not found in cache.", cluster, revision, istiodNamespace)
	return nil
}

func (c *kialiCacheImpl) SetRegistryStatus(registryStatus map[string]*kubernetes.RegistryStatus) {
	c.registryStatusStore.Replace(registryStatus)
}
