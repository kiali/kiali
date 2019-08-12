package meshpolicies

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

// Note that MeshMtlsChecker will work with MeshPolicy and ServiceMeshPolicy resources
type MeshMtlsChecker struct {
	// MeshPolicy or ServiceMeshPolicy, it depends of the parent checker
	MeshPolicy    kubernetes.IstioObject
	MTLSDetails   kubernetes.MTLSDetails
	IsServiceMesh bool
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

	checkerId := "meshpolicies.mtls.destinationrulemissing"
	if t.IsServiceMesh {
		checkerId = "servicemeshpolicies.mtls.destinationrulemissing"
	}

	check := models.Build(checkerId, "spec/peers/mtls")
	validations = append(validations, &check)

	return validations, false
}
