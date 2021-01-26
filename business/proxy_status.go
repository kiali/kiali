package business

import (
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type ProxyStatus struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

func (in *ProxyStatus) GetPodProxyStatus(ns, pod string) (*kubernetes.ProxyStatus, error) {
	if kialiCache == nil {
		return nil, nil
	}

	if kialiCache.CheckProxyStatus() {
		return kialiCache.GetPodProxyStatus(ns, pod), nil
	}

	var proxyStatus []*kubernetes.ProxyStatus
	var err error

	if proxyStatus, err = in.k8s.GetProxyStatus(); err != nil {
		if proxyStatus, err = in.getProxyStatusUsingKialiSA(); err != nil {
			return nil, err
		}
	}

	kialiCache.SetProxyStatus(proxyStatus)
	return kialiCache.GetPodProxyStatus(ns, pod), nil
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

	k8s, err := clientFactory.GetClient(&api.AuthInfo{Token: kialiToken})
	if err != nil {
		return nil, err
	}

	return k8s.GetProxyStatus()
}

func castProxyStatus(ps *kubernetes.ProxyStatus) *models.ProxyStatus {
	if ps == nil {
		return nil
	}

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

func (in *ProxyStatus) GetConfigDumpResourceEntries(namespace, pod, resource string) (*models.EnvoyProxyDump, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ProxyStatus", "GetConfigDump")
	defer promtimer.ObserveNow(&err)

	dump, err := in.k8s.GetConfigDump(namespace, pod)
	if err != nil {
		return nil, err
	}

	namespaces, err := in.businessLayer.Namespace.GetNamespaces()
	if err != nil {
		return nil, err
	}

	return buildDump(dump, resource, namespaces)
}

func buildDump(dump *kubernetes.ConfigDump, resource string, namespaces []models.Namespace) (*models.EnvoyProxyDump, error) {
	response := &models.EnvoyProxyDump{}
	var err error

	nss := make([]string, len(namespaces))
	for _, ns := range namespaces {
		nss = append(nss, ns.Name)
	}

	switch resource {
	case "clusters":
		summary := &models.Clusters{}
		err = summary.Parse(dump)
		response.Clusters = summary
	case "routes":
		summary := &models.Routes{}
		err = summary.Parse(dump, nss)
		response.Routes = summary
	case "bootstrap":
		summary := &models.Bootstrap{}
		err = summary.Parse(dump)
		response.Bootstrap = summary
	case "listeners":
		summary := &models.Listeners{}
		err = summary.Parse(dump)
		response.Listeners = summary
	}

	return response, err
}
