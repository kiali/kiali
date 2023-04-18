package cache

import (
	"context"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type ProxyStatusCache interface {
	GetPodProxyStatus(cluster, namespace, pod string) *kubernetes.ProxyStatus
}

// pollIstiodForProxyStatus is a long running goroutine that will periodically poll istiod for proxy status.
// Polling stops when the stopCacheChan is closed.
func (c *kialiCacheImpl) pollIstiodForProxyStatus(ctx context.Context) {
	log.Debug("[Kiali Cache] Starting polling istiod for proxy status")
	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Debug("[Kiali Cache] Stopping polling for istiod proxy status")
				return
			case <-time.After(c.tokenNamespaceDuration):
				// Get the proxy status from istiod with some retries.
				// Wrapping this so we can defer cancel.
				func() {
					ctx, cancel := context.WithTimeout(ctx, c.tokenNamespaceDuration)
					defer cancel()

					var (
						proxyStatus []*kubernetes.ProxyStatus
						err         error
					)

					interval := c.tokenNamespaceDuration / 2
					retryErr := wait.PollImmediateUntilWithContext(ctx, interval, func(ctx context.Context) (bool, error) {
						log.Trace("Getting proxy status from istiod")
						proxyStatus, err = c.clientFactory.GetSAHomeClusterClient().GetProxyStatus()
						if err != nil {
							// TODO: Error checking could be done here to determine retry if GetProxyStatus provided that info.
							return false, nil
						}

						return true, nil
					})
					if retryErr != nil {
						log.Warningf("Error getting proxy status from istiod. Proxy status may be stale. Err: %v", err)
						return
					}

					c.setProxyStatus(proxyStatus)
				}()
			}
		}
	}()
}

func (c *kialiCacheImpl) GetPodProxyStatus(cluster, namespace, pod string) *kubernetes.ProxyStatus {
	defer c.proxyStatusLock.RUnlock()
	c.proxyStatusLock.RLock()
	if clusterProxyStatus, ok := c.proxyStatusNamespaces[cluster]; ok {
		if nsProxyStatus, ok := clusterProxyStatus[namespace]; ok {
			if podProxyStatus, ok := nsProxyStatus[pod]; ok {
				return podProxyStatus.proxyStatus
			}
		}
	}
	return nil
}

func (c *kialiCacheImpl) setProxyStatus(proxyStatus []*kubernetes.ProxyStatus) {
	defer c.proxyStatusLock.Unlock()
	c.proxyStatusLock.Lock()
	if len(proxyStatus) > 0 {
		for _, ps := range proxyStatus {
			if ps != nil {
				// Expected format <pod-name>.<namespace>
				// "proxy": "control-7bcc64d69d-qzsdk.travel-control"
				podId := strings.Split(ps.ProxyID, ".")
				if len(podId) == 2 {
					pod := podId[0]
					ns := podId[1]
					cluster := ps.ClusterID
					if _, exist := c.proxyStatusNamespaces[cluster]; !exist {
						c.proxyStatusNamespaces[cluster] = make(map[string]map[string]podProxyStatus)
					}
					if _, exist := c.proxyStatusNamespaces[cluster][ns]; !exist {
						c.proxyStatusNamespaces[cluster][ns] = make(map[string]podProxyStatus)
					}
					c.proxyStatusNamespaces[cluster][ns][pod] = podProxyStatus{
						cluster:     cluster,
						namespace:   ns,
						pod:         pod,
						proxyStatus: ps,
					}
				}
			}
		}
	}
}
