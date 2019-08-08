package destinationrules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NamespaceWideMTLSChecker struct {
	DestinationRule kubernetes.IstioObject
	MTLSDetails     kubernetes.MTLSDetails
}

func (m NamespaceWideMTLSChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// if DestinationRule doesn't enable mTLS, stop validation with any check
	if enabled, _ := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(m.DestinationRule.GetObjectMeta().Namespace, m.DestinationRule); !enabled {
		return validations, true
	}

	// otherwise, check among Policies for a rule enabling ns-wide mTLS
	for _, mp := range m.MTLSDetails.Policies {
		if enabled, _ := kubernetes.PolicyHasMTLSEnabled(mp); enabled {
			return validations, true
		}
	}

	// In case any Policy enables mTLS, check among MeshPolicies for a rule enabling it
	// ServiceMeshPolicies are a clone of MeshPolicies but used in Maistra scenarios
	// MeshPolicies and ServiceMeshPolicies won't co-exist, only ony array will be populated
	mPolicies := m.MTLSDetails.MeshPolicies
	if m.MTLSDetails.ServiceMeshPolicies != nil {
		mPolicies = m.MTLSDetails.ServiceMeshPolicies
	}
	for _, mp := range mPolicies {
		if enabled, _ := kubernetes.PolicyHasMTLSEnabled(mp); enabled {
			return validations, true
		}
	}

	check := models.Build("destinationrules.mtls.nspolicymissing", "spec/trafficPolicy/tls/mode")
	validations = append(validations, &check)

	return validations, false
}
