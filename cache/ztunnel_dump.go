package cache

import (
	"encoding/json"

	"github.com/kiali/kiali/kubernetes"
)

// ztunnelDumpKey builds the cache key for a ztunnel config dump. The ztunnel pod is
// matched by name cluster-wide (ztunnel pod names carry random suffixes, so
// cross-namespace name collisions are not a practical concern), so the key is just
// the cluster and the pod name. Do not include the caller-supplied namespace in the
// key: callers legitimately pass different namespaces (e.g. a workload's tenant
// namespace) for the same ztunnel pod, which would cache the same dump N times.
func ztunnelDumpKey(cluster, pod string) string {
	return cluster + pod
}

type ZtunnelDumpCache interface {
	SetZtunnelDump(key string, config *kubernetes.ZtunnelConfigDump)
	GetZtunnelDump(cluster, pod string) *kubernetes.ZtunnelConfigDump
}

func (c *kialiCacheImpl) SetZtunnelDump(key string, config *kubernetes.ZtunnelConfigDump) {
	c.ztunnelConfigStore.Set(key, config)
}

func (c *kialiCacheImpl) GetZtunnelDump(cluster, pod string) *kubernetes.ZtunnelConfigDump {
	key := ztunnelDumpKey(cluster, pod)

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
