package business

import (
	"sync"

	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
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

func (in *TLSService) MeshWidemTLSStatus(namespaces []string) (models.MTLSStatus, error) {
	pas, error := in.getMeshPeerAuthentications()
	if error != nil {
		return models.MTLSStatus{}, error
	}

	drs, error := in.getAllDestinationRules(namespaces)
	if error != nil {
		return models.MTLSStatus{}, error
	}

	mtlsStatus := mtls.MtlsStatus{
		PeerAuthentications: pas,
		DestinationRules:    drs,
		AutoMtlsEnabled:     in.hasAutoMTLSEnabled(),
		AllowPermissive:     false,
	}

	return models.MTLSStatus{
		Status: mtlsStatus.MeshMtlsStatus().OverallStatus,
	}, nil
}

func (in *TLSService) getMeshPeerAuthentications() ([]kubernetes.IstioObject, error) {
	var mps []kubernetes.IstioObject
	var err error
	controlPlaneNs := config.Get().IstioNamespace
	if IsResourceCached(controlPlaneNs, kubernetes.PeerAuthentications) {
		mps, err = kialiCache.GetIstioObjects(controlPlaneNs, kubernetes.PeerAuthentications, "")
	} else {
		mps, err = in.k8s.GetIstioObjects(controlPlaneNs, kubernetes.PeerAuthentications, "")
	}
	return mps, err
}

func (in *TLSService) getAllDestinationRules(namespaces []string) ([]kubernetes.IstioObject, error) {
	drChan := make(chan []kubernetes.IstioObject, len(namespaces))
	errChan := make(chan error, 1)
	wg := sync.WaitGroup{}

	wg.Add(len(namespaces))

	for _, namespace := range namespaces {
		go func(ns string) {
			defer wg.Done()
			var drs []kubernetes.IstioObject
			var err error
			// Check if namespace is cached
			// Namespace access is checked in the upper call
			if IsResourceCached(ns, kubernetes.DestinationRules) {
				drs, err = kialiCache.GetIstioObjects(ns, kubernetes.DestinationRules, "")
			} else {
				drs, err = in.k8s.GetIstioObjects(ns, kubernetes.DestinationRules, "")
			}
			if err != nil {
				errChan <- err
				return
			}

			drChan <- drs
		}(namespace)
	}

	wg.Wait()
	close(errChan)
	close(drChan)

	for err := range errChan {
		if err != nil {
			return nil, err
		}
	}

	allDestinationRules := make([]kubernetes.IstioObject, 0)
	for drs := range drChan {
		allDestinationRules = append(allDestinationRules, drs...)
	}

	return allDestinationRules, nil
}

func (in TLSService) NamespaceWidemTLSStatus(namespace string) (models.MTLSStatus, error) {
	pas, err := in.getPeerAuthentications(namespace)
	if err != nil {
		return models.MTLSStatus{}, nil
	}

	nss, err := in.getNamespaces()
	if err != nil {
		return models.MTLSStatus{}, nil
	}

	drs, err := in.getAllDestinationRules(nss)
	if err != nil {
		return models.MTLSStatus{}, nil
	}

	mtlsStatus := mtls.MtlsStatus{
		Namespace:           namespace,
		PeerAuthentications: pas,
		DestinationRules:    drs,
		AutoMtlsEnabled:     in.hasAutoMTLSEnabled(),
		AllowPermissive:     false,
	}

	return models.MTLSStatus{
		Status: mtlsStatus.NamespaceMtlsStatus().OverallStatus,
	}, nil
}

func (in TLSService) getPeerAuthentications(namespace string) ([]kubernetes.IstioObject, error) {
	if namespace == config.Get().IstioNamespace {
		return []kubernetes.IstioObject{}, nil
	}
	if IsResourceCached(namespace, kubernetes.PeerAuthentications) {
		return kialiCache.GetIstioObjects(namespace, kubernetes.PeerAuthentications, "")
	} else {
		return in.k8s.GetIstioObjects(namespace, kubernetes.PeerAuthentications, "")
	}
}

func (in TLSService) getNamespaces() ([]string, error) {
	nss, nssErr := in.businessLayer.Namespace.GetNamespaces()
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
