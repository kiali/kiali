package cache

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type (
	RegistryStatusCache interface {
		GetRegistryStatus(cluster string) *kubernetes.RegistryStatus
		SetRegistryStatus(registryStatus map[string]*kubernetes.RegistryStatus)
	}
)

func (c *kialiCacheImpl) GetRegistryStatus(cluster string) *kubernetes.RegistryStatus {
	status, found := c.registryStatusStore.Get(cluster)
	if !found {
		// Ignoring any errors here because registry services are optional. Most likely any errors
		// here are due to cache misses since populating the cache is handled asynchronously.
		log.FromContext(c.ctx).Trace().Msgf("Unable to get registry status for cluster [%s]. Registry status not found in cache.", cluster)
		return nil
	}

	return status
}

func (c *kialiCacheImpl) SetRegistryStatus(registryStatus map[string]*kubernetes.RegistryStatus) {
	c.registryStatusStore.Replace(registryStatus)
}
