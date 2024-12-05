package cache

import (
	"github.com/kiali/kiali/kubernetes"
)

func ztunnelDumpKey(cluster, namespace, pod string) string {
	return cluster + namespace + pod
}

type ZtunnelDumpCache interface {
	SetZtunnelDump(ztunnelConfig map[string]*kubernetes.ZtunnelConfigDump)
	GetZtunnelDump(cluster, namespace, pod string) *kubernetes.ZtunnelConfigDump
}

func (c *kialiCacheImpl) SetZtunnelDump(ztunnelConfig map[string]*kubernetes.ZtunnelConfigDump) {
	c.ztunnelConfigStore.Replace(ztunnelConfig)
}

func (c *kialiCacheImpl) GetZtunnelDump(cluster, namespace, pod string) *kubernetes.ZtunnelConfigDump {
	key := ztunnelDumpKey(cluster, namespace, pod)
	config, found := c.ztunnelConfigStore.Get(key)
	if !found {
		return nil
	}
	return config
}
