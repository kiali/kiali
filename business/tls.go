package business

import (
	"context"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/mtls"
)

type TLSService struct {
	k8s             kubernetes.ClientInterface
	businessLayer   *Layer
	enabledAutoMtls *bool
}

const (
	MTLSEnabled          = "MTLS_ENABLED"
	MTLSPartiallyEnabled = "MTLS_PARTIALLY_ENABLED"
	MTLSNotEnabled       = "MTLS_NOT_ENABLED"
	MTLSDisabled         = "MTLS_DISABLED"
)

func (in *TLSService) MeshWidemTLSStatus(ctx context.Context, namespaces []string) (models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "MeshWidemTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute("namespaces", namespaces),
	)
	defer end()

	criteria := IstioConfigCriteria{
		AllNamespaces:              true,
		IncludeDestinationRules:    true,
		IncludePeerAuthentications: true,
	}
	// @TODO hardcoded HomeClusterName
	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigListPerCluster(ctx, criteria, kubernetes.HomeClusterName)
	if err != nil {
		return models.MTLSStatus{}, err
	}

	pas := kubernetes.FilterPeerAuthenticationByNamespace(config.Get().ExternalServices.Istio.RootNamespace, istioConfigList.PeerAuthentications)
	drs := kubernetes.FilterDestinationRulesByNamespaces(namespaces, istioConfigList.DestinationRules)

	mtlsStatus := mtls.MtlsStatus{
		PeerAuthentications: pas,
		DestinationRules:    drs,
		AutoMtlsEnabled:     in.hasAutoMTLSEnabled(),
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

func (in *TLSService) NamespaceWidemTLSStatus(ctx context.Context, namespace string) (models.MTLSStatus, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "NamespaceWidemTLSStatus",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
	)
	defer end()

	nss, err := in.getNamespaces(ctx)
	if err != nil {
		return models.MTLSStatus{}, nil
	}

	criteria := IstioConfigCriteria{
		AllNamespaces:              true,
		IncludeDestinationRules:    true,
		IncludePeerAuthentications: true,
	}
	// @TODO
	istioConfigList, err2 := in.businessLayer.IstioConfig.GetIstioConfigListPerCluster(ctx, criteria, kubernetes.HomeClusterName)
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
		AutoMtlsEnabled:     in.hasAutoMTLSEnabled(),
		AllowPermissive:     false,
	}

	return models.MTLSStatus{
		Status:          mtlsStatus.NamespaceMtlsStatus(namespace).OverallStatus,
		AutoMTLSEnabled: mtlsStatus.AutoMtlsEnabled,
	}, nil
}

// TODO refactor business/istio_validations.go
func (in *TLSService) GetAllDestinationRules(ctx context.Context, namespaces []string) ([]*networking_v1beta1.DestinationRule, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetAllDestinationRules",
		observability.Attribute("package", "business"),
		observability.Attribute("namespaces", namespaces),
	)
	defer end()

	criteria := IstioConfigCriteria{
		AllNamespaces:           true,
		IncludeDestinationRules: true,
	}

	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigListPerCluster(ctx, criteria, kubernetes.HomeClusterName)
	if err != nil {
		return nil, err
	}

	allDestinationRules := make([]*networking_v1beta1.DestinationRule, 0)
	for _, dr := range istioConfigList.DestinationRules {
		found := false
		for _, ns := range namespaces {
			if dr.Namespace == ns {
				found = true
				break
			}
		}
		if found {
			allDestinationRules = append(allDestinationRules, dr)
		}
	}
	return allDestinationRules, nil
}

func (in *TLSService) getNamespaces(ctx context.Context) ([]string, error) {
	nss, nssErr := in.businessLayer.Namespace.GetNamespaces(ctx)
	if nssErr != nil {
		return nil, nssErr
	}

	nsNames := make([]string, 0)
	for _, ns := range nss {
		nsNames = append(nsNames, ns.Name)
	}
	return nsNames, nil
}

func (in *TLSService) hasAutoMTLSEnabled() bool {
	if in.enabledAutoMtls != nil {
		return *in.enabledAutoMtls
	}

	cfg := config.Get()
	var istioConfig *core_v1.ConfigMap
	var err error
	if IsNamespaceCached(cfg.IstioNamespace) {
		istioConfig, err = kialiCache.GetConfigMap(cfg.IstioNamespace, cfg.ExternalServices.Istio.ConfigMapName)
	} else {
		istioConfig, err = in.k8s.GetConfigMap(cfg.IstioNamespace, cfg.ExternalServices.Istio.ConfigMapName)
	}
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
