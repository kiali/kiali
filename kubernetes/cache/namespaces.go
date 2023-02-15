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
	nsList := make(map[string][]models.Namespace)
	for _, ns := range namespaces {
		if nameNamespace[ns.Cluster] == nil {
			nameNamespace[ns.Cluster] = make(map[string]models.Namespace)
		}
		nameNamespace[ns.Cluster][ns.Name] = ns
		nsList[ns.Cluster] = append(nsList[ns.Cluster], ns)
	}

	for _, cluster := range c.clientFactory.GetClusterNames() {
		if c.tokenNamespaces[token] == nil {
			c.tokenNamespaces[token] = make(map[string]namespaceCache)
		}
		c.tokenNamespaces[token][cluster] = namespaceCache{
			created:       time.Now(),
			namespaces:    nsList[cluster],
			nameNamespace: nameNamespace[cluster],
		}
	}
}

func (c *kialiCacheImpl) GetNamespaces(token string) []models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, existToken := c.tokenNamespaces[token]; !existToken {
		return nil
	} else {
		clusterList := []models.Namespace{}
		for _, cluster := range c.clientFactory.GetClusterNames() {
			if time.Since(nsToken[cluster].created) < c.tokenNamespaceDuration {
				clusterList = append(clusterList, nsToken[cluster].namespaces...)
			}
		}
		if len(clusterList) > 0 {
			return clusterList
		}
		return nil
	}
}

func (c *kialiCacheImpl) GetNamespace(token string, namespace string) *models.Namespace {
	defer c.tokenLock.RUnlock()
	c.tokenLock.RLock()
	if nsToken, existToken := c.tokenNamespaces[token]; !existToken {
		return nil
	} else {
		// TODO: Should return more than one?
		for _, cluster := range c.clientFactory.GetClusterNames() {
			if time.Since(nsToken[cluster].created) <= c.tokenNamespaceDuration {
				if ns, existsNamespace := c.tokenNamespaces[token][cluster].nameNamespace[namespace]; existsNamespace {
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
	c.tokenNamespaces = make(map[string]map[string]namespaceCache)
}
