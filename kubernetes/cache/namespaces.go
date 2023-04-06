package cache

import (
	"time"

	"github.com/kiali/kiali/models"
)

type (
	NamespacesCache interface {
		SetNamespaces(token string, namespaces []models.Namespace)
		GetNamespaces(token string) []models.Namespace
		GetNamespace(token string, namespace string, cluster string) *models.Namespace
		RefreshTokenNamespaces()
	}
)

func (c *kialiCacheImpl) SetNamespaces(token string, namespaces []models.Namespace) {
	defer c.tokenLock.Unlock()
	c.tokenLock.Lock()
	clusterNamespace := make(map[string]map[string]models.Namespace)
	for _, ns := range namespaces {
		if clusterNamespace[ns.Cluster] == nil {
			clusterNamespace[ns.Cluster] = make(map[string]models.Namespace)
		}
		clusterNamespace[ns.Cluster][ns.Name] = ns
	}

	c.tokenNamespaces[token] = namespaceCache{
		created:          time.Now(),
		namespaces:       namespaces,
		clusterNamespace: clusterNamespace,
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

func (c *kialiCacheImpl) GetNamespace(token string, namespace string, cluster string) *models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, existToken := c.tokenNamespaces[token]; existToken {
		// Token hasn't expired yet.
		if time.Since(nsToken.created) <= c.tokenNamespaceDuration {
			// And there's a namespace for the given cluster.
			if nsFound, ok := nsToken.clusterNamespace[cluster][namespace]; ok {
				return &nsFound
			}
		}
	}
	return nil
}

func (c *kialiCacheImpl) RefreshTokenNamespaces() {
	defer c.tokenLock.Unlock()
	c.tokenLock.Lock()
	c.tokenNamespaces = make(map[string]namespaceCache)
}
