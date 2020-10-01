package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type ProxyStatus struct {
	k8s kubernetes.ClientInterface
}

func (in *ProxyStatus) GetPodProxyStatus(ns, pod string) (*kubernetes.ProxyStatus, error) {
	if kialiCache != nil {
		if !kialiCache.CheckProxyStatus() {
			if proxyStatus, err := in.k8s.GetProxyStatus(); err == nil {
				kialiCache.SetProxyStatus(proxyStatus)
			} else {
				return &kubernetes.ProxyStatus{}, err
			}
		}
		return kialiCache.GetPodProxyStatus(ns, pod), nil
	}

	return &kubernetes.ProxyStatus{}, nil
}

func castProxyStatus(ps kubernetes.ProxyStatus) models.ProxyStatus {
	return models.ProxyStatus{
		CDS: xdsStatus(ps.ClusterSent, ps.ClusterAcked),
		EDS: xdsStatus(ps.EndpointSent, ps.EndpointAcked),
		LDS: xdsStatus(ps.ListenerSent, ps.ListenerAcked),
		RDS: xdsStatus(ps.RouteSent, ps.RouteAcked),
	}
}

func xdsStatus(sent, acked string) models.ProxyStatuses {
	if sent == "" {
		return models.NotSent
	}
	if sent == acked {
		return models.Synced
	}
	// acked will be empty string when there is never Acknowledged
	if acked == "" {
		return models.StaleNa
	}
	// Since the Nonce changes to uuid, so there is no more any time diff info
	return models.Stale
}
