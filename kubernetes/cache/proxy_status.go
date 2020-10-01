package cache

import (
	"strings"
	"time"

	"github.com/kiali/kiali/kubernetes"
)

type (
	ProxyStatusCache interface {
		CheckProxyStatus() bool
		GetPodProxyStatus(namespace, pod string) *kubernetes.ProxyStatus
		SetProxyStatus(proxyStatus []*kubernetes.ProxyStatus)
		RefreshProxyStatus()
	}
)

func (c *kialiCacheImpl) CheckProxyStatus() bool {
	defer c.proxyStatusLock.RUnlock()
	c.proxyStatusLock.RLock()
	if c.proxyStatusCreated == nil {
		return false
	}
	if time.Since(*c.proxyStatusCreated) > c.tokenNamespaceDuration {
		return false
	}
	return true
}

func (c *kialiCacheImpl) GetPodProxyStatus(namespace, pod string) *kubernetes.ProxyStatus {
	defer c.proxyStatusLock.RUnlock()
	c.proxyStatusLock.RLock()
	if nsProxyStatus, ok := c.proxyStatusNamespaces[namespace]; ok {
		if podProxyStatus, ok := nsProxyStatus[pod]; ok {
			return podProxyStatus.proxyStatus
		}
	}
	return nil
}

func (c *kialiCacheImpl) SetProxyStatus(proxyStatus []*kubernetes.ProxyStatus) {
	defer c.proxyStatusLock.Unlock()
	c.proxyStatusLock.Lock()
	if len(proxyStatus) > 0 {
		timeNow := time.Now()
		c.proxyStatusCreated = &timeNow
		for _, ps := range proxyStatus {
			if ps != nil {
				// Expected format <pod-name>.<namespace>
				// "proxy": "control-7bcc64d69d-qzsdk.travel-control"
				podId := strings.Split(ps.ProxyID, ".")
				if len(podId) == 2 {
					pod := podId[0]
					ns := podId[1]
					if _, exist := c.proxyStatusNamespaces[ns]; !exist {
						c.proxyStatusNamespaces[ns] = make(map[string]podProxyStatus)
					}
					c.proxyStatusNamespaces[ns][pod] = podProxyStatus{
						namespace:   ns,
						pod:         pod,
						proxyStatus: ps,
					}
				}
			}
		}
	}
}

func (c *kialiCacheImpl) RefreshProxyStatus() {
	defer c.proxyStatusLock.Unlock()
	c.proxyStatusLock.Lock()
	c.proxyStatusNamespaces = make(map[string]map[string]podProxyStatus)
}
