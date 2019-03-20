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
	for _, mp := range m.MTLSDetails.MeshPolicies {
		if enabled, _ := kubernetes.PolicyHasMTLSEnabled(mp); enabled {
			return validations, true
		}
	}

	check := models.Build("destinationrules.mtls.nspolicymissing", "spec/trafficPolicy/tls/mode")
	validations = append(validations, &check)

	return validations, false
}
