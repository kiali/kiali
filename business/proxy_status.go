package business

import (
	"context"
	"fmt"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/models"
)

type ProxyStatusService struct {
	kialiCache     cache.KialiCache
	kialiSAClients map[string]kubernetes.ClientInterface
	businessLayer  *Layer
}

func (in *ProxyStatusService) GetPodProxyStatus(cluster, ns, pod string) *models.ProxyStatus {
	return castProxyStatus(kialiCache.GetPodProxyStatus(cluster, ns, pod))
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

func (in *ProxyStatusService) GetConfigDump(cluster, namespace, pod string) (models.EnvoyProxyDump, error) {
	kialiSAClient, ok := in.kialiSAClients[cluster]
	if !ok {
		return models.EnvoyProxyDump{}, fmt.Errorf("cluster [%s] not found", cluster)
	}

	dump, err := kialiSAClient.GetConfigDump(namespace, pod)
	return models.EnvoyProxyDump{ConfigDump: dump}, err
}

func (in *ProxyStatusService) GetZtunnelConfigDump(cluster, namespace, pod string) (kubernetes.ZtunnelConfigDump, error) {
	kialiSAClient, ok := in.kialiSAClients[cluster]
	if !ok {
		return kubernetes.ZtunnelConfigDump{}, fmt.Errorf("cluster [%s] not found", cluster)
	}

	dump, err := kialiSAClient.GetZtunnelConfigDump(namespace, pod)
	return *dump, err
}

func (in *ProxyStatusService) GetConfigDumpResourceEntries(cluster, namespace, pod, resource string) (*models.EnvoyProxyDump, error) {
	kialiSAClient, ok := in.kialiSAClients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster [%s] not found", cluster)
	}

	dump, err := kialiSAClient.GetConfigDump(namespace, pod)
	if err != nil {
		return nil, err
	}

	namespaces, err := in.businessLayer.Namespace.GetClusterNamespaces(context.TODO(), cluster)
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
