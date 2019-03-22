package policies

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NamespaceMtlsChecker struct {
	Policy      kubernetes.IstioObject
	MTLSDetails kubernetes.MTLSDetails
}

// Checks if a Policy enabling namespace-wide has a Destination Rule enabling mTLS too
func (t NamespaceMtlsChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// if Policy doesn't enables mTLS, stop validation with any check.
	if strictMode := kubernetes.PolicyHasStrictMTLS(t.Policy); !strictMode {
		return validations, true
	}

	// otherwise, check among Destination Rules for a rule enabling mTLS namespace-wide or mesh-wide.
	for _, dr := range t.MTLSDetails.DestinationRules {
		// Check if there is a Destination Rule enabling ns-wide mTLS
		if enabled, _ := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(t.Policy.GetObjectMeta().Namespace, dr); enabled {
			return validations, true
		}

		// Check if there is a Destination Rule enabling mesh-wide mTLS in second position
		if enabled, _ := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); enabled {
			return validations, true
		}
	}

	check := models.Build("policies.mtls.destinationrulemissing", "spec/peers/mtls")
	validations = append(validations, &check)

	return validations, false
}
