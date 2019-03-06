package business

import (
	"fmt"
	"sync"

	"github.com/kiali/kiali/kubernetes"
)

type TLSService struct {
	k8s kubernetes.IstioClientInterface
}

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
		return MeshmTLSEnabled, nil
	} else if drp || mpp {
		return MeshmTLSPartiallyEnabled, nil
	}

	return MeshmTLSNotEnabled, nil
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

func (in TLSService) NamespaceWidemTLSStatus(namespace string) (string, error) {
	return "ENABLED", nil
}
