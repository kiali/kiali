package cache

import (
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"time"
)

type (
	NamespacesCache interface {
		SetNamespaces(token string, namespaces []models.Namespace)
		GetNamespaces(token string) []models.Namespace
		HasTokenNamespace(token string, namespace string) bool
	}
)

func (c *kialiCacheImpl) SetNamespaces(token string, namespaces []models.Namespace) {
	defer c.tokenLock.Unlock()
	c.tokenLock.Lock()
	isNamespace := make(map[string]bool)
	for _, ns := range namespaces {
		isNamespace[ns.Name] = true
	}
	c.tokenNamespaces[token] = namespaceCache{
		created:     time.Now(),
		namespaces:  namespaces,
		isNamespace: isNamespace,
	}
	log.Tracef("[Kiali Cache] SetNamespaces() for [token: %s] = %d", token, len(namespaces))
}

func (c *kialiCacheImpl) GetNamespaces(token string) []models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, exist := c.tokenNamespaces[token]; !exist {
		return nil
	} else {
		if time.Since(nsToken.created) > c.tokenNamespaceDuration {
			log.Tracef("[Kiali Cache] GetNamespaces() for [token: %s] Expired !", token)
			return nil
		} else {
			log.Tracef("[Kiali Cache] GetNamespaces() for [token: %s] = %d", token, len(nsToken.namespaces))
			return nsToken.namespaces
		}
	}
}

func (c *kialiCacheImpl) HasTokenNamespace(token string, namespace string) bool {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsCache, existToken := c.tokenNamespaces[token]; existToken {
		_, existNamespace := nsCache.isNamespace[namespace]
		return existNamespace
	}
	return false
}
