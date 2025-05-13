package business

import (
	"context"
	"fmt"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

func NewProxyStatusService(conf *config.Config, cache cache.KialiCache, kialiSAClients map[string]kubernetes.ClientInterface, namespace *NamespaceService) ProxyStatusService {
	return ProxyStatusService{
		conf:           conf,
		kialiCache:     cache,
		kialiSAClients: kialiSAClients,
		namespace:      namespace,
	}
}

type ProxyStatusService struct {
	conf           *config.Config
	kialiCache     cache.KialiCache
	kialiSAClients map[string]kubernetes.ClientInterface
	namespace      *NamespaceService
}

// GetPodProxyStatus isSubscribed is used to return IGNORED if sent is empty, instead of NOT_SENT
func (in *ProxyStatusService) GetPodProxyStatus(cluster, ns, pod string, isSubscribed bool) *models.ProxyStatus {
	return castProxyStatus(in.kialiCache.GetPodProxyStatus(cluster, ns, pod), isSubscribed)
}

// castProxyStatus returns a status string depending on the proxyStatus and whether the proxy is subscribed
// See https://github.com/istio/istio/pull/51638/files#diff-fded610aca2639111f0d6b42e18dfc1ce047126340a2d36bb976cfa4c575b984R8
func castProxyStatus(ps *kubernetes.ProxyStatus, isSubscribed bool) *models.ProxyStatus {
	if ps == nil {
		return nil
	}

	return &models.ProxyStatus{
		CDS: xdsStatus(ps.ClusterSent, ps.ClusterAcked, isSubscribed),
		EDS: xdsStatus(ps.EndpointSent, ps.EndpointAcked, isSubscribed),
		LDS: xdsStatus(ps.ListenerSent, ps.ListenerAcked, isSubscribed),
		RDS: xdsStatus(ps.RouteSent, ps.RouteAcked, isSubscribed),
	}
}

func xdsStatus(sent, acked string, isSubscribed bool) string {
	if sent == "" {
		if isSubscribed {
			return "NOT_SENT"
		}
		return "IGNORED"
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

func (in *ProxyStatusService) GetConfigDumpResourceEntries(ctx context.Context, cluster, namespace, pod, resource string) (*models.EnvoyProxyDump, error) {
	kialiSAClient, ok := in.kialiSAClients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster [%s] not found", cluster)
	}

	dump, err := kialiSAClient.GetConfigDump(namespace, pod)
	if err != nil {
		return nil, err
	}

	namespaces, err := in.namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		return nil, err
	}

	return buildDump(dump, resource, namespaces, in.conf)
}

func buildDump(dump *kubernetes.ConfigDump, resource string, namespaces []models.Namespace, conf *config.Config) (*models.EnvoyProxyDump, error) {
	response := &models.EnvoyProxyDump{}
	var err error

	nss := make([]string, len(namespaces))
	for _, ns := range namespaces {
		nss = append(nss, ns.Name)
	}

	switch resource {
	case "clusters":
		summary := &models.Clusters{}
		err = summary.Parse(dump, conf)
		response.Clusters = summary
	case "routes":
		summary := &models.Routes{}
		err = summary.Parse(dump, nss, conf)
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
