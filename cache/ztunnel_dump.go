package cache

import (
	"encoding/json"

	"github.com/kiali/kiali/kubernetes"
)

func ztunnelDumpKey(cluster, namespace, pod string) string {
	return cluster + namespace + pod
}

type ZtunnelDumpCache interface {
	SetZtunnelDump(key string, config *kubernetes.ZtunnelConfigDump)
	GetZtunnelDump(cluster, namespace, pod string) *kubernetes.ZtunnelConfigDump
}

func (c *kialiCacheImpl) SetZtunnelDump(key string, config *kubernetes.ZtunnelConfigDump) {
	c.ztunnelConfigStore.Set(key, config)
}

func (c *kialiCacheImpl) GetZtunnelDump(cluster, namespace, pod string) *kubernetes.ZtunnelConfigDump {
	key := ztunnelDumpKey(cluster, namespace, pod)

	config, found := c.ztunnelConfigStore.Get(key)
	if found {
		return config
	}

	if !c.IsAmbientEnabled(cluster) {
		return nil
	}

	ztunnelPods := c.GetZtunnelPods(cluster)
	if len(ztunnelPods) <= 0 {
		return nil
	}

	zl := c.zl
	client, found := c.clients[cluster]
	if !found {
		zl.Error().Msgf("[GetZtunnelDump] Kiali Service Account client not found for cluster [%s]", cluster)
		return nil
	}

	for _, zPod := range ztunnelPods {
		if zPod.Name == pod {
			resp, err := client.ForwardGetRequest(zPod.Namespace, zPod.Name, 15000, "/config_dump")
			if err != nil {
				zl.Error().Msgf("[GetZtunnelDump] Error forwarding the /config_dump request: %v", err)
				return nil
			}
			var configDump *kubernetes.ZtunnelConfigDump
			if err := json.Unmarshal(resp, &configDump); err != nil {
				zl.Error().Msgf("[GetZtunnelDump] Error Unmarshalling the config_dump: %v", err)
				return nil
			}

			c.SetZtunnelDump(key, configDump)
			return configDump
		}
	}

	return nil
}
