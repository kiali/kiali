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
)

func (in *TLSService) MeshWidemTLSStatus(namespaces []string) (string, error) {
	mpp, mpErr := in.hasMeshPolicyEnabled(namespaces)
	if mpErr != nil {
		return "", mpErr
	}

	drp, drErr := in.hasDestinationRuleEnabled(namespaces)
	if drErr != nil {
		return "", drErr
	}

	if drp && mpp {
		return MTLSEnabled, nil
	} else if drp || mpp {
		return MTLSPartiallyEnabled, nil
	}

	return MTLSNotEnabled, nil
}

func (in *TLSService) hasMeshPolicyEnabled(namespaces []string) (bool, error) {
	if len(namespaces) < 1 {
		return false, fmt.Errorf("Can't find MeshPolicies without a namespace")
	}

	// MeshPolicies are not namespaced. So any namespace user has access to
	// will work to retrieve all the MeshPolicies.
	mps, err := in.k8s.GetMeshPolicies(namespaces[0])
	if err != nil {
		return false, err
	}

	for _, mp := range mps {
		if kubernetes.MeshPolicyHasMTLSEnabled(mp) {
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
		if kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr) {
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
	pl, pErr := in.hasPolicyEnablingNamespacemTLS(namespace)
	if pErr != nil {
		return models.MTLSStatus{}, pErr
	}

	dr, dErr := in.hasDesinationRuleEnablingNamespacemTLS(namespace)
	if dErr != nil {
		return models.MTLSStatus{}, dErr
	}

	status := MTLSNotEnabled
	if pl && dr {
		status = MTLSEnabled
	} else if pl || dr {
		status = MTLSPartiallyEnabled
	}

	return models.MTLSStatus{
		Status: status,
	}, nil
}

func (in TLSService) hasPolicyEnablingNamespacemTLS(namespace string) (bool, error) {
	ps, err := in.k8s.GetPolicies(namespace)
	if err != nil {
		return false, err
	}

	for _, p := range ps {
		if kubernetes.PolicyHasMTLSEnabled(p) {
			return true, nil
		}
	}

	return false, nil
}

func (in TLSService) hasDesinationRuleEnablingNamespacemTLS(namespace string) (bool, error) {
	nss, nssErr := in.businessLayer.Namespace.GetNamespaces()
	if nssErr != nil {
		return false, nssErr
	}

	nsNames := make([]string, 0, 0)
	for _, ns := range nss {
		nsNames = append(nsNames, ns.Name)
	}

	drs, nssErr := in.getAllDestinationRules(nsNames)
	if nssErr != nil {
		return false, nssErr
	}

	for _, dr := range drs {
		if kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(namespace, dr) {
			return true, nil
		}
	}

	return false, nil
}
