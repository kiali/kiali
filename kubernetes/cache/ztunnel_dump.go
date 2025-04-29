package cache

import (
	"encoding/json"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

func ztunnelDumpKey(cluster, namespace, pod string) string {
	return cluster + namespace + pod
}

type ZtunnelDumpCache interface {
	SetZtunnelDump(key string, config *kubernetes.ZtunnelConfigDump)
	GetZtunnelDump(cluster, namespace, pod string) *kubernetes.ZtunnelConfigDump
}

func (c *kialiCacheImpl) SetZtunnelDump(key string, config *kubernetes.ZtunnelConfigDump) {
	ztunnelItems := c.ztunnelConfigStore.Items()
	ztunnelItems[key] = config
	c.ztunnelConfigStore.Replace(ztunnelItems)
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

	client, err := c.GetKubeCache(cluster)
	if err != nil {
		log.Errorf("[GetZtunnelDump] Error getting kubecache for cluster %s: %v", cluster, err)
		return nil
	}

	for _, zPod := range ztunnelPods {
		if zPod.Name == pod {
			resp, err := client.Client().ForwardGetRequest(zPod.Namespace, zPod.Name, 15000, "/config_dump")
			if err != nil {
				log.Errorf("[GetZtunnelDump] Error forwarding the /config_dump request: %v", err)
				return nil
			}
			configDump := &kubernetes.ZtunnelConfigDump{}
			err = json.Unmarshal(resp, configDump)
			if err != nil {
				log.Errorf("[GetZtunnelDump] Error Unmarshalling the config_dump: %v", err)
				// Even not unmarshalling one field, others can be filled up
				// From Istio 1.25 -> 1.26, one of the fields changed its type
				// But still is able to return other data
				if configDump == nil {
					return nil
				}
			}

			c.SetZtunnelDump(key, configDump)
			return configDump
		}
	}
	log.Errorf("[GetZtunnelDump] Error Unmarshalling the config_dump: %v", err)
	return nil
}
