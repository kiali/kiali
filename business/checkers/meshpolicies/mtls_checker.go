package meshpolicies

import (
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const MeshPolicyCheckerType = "meshpolicy"

type MtlsChecker struct {
	MeshPolicy  kubernetes.IstioObject
	MTLSDetails kubernetes.MTLSDetails
}

func (t MtlsChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// if MeshPolicy doesn't enables mTLS, stop validation with any check.
	if !business.MeshPolicyHasMTLSEnabled(t.MeshPolicy) {
		return validations
	}

	// otherwise, check among Destination Rules for a rule enabling mTLS mesh-wide.
	for _, dr := range t.MTLSDetails.DestinationRules {
		if business.DestinationRuleHasMeshWideMTLSEnabled(dr) {
			return validations
		}
	}

	check := models.Build("meshpolicies.mtls.destinationrulemissing", "")
	key := models.BuildKey(MeshPolicyCheckerType, t.MeshPolicy.GetObjectMeta().Name)
	validations[key] = &models.IstioValidation{
		Name:       t.MeshPolicy.GetObjectMeta().Name,
		ObjectType: MeshPolicyCheckerType,
		Valid:      false,
		Checks: []*models.IstioCheck{
			&check,
		},
	}

	return validations
}
