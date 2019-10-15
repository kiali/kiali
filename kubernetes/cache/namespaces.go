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
		GetNamespace(token string, namespace string) *models.Namespace
	}
)

func (c *kialiCacheImpl) SetNamespaces(token string, namespaces []models.Namespace) {
	defer c.tokenLock.Unlock()
	c.tokenLock.Lock()
	nameNamespace := make(map[string]models.Namespace)
	for _, ns := range namespaces {
		nameNamespace[ns.Name] = ns
	}
	c.tokenNamespaces[token] = namespaceCache{
		created:       time.Now(),
		namespaces:    namespaces,
		nameNamespace: nameNamespace,
	}
	log.Tracef("[Kiali Cache] SetNamespaces() for [token: %s] = %d", token, len(namespaces))
}

func (c *kialiCacheImpl) GetNamespaces(token string) []models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, existToken := c.tokenNamespaces[token]; !existToken {
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

func (c *kialiCacheImpl) GetNamespace(token string, namespace string) *models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, existToken := c.tokenNamespaces[token]; !existToken {
		return nil
	} else {
		if time.Since(nsToken.created) > c.tokenNamespaceDuration {
			log.Tracef("[Kiali Cache] GetNamespace() for [token: %s] [namespace: %s] Expired !", token, namespace)
			return nil
		} else {
			if ns, existsNamespace := c.tokenNamespaces[token].nameNamespace[namespace]; existsNamespace {
				log.Tracef("[Kiali Cache] GetNamespace() for [token: %s] [namespace: %s]", token, namespace)
				return &ns
			} else {
				return nil
			}
		}
	}
}
