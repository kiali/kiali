package cache

import (
	"encoding/json"
	"fmt"

	"github.com/kiali/kiali/kubernetes"
)

func ztunnelDumpKey(cluster, namespace, pod string) string {
	return cluster + namespace + pod
}

type ZtunnelDumpCache interface {
	SetZtunnelDump(ztunnelConfig map[string]*kubernetes.ZtunnelConfigDump)
	GetAllZtunnelDump() map[string]*kubernetes.ZtunnelConfigDump
	GetZtunnelDump(cluster, namespace, pod string) *kubernetes.ZtunnelConfigDump
}

func (c *kialiCacheImpl) GetAllZtunnelDump() map[string]*kubernetes.ZtunnelConfigDump {
	return c.ztunnelConfigStore.Items()
}

func (c *kialiCacheImpl) SetZtunnelDump(ztunnelConfig map[string]*kubernetes.ZtunnelConfigDump) {
	c.ztunnelConfigStore.Replace(ztunnelConfig)
}

func (c *kialiCacheImpl) GetZtunnelDump(cluster, namespace, pod string) *kubernetes.ZtunnelConfigDump {
	key := ztunnelDumpKey(cluster, namespace, pod)
	config, found := c.ztunnelConfigStore.Get(key)
	if !found {
		if c.IsAmbientEnabled(cluster) {

			ztunnelPods := c.GetZtunnelPods(cluster)
			if len(ztunnelPods) > 0 {
				client, err := c.GetKubeCache(cluster)
				if err != nil {
					klog.Errorf("[GetZtunnelDump] Error getting kubecache for cluster %s: %v", cluster, err)
				} else {
					for _, zPod := range ztunnelPods {
						if zPod.Name == pod {
							resp, err := client.Client().ForwardGetRequest(zPod.Namespace, zPod.Name, 15000, "/config_dump")
							if err != nil {
								klog.Errorf("[GetZtunnelDump] Error forwarding the /config_dump request: %v", err)
								continue
							}
							configDump := &kubernetes.ZtunnelConfigDump{}
							err = json.Unmarshal(resp, configDump)
							if err != nil {
								klog.Errorf("[GetZtunnelDump] Error Unmarshalling the config_dump: %v", err)
							} else {
								key := fmt.Sprintf("%s%s%s", client.Client().ClusterInfo().Name, zPod.Namespace, zPod.Name)
								zTunnelConfigStore := c.GetAllZtunnelDump()
								zTunnelConfigStore[key] = configDump
								c.SetZtunnelDump(zTunnelConfigStore)
								return configDump
							}
						}
					}
				}
			}
		}
	}
	return config
}
