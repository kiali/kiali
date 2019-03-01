package destinationrules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type MeshWideMTLSChecker struct {
	DestinationRule kubernetes.IstioObject
	MTLSDetails     kubernetes.MTLSDetails
}

func (m MeshWideMTLSChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// if DestinationRule doesn't enable mTLS, stop validation with any check
	if !kubernetes.DestinationRuleHasMeshWideMTLSEnabled(m.DestinationRule) {
		return validations, true
	}

	// otherwise, check among MeshPolicies for a rule enabling mesh-wide mTLS
	for _, mp := range m.MTLSDetails.MeshPolicies {
		if kubernetes.MeshPolicyHasMTLSEnabled(mp) {
			return validations, true
		}
	}

	check := models.Build("destinationrules.mtls.meshpolicymissing", "spec/trafficPolicy/tls/mode")
	validations = append(validations, &check)

	return validations, false
}
