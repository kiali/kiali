package business

import (
	"fmt"
	"sync"

	"github.com/kiali/kiali/kubernetes"
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
	mpp, mpErr := in.hasMeshPolicyEnabled(namespaces)
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

func (in *TLSService) hasMeshPolicyEnabled(namespaces []string) (bool, error) {
	if len(namespaces) < 1 {
		return false, fmt.Errorf("Unable to determine mesh-wide mTLS status without access to any namespace")
	}

	// MeshPolicies are not namespaced. So any namespace user has access to
	// will work to retrieve all the MeshPolicies.
	mps, err := in.k8s.GetMeshPolicies(namespaces[0])
	if err != nil {
		return false, err
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
