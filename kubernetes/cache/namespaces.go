package cache

import (
	"time"

	"github.com/kiali/kiali/models"
)

type (
	NamespacesCache interface {
		SetNamespaces(token string, namespaces []models.Namespace)
		GetNamespaces(token string) []models.Namespace
		GetNamespace(token string, namespace string) *models.Namespace
		RefreshTokenNamespaces()
	}
)

func (c *kialiCacheImpl) SetNamespaces(token string, namespaces []models.Namespace) {
	defer c.tokenLock.Unlock()
	c.tokenLock.Lock()
	nameNamespace := make(map[string]models.Namespace, len(namespaces))
	for _, ns := range namespaces {
		nameNamespace[ns.Name] = ns
	}
	c.tokenNamespaces[token] = namespaceCache{
		created:       time.Now(),
		namespaces:    namespaces,
		nameNamespace: nameNamespace,
	}
}

func (c *kialiCacheImpl) GetNamespaces(token string) []models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, existToken := c.tokenNamespaces[token]; !existToken {
		return nil
	} else {
		if time.Since(nsToken.created) > c.tokenNamespaceDuration {
			return nil
		} else {
			return nsToken.namespaces
		}
	}
}

func (c *kialiCacheImpl) GetNamespace(token string, namespace string) *models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, existToken := c.tokenNamespaces[token]; !existToken {
		return nil
	} else {
		if time.Since(nsToken.created) > c.tokenNamespaceDuration {
			return nil
		} else {
			if ns, existsNamespace := c.tokenNamespaces[token].nameNamespace[namespace]; existsNamespace {
				return &ns
			} else {
				return nil
			}
		}
	}
}

func (c *kialiCacheImpl) RefreshTokenNamespaces() {
	defer c.tokenLock.Unlock()
	c.tokenLock.Lock()
	c.tokenNamespaces = make(map[string]namespaceCache)
}
