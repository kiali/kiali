package cache

import (
	"time"

	"github.com/kiali/kiali/kubernetes"
)

type (
	RegistryStatusCache interface {
		CheckRegistryStatus() bool
		GetRegistryStatus() []*kubernetes.RegistryStatus
		SetRegistryStatus(registryStatus []*kubernetes.RegistryStatus)
		RefreshRegistryStatus()
	}
)

func (c *kialiCacheImpl) CheckRegistryStatus() bool {
	defer c.registryStatusLock.RUnlock()
	c.registryStatusLock.RLock()
	if c.registryStatusCreated == nil {
		return false
	}
	if time.Since(*c.registryStatusCreated) > c.tokenNamespaceDuration {
		return false
	}
	return true
}

func (c *kialiCacheImpl) GetRegistryStatus() []*kubernetes.RegistryStatus {
	defer c.registryStatusLock.RUnlock()
	c.registryStatusLock.RLock()
	return c.registryStatus
}

func (c *kialiCacheImpl) SetRegistryStatus(registryStatus []*kubernetes.RegistryStatus) {
	defer c.registryStatusLock.Unlock()
	c.registryStatusLock.Lock()
	timeNow := time.Now()
	c.registryStatusCreated = &timeNow
	c.registryStatus = registryStatus
}

func (c *kialiCacheImpl) RefreshRegistryStatus() {
	defer c.registryStatusLock.Unlock()
	c.registryStatusLock.Lock()
	c.registryStatus = nil
}
