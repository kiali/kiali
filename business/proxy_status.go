package business

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type ProxyStatus struct {
	k8s kubernetes.ClientInterface
}

func (in *ProxyStatus) GetPodProxyStatus(ns, pod string) (*kubernetes.ProxyStatus, error) {
	if kialiCache != nil {
		if !kialiCache.CheckProxyStatus() {
			var proxyStatus []*kubernetes.ProxyStatus
			var err error
			proxyStatus, err = in.k8s.GetProxyStatus()
			if err != nil {
				if proxyStatus, err = in.getProxyStatusUsingKialiSA(); err != nil {
					return &kubernetes.ProxyStatus{}, err
				}
			}
			if err == nil {
				kialiCache.SetProxyStatus(proxyStatus)
			} else {
				return &kubernetes.ProxyStatus{}, err
			}
		}
		return kialiCache.GetPodProxyStatus(ns, pod), nil
	}

	return &kubernetes.ProxyStatus{}, nil
}

func (in *ProxyStatus) getProxyStatusUsingKialiSA() ([]*kubernetes.ProxyStatus, error) {
	clientFactory, err := kubernetes.GetClientFactory()
	if err != nil {
		return nil, err
	}

	kialiToken, err := kubernetes.GetKialiToken()
	if err != nil {
		return nil, err
	}

	k8s, err := clientFactory.GetClient(kialiToken)
	if err != nil {
		return nil, err
	}

	return k8s.GetProxyStatus()
}

func castProxyStatus(ps kubernetes.ProxyStatus) *models.ProxyStatus {
	return &models.ProxyStatus{
		CDS: xdsStatus(ps.ClusterSent, ps.ClusterAcked),
		EDS: xdsStatus(ps.EndpointSent, ps.EndpointAcked),
		LDS: xdsStatus(ps.ListenerSent, ps.ListenerAcked),
		RDS: xdsStatus(ps.RouteSent, ps.RouteAcked),
	}
}

func xdsStatus(sent, acked string) string {
	if sent == "" {
		return "NOT_SENT"
	}
	if sent == acked {
		return "Synced"
	}
	// acked will be empty string when there is never Acknowledged
	if acked == "" {
		return "Stale (Never Acknowledged)"
	}
	// Since the Nonce changes to uuid, so there is no more any time diff info
	return "Stale"
}

func (in *ProxyStatus) GetConfigDump(namespace, pod string) (models.EnvoyProxyDump, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ProxyStatus", "GetConfigDump")
	defer promtimer.ObserveNow(&err)

	dump, err := in.k8s.GetConfigDump(namespace, pod)
	return models.EnvoyProxyDump{ConfigDump: dump}, err
}

func (in *ProxyStatus) GetConfigDumpResourceEntries(namespace, pod, resource string) (models.ResourceDump, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ProxyStatus", "GetConfigDump")
	defer promtimer.ObserveNow(&err)

	dump, err := in.k8s.GetConfigDump(namespace, pod)
	if err != nil {
		return nil, err
	}

	return buildDump(dump, resource)
}

func buildDump(dump *kubernetes.ConfigDump, resource string) (models.ResourceDump, error) {
	var summary models.ResourceDump
	var err error
	switch resource {
	case "clusters":
		summary = &models.Clusters{}
		err = summary.Parse(dump)
	case "routes":
		summary = &models.Routes{}
		err = summary.Parse(dump)
	case "bootstrap":
		summary = &models.Bootstrap{}
		err = summary.Parse(dump)
	case "listeners":
		summary = &models.Listeners{}
		err = summary.Parse(dump)
	}

	return summary, err
}
