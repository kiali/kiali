package business

import (
	"sync"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

type TLSService struct {
	k8s           kubernetes.IstioClientInterface
	businessLayer *Layer
}

const (
	MTLSEnabled          = "MTLS_ENABLED"
	MTLSPartiallyEnabled = "MTLS_PARTIALLY_ENABLED"
	MTLSNotEnabled       = "MTLS_NOT_ENABLED"
	MTLSDisabled         = "MTLS_DISABLED"
)

func (in *TLSService) MeshWidemTLSStatus(namespaces []string) (models.MTLSStatus, error) {
	mpp, mpErr := in.hasMeshPolicyEnabled()
	if mpErr != nil {
		return models.MTLSStatus{}, mpErr
	}

	drp, drErr := in.hasDestinationRuleEnabled(namespaces)
	if drErr != nil {
		return models.MTLSStatus{}, drErr
	}

	finalStatus := MTLSNotEnabled
	if drp && mpp {
		finalStatus = MTLSEnabled
	} else if drp || mpp {
		finalStatus = MTLSPartiallyEnabled
	}

	return models.MTLSStatus{
		Status: finalStatus,
	}, nil
}

func (in *TLSService) hasMeshPolicyEnabled() (bool, error) {
	var mps []kubernetes.IstioObject
	var err error
	if !in.k8s.IsMaistraApi() {
		// MeshPolicies are not namespaced.
		// See KIALI-3223: Query MeshPolicies without namespace as this API doesn't work in the same way in AWS EKS
		mps, err = in.k8s.GetMeshPolicies()
		if err != nil {
			return false, err
		}
	} else {
		// ServiceMeshPolicies are namespace scoped.
		// And Maistra will only consider resources under control-plane namespace
		// https://github.com/Maistra/istio/pull/39/files#diff-e3109392080297ee093b7189648289e1R40
		// see https://github.com/Maistra/istio/blob/maistra-1.0/pilot/pkg/model/config.go#L958
		// see https://github.com/Maistra/istio/blob/maistra-1.0/pilot/pkg/model/config.go#L990
		// note - For Maistra we assume ServiceMeshPolicies are located in IstioNamespace (no
		//        multi-namespace Istio deployment)
		controlPlaneNs := config.Get().IstioNamespace
		if mps, err = in.k8s.GetServiceMeshPolicies(controlPlaneNs); err != nil {
			// This query can return false if user can't access to controlPlaneNs
			// On this case we log internally the error but we return a false with nil
			log.Warningf("GetServiceMeshPolicies failed during a TLS validation. Probably user can't access to this. Error: %s", err)
			return false, nil
		}
	}

	for _, mp := range mps {
		if strictMode := kubernetes.PolicyHasStrictMTLS(mp); strictMode {
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

			drs, err := in.k8s.GetDestinationRules(ns, "")
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
	plMode, pErr := in.hasPolicyNamespacemTLSDefinition(namespace)
	if pErr != nil {
		return models.MTLSStatus{}, pErr
	}

	drMode, dErr := in.hasDesinationRuleEnablingNamespacemTLS(namespace)
	if dErr != nil {
		return models.MTLSStatus{}, dErr
	}

	return models.MTLSStatus{
		Status: finalStatus(drMode, plMode),
	}, nil
}

func (in TLSService) hasPolicyNamespacemTLSDefinition(namespace string) (string, error) {
	ps, err := in.k8s.GetPolicies(namespace)
	if err != nil {
		return "", err
	}

	for _, p := range ps {
		if enabled, mode := kubernetes.PolicyHasMTLSEnabled(p); enabled {
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

func finalStatus(drStatus string, pStatus string) string {
	finalStatus := MTLSPartiallyEnabled

	if pStatus == "STRICT" && drStatus == "ISTIO_MUTUAL" {
		finalStatus = MTLSEnabled
	} else if pStatus == "PERMISSIVE" && (drStatus == "DISABLE" || drStatus == "SIMPLE") {
		finalStatus = MTLSDisabled
	} else if drStatus == "" && pStatus == "" {
		finalStatus = MTLSNotEnabled
	}

	return finalStatus
}
