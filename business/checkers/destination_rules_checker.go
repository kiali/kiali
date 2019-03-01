package checkers

import (
	"github.com/kiali/kiali/business/checkers/destinationrules"
	"github.com/kiali/kiali/kubernetes"
)

type DestinationRulesChecker struct {
	ObjectCheck
	DestinationRules []kubernetes.IstioObject
	MTLSDetails      kubernetes.MTLSDetails
}

func (in DestinationRulesChecker) GetType() string {
	return "destinationrule"
}

func (in DestinationRulesChecker) GetObjects() []kubernetes.IstioObject {
	return in.DestinationRules
}

func (in DestinationRulesChecker) GetGroupCheckers() []GroupChecker {
	return []GroupChecker{
		destinationrules.MultiMatchChecker{DestinationRules: in.DestinationRules},
		destinationrules.TrafficPolicyChecker{DestinationRules: in.DestinationRules, MTLSDetails: in.MTLSDetails},
	}
}

func (in DestinationRulesChecker) GetIndividualCheckers(destinationRule kubernetes.IstioObject) []IndividualChecker {
	return []IndividualChecker{
		destinationrules.MeshWideMTLSChecker{DestinationRule: destinationRule, MTLSDetails: in.MTLSDetails},
	}
}
