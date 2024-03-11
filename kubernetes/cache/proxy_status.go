package cache

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
)

func proxyStatusKey(cluster, namespace, pod string) string {
	return cluster + namespace + pod
}

type ProxyStatusCache interface {
	SetPodProxyStatus([]*kubernetes.ProxyStatus)
	GetPodProxyStatus(cluster, namespace, pod string) *kubernetes.ProxyStatus
}

func (c *kialiCacheImpl) SetPodProxyStatus(proxyStatus []*kubernetes.ProxyStatus) {
	podProxyByID := make(map[string]*kubernetes.ProxyStatus)
	for _, ps := range proxyStatus {
		if ps != nil {
			// Expected format <pod-name>.<namespace>
			// "proxy": "control-7bcc64d69d-qzsdk.travel-control"
			podId := strings.Split(ps.ProxyID, ".")
			if len(podId) == 2 {
				pod := podId[0]
				ns := podId[1]
				cluster := ps.ClusterID
				key := proxyStatusKey(cluster, ns, pod)
				podProxyByID[key] = ps
			}
		}
	}
	c.proxyStatusStore.Replace(podProxyByID)
}

func (c *kialiCacheImpl) GetPodProxyStatus(cluster, namespace, pod string) *kubernetes.ProxyStatus {
	key := proxyStatusKey(cluster, namespace, pod)
	proxyStatus, found := c.proxyStatusStore.Get(key)
	if !found {
		return nil
	}
	return proxyStatus
}
