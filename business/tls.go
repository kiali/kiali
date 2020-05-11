package business

import (
	"sync"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

type TLSService struct {
	k8s             kubernetes.IstioClientInterface
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
	var drp = true
	var paErr, drErr error

	pap, paErr := in.hasMeshPeerAuthnEnabled()
	if paErr != nil {
		return models.MTLSStatus{}, paErr
	}

	if !in.hasAutoMTLSEnabled() {
		drp, drErr = in.hasDestinationRuleEnabled(namespaces)
		if drErr != nil {
			return models.MTLSStatus{}, drErr
		}
	}

	finalStatus := MTLSNotEnabled
	if drp && pap {
		finalStatus = MTLSEnabled
	} else if drp || pap {
		if !in.hasAutoMTLSEnabled() {
			finalStatus = MTLSPartiallyEnabled
		}
	}

	return models.MTLSStatus{
		Status: finalStatus,
	}, nil
}

func (in *TLSService) hasMeshPeerAuthnEnabled() (bool, error) {
	var mps []kubernetes.IstioObject
	var err error
	if !in.k8s.IsMaistraApi() {
		if mps, err = in.k8s.GetPeerAuthentications(config.Get().IstioNamespace); err != nil {
			return false, nil
		}
	} else {
		// ServiceMeshPolicies are namespace scoped.
		// And Maistra will only consider resources under control-plane namespace
		// https://github.com/Maistra/istio/pull/39/files#diff-e3109392080297ee093b7189648289e1R40
		// see https://github.com/Maistra/istio/blob/maistra-1.0/pilot/pkg/model/config.go#L958
		// see https://github.com/Maistra/istio/blob/maistra-1.0/pilot/pkg/model/config.go#L990
		// note - Maistra does not allow Istio multi-namespace deployment, use the single Istio namespace.
		controlPlaneNs := config.Get().IstioNamespace
		if mps, err = in.k8s.GetServiceMeshPolicies(controlPlaneNs); err != nil {
			// This query can return false if user can't access to controlPlaneNs
			// On this case we log internally the error but we return a false with nil
			log.Warningf("GetServiceMeshPolicies failed during a TLS validation. Probably user can't access to %s namespace. Error: %s", controlPlaneNs, err)
			return false, nil
		}
	}

	for _, mp := range mps {
		if strictMode := kubernetes.PeerAuthnHasStrictMTLS(mp); strictMode {
			return true, nil
		}
	}

	return false, nil
}

func (in *TLSService) hasDestinationRuleEnabled(namespaces []string) (bool, error) {
	drs, err := in.getAllDestinationRules(namespaces)
	if err != nil {
		return false, err
	}

	for _, dr := range drs {
		if enabled, _ := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); enabled {
			return true, nil
		}
	}

	return false, nil
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
			if kialiCache != nil && kialiCache.CheckIstioResource(kubernetes.DestinationRuleType) && kialiCache.CheckNamespace(ns) {
				drs, err = kialiCache.GetIstioResources(kubernetes.DestinationRuleType, ns)
			} else {
				drs, err = in.k8s.GetDestinationRules(ns, "")
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
	var plMode, drMode string
	var pErr, dErr error

	plMode, pErr = in.hasPeerAuthnNamespacemTLSDefinition(namespace)
	if pErr != nil {
		return models.MTLSStatus{}, pErr
	}

	drMode, dErr = in.hasDesinationRuleEnablingNamespacemTLS(namespace)
	if dErr != nil {
		return models.MTLSStatus{}, dErr
	}

	return models.MTLSStatus{
		Status: in.finalStatus(drMode, plMode),
	}, nil
}

func (in TLSService) hasPeerAuthnNamespacemTLSDefinition(namespace string) (string, error) {
	// PeerAuthn at istio control plane level, are considered mesh-wide objects
	if namespace == config.Get().IstioNamespace {
		return "", nil
	}

	ps, err := in.k8s.GetPeerAuthentications(namespace)
	if err != nil {
		return "", err
	}

	for _, p := range ps {
		if enabled, mode := kubernetes.PeerAuthnHasMTLSEnabled(p); enabled {
			return mode, nil
		}
	}

	return "", nil
}

func (in TLSService) hasDesinationRuleEnablingNamespacemTLS(namespace string) (string, error) {
	nss, nssErr := in.businessLayer.Namespace.GetNamespaces()
	if nssErr != nil {
		return "", nssErr
	}

	nsNames := make([]string, 0)
	for _, ns := range nss {
		nsNames = append(nsNames, ns.Name)
	}

	drs, nssErr := in.getAllDestinationRules(nsNames)
	if nssErr != nil {
		return "", nssErr
	}

	for _, dr := range drs {
		if _, mode := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(namespace, dr); mode != "" {
			return mode, nil
		}
	}

	return "", nil
}

func (in TLSService) finalStatus(drStatus string, paStatus string) string {
	var status string
	if in.hasAutoMTLSEnabled() {
		status = finalStatusAutoMTLSEnabled(drStatus, paStatus)
	} else {
		status = finalStatusAutoMTLSDisabled(drStatus, paStatus)
	}
	return status
}

func finalStatusAutoMTLSEnabled(drStatus, paStatus string) string {
	finalStatus := MTLSPartiallyEnabled

	if paStatus == "STRICT" || paStatus == "PERMISSIVE" {
		finalStatus = MTLSEnabled

		if drStatus == "SIMPLE" || drStatus == "DISABLE" {
			finalStatus = MTLSDisabled
		}
	} else if paStatus == "DISABLE" {
		finalStatus = MTLSDisabled

		if drStatus == "ISTIO_MUTUAL" || drStatus == "MUTUAL" || drStatus == "" {
			finalStatus = MTLSPartiallyEnabled
		}
	} else if paStatus == "" && drStatus == "" {
		finalStatus = MTLSNotEnabled
	}

	return finalStatus
}

func finalStatusAutoMTLSDisabled(drStatus, paStatus string) string {
	finalStatus := MTLSPartiallyEnabled

	if paStatus == "STRICT" && drStatus == "ISTIO_MUTUAL" {
		finalStatus = MTLSEnabled
	} else if (paStatus == "DISABLE" || paStatus == "PERMISSIVE") && (drStatus == "DISABLE" || drStatus == "SIMPLE") {
		finalStatus = MTLSDisabled
	} else if drStatus == "" && paStatus == "" {
		finalStatus = MTLSNotEnabled
	}

	return finalStatus
}

func (in TLSService) hasAutoMTLSEnabled() bool {
	if in.enabledAutoMtls != nil {
		return *in.enabledAutoMtls
	}

	mc, err := in.k8s.GetIstioConfigMap()
	if err != nil {
		return true
	}

	return mc.EnableAutoMtls
}
