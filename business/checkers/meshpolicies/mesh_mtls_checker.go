package meshpolicies

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type MeshMtlsChecker struct {
	MeshPolicy  kubernetes.IstioObject
	MTLSDetails kubernetes.MTLSDetails
}

func (t MeshMtlsChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// if MeshPolicy doesn't have mtls in strict mode, stop validation with any check.
	if strictMode := kubernetes.PolicyHasStrictMTLS(t.MeshPolicy); !strictMode {
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
