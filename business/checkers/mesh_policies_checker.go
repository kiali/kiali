package checkers

import (
	"github.com/kiali/kiali/business/checkers/meshpolicies"
	"github.com/kiali/kiali/kubernetes"
)

type MeshPolicyChecker struct {
	ObjectCheck
	MeshPolicies []kubernetes.IstioObject
	MTLSDetails  kubernetes.MTLSDetails
}

func (in MeshPolicyChecker) GetType() string {
	return "meshpolicy"
}

func (in MeshPolicyChecker) GetObjects() []kubernetes.IstioObject {
	return in.MeshPolicies
}

func (in MeshPolicyChecker) GetIndividualCheckers(meshPolicy kubernetes.IstioObject) []IndividualChecker {
	return []IndividualChecker{
		meshpolicies.MtlsChecker{MeshPolicy: meshPolicy, MTLSDetails: in.MTLSDetails},
	}
}
