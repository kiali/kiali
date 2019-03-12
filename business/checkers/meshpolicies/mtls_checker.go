package meshpolicies

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const MeshPolicyCheckerType = "meshpolicy"

type MtlsChecker struct {
	MeshPolicy  kubernetes.IstioObject
	MTLSDetails kubernetes.MTLSDetails
}

func (t MtlsChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// if MeshPolicy doesn't enables mTLS, stop validation with any check.
	if enabled, _ := kubernetes.PolicyHasMTLSEnabled(t.MeshPolicy); !enabled {
		return validations, true
	}

	// otherwise, check among Destination Rules for a rule enabling mTLS mesh-wide.
	for _, dr := range t.MTLSDetails.DestinationRules {
		if enabled, _ := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); enabled {
			return validations, true
		}
	}

	check := models.Build("meshpolicies.mtls.destinationrulemissing", "spec/peers/mtls")
	validations = append(validations, &check)

	return validations, false
}
