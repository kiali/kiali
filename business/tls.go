package business

import (
	"context"

	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/mtls"
)

type TLSService struct {
	userClients     map[string]kubernetes.ClientInterface
	kialiCache      cache.KialiCache
	businessLayer   *Layer
	enabledAutoMtls *bool
}

const (
	MTLSEnabled          = "MTLS_ENABLED"
	MTLSPartiallyEnabled = "MTLS_PARTIALLY_ENABLED"
	MTLSNotEnabled       = "MTLS_NOT_ENABLED"
	MTLSDisabled         = "MTLS_DISABLED"
)

func (in *TLSService) MeshWidemTLSStatus(ctx context.Context, namespaces []string, cluster string) (models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "MeshWidemTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute("namespaces", namespaces),
		observability.Attribute("cluster", cluster),
	)
	defer end()

	criteria := IstioConfigCriteria{
		AllNamespaces:              true,
		Cluster:                    cluster,
		IncludeDestinationRules:    true,
		IncludePeerAuthentications: true,
	}
	conf := config.Get()

	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
	if err != nil {
		return models.MTLSStatus{}, err
	}

	pas := kubernetes.FilterPeerAuthenticationByNamespace(conf.ExternalServices.Istio.RootNamespace, istioConfigList.PeerAuthentications)
	drs := kubernetes.FilterDestinationRulesByNamespaces(namespaces, istioConfigList.DestinationRules)

	mtlsStatus := mtls.MtlsStatus{
		PeerAuthentications: pas,
		DestinationRules:    drs,
		AutoMtlsEnabled:     in.hasAutoMTLSEnabled(cluster),
		AllowPermissive:     false,
	}

	minTLS, err := in.businessLayer.IstioCerts.GetTlsMinVersion()
	if err != nil {
		log.Errorf("Error getting TLS min version: %s ", err)
	}

	return models.MTLSStatus{
		Status:          mtlsStatus.MeshMtlsStatus().OverallStatus,
		AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
		MinTLS:          minTLS,
	}, nil
}

func (in *TLSService) NamespaceWidemTLSStatus(ctx context.Context, namespace, cluster string) (models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "NamespaceWidemTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
	)
	defer end()

	nss, err := in.getNamespaces(ctx, cluster)
	if err != nil {
		return models.MTLSStatus{}, nil
	}

	criteria := IstioConfigCriteria{
		AllNamespaces:              true,
		Cluster:                    cluster,
		IncludeDestinationRules:    true,
		IncludePeerAuthentications: true,
	}

	istioConfigList, err2 := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
	if err2 != nil {
		return models.MTLSStatus{}, err2
	}

	pas := kubernetes.FilterPeerAuthenticationByNamespace(namespace, istioConfigList.PeerAuthentications)
	if config.IsRootNamespace(namespace) {
		pas = []*security_v1beta1.PeerAuthentication{}
	}
	drs := kubernetes.FilterDestinationRulesByNamespaces(nss, istioConfigList.DestinationRules)

	mtlsStatus := mtls.MtlsStatus{
		PeerAuthentications: pas,
		DestinationRules:    drs,
		AutoMtlsEnabled:     in.hasAutoMTLSEnabled(cluster),
		AllowPermissive:     false,
	}

	return models.MTLSStatus{
		Status:          mtlsStatus.NamespaceMtlsStatus(namespace).OverallStatus,
		AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
		Cluster:         cluster,
		Namespace:       namespace,
	}, nil
}

func (in *TLSService) ClusterWideNSmTLSStatus(ctx context.Context, nss []string, cluster string) ([]models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "ClusterWideNSmTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
	)
	defer end()

	result := []models.MTLSStatus{}

	allNamespaces, err := in.getNamespaces(ctx, cluster)
	if err != nil {
		return result, nil
	}

	criteria := IstioConfigCriteria{
		AllNamespaces:              true,
		Cluster:                    cluster,
		IncludeDestinationRules:    true,
		IncludePeerAuthentications: true,
	}

	istioConfigList, err2 := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
	if err2 != nil {
		return result, err2
	}

	for _, namespace := range nss {
		pas := kubernetes.FilterPeerAuthenticationByNamespace(namespace, istioConfigList.PeerAuthentications)
		if config.IsRootNamespace(namespace) {
			pas = []*security_v1beta1.PeerAuthentication{}
		}
		drs := kubernetes.FilterDestinationRulesByNamespaces(allNamespaces, istioConfigList.DestinationRules)

		mtlsStatus := mtls.MtlsStatus{
			PeerAuthentications: pas,
			DestinationRules:    drs,
			AutoMtlsEnabled:     in.hasAutoMTLSEnabled(cluster),
			AllowPermissive:     false,
		}

		result = append(result, models.MTLSStatus{
			Status:          mtlsStatus.NamespaceMtlsStatus(namespace).OverallStatus,
			AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
			Cluster:         cluster,
			Namespace:       namespace,
		})
	}
	return result, nil
}

func (in *TLSService) getNamespaces(ctx context.Context, cluster string) ([]string, error) {
	nss, nssErr := in.businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
	if nssErr != nil {
		return nil, nssErr
	}

	nsNames := make([]string, 0)
	for _, ns := range nss {
		nsNames = append(nsNames, ns.Name)
	}
	return nsNames, nil
}

func (in *TLSService) hasAutoMTLSEnabled(cluster string) bool {
	if in.enabledAutoMtls != nil {
		return *in.enabledAutoMtls
	}

	kubeCache := in.kialiCache.GetKubeCaches()[cluster]
	if kubeCache == nil {
		return true
	}

	cfg := config.Get()
	istioConfig, err := kubeCache.GetConfigMap(cfg.IstioNamespace, IstioConfigMapName(*cfg, ""))
	if err != nil {
		return true
	}

	mc, err := kubernetes.GetIstioConfigMap(istioConfig)
	if err != nil {
		return true
	}
	autoMtls := mc.GetEnableAutoMtls()
	in.enabledAutoMtls = &autoMtls
	return autoMtls
}
