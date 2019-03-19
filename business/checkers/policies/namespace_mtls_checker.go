package policies

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NamespaceMtlsChecker struct {
	Policy      kubernetes.IstioObject
	MTLSDetails kubernetes.MTLSDetails
}

func (t NamespaceMtlsChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// if Policy doesn't enables mTLS, stop validation with any check.
	if enabled, _ := kubernetes.PolicyHasMTLSEnabled(t.Policy); !enabled {
		return validations, true
	}

	// otherwise, check among Destination Rules for a rule enabling mTLS namespace-wide.
	for _, dr := range t.MTLSDetails.DestinationRules {
		if enabled, _ := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(t.Policy.GetObjectMeta().Namespace, dr); enabled {
			return validations, true
		}
	}

	check := models.Build("policies.mtls.destinationrulemissing", "spec/peers/mtls")
	validations = append(validations, &check)

	return validations, false
}
