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
	nameNamespace := make(map[string]map[string]models.Namespace)
	for _, ns := range namespaces {
		for _, cluster := range ns.Clusters {
			if nameNamespace[ns.Name] == nil {
				nameNamespace[ns.Name] = make(map[string]models.Namespace)
			}
			nameNamespace[ns.Name][cluster] = ns
		}
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
		var nsList []models.Namespace
		if time.Since(nsToken.created) < c.tokenNamespaceDuration {
			nsList = append(nsList, nsToken.namespaces...)
		}
		return nsList
	}
}

func (c *kialiCacheImpl) GetNamespace(token string, namespace string) *models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, existToken := c.tokenNamespaces[token]; !existToken {
		return nil
	} else {
		if time.Since(nsToken.created) <= c.tokenNamespaceDuration {
			for cluster, _ := range nsToken.nameNamespace[namespace] {
				if ns, existsNamespace := nsToken.nameNamespace[namespace][cluster]; existsNamespace {
					// TODO: Return N
					return &ns
				} else {
					return nil
				}
			}

		}

		return nil
	}
}

func (c *kialiCacheImpl) RefreshTokenNamespaces() {
	defer c.tokenLock.Unlock()
	c.tokenLock.Lock()
	c.tokenNamespaces = make(map[string]namespaceCache)
}
