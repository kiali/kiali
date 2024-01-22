package checkers

import (
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/destinationrules"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const DestinationRuleCheckerType = "destinationrule"

type DestinationRulesChecker struct {
	DestinationRules []*networking_v1beta1.DestinationRule
	MTLSDetails      kubernetes.MTLSDetails
	ServiceEntries   []*networking_v1beta1.ServiceEntry
	Namespaces       models.Namespaces
	Cluster          string
}

func (in DestinationRulesChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(in.runIndividualChecks())
	validations = validations.MergeValidations(in.runGroupChecks())

	return validations
}

func (in DestinationRulesChecker) runGroupChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	seHosts := kubernetes.ServiceEntryHostnames(in.ServiceEntries)

	enabledDRCheckers := []GroupChecker{
		destinationrules.MultiMatchChecker{Namespaces: in.Namespaces, ServiceEntries: seHosts, DestinationRules: in.DestinationRules, Cluster: in.Cluster},
	}

	enabledDRCheckers = append(enabledDRCheckers, destinationrules.TrafficPolicyChecker{DestinationRules: in.DestinationRules, MTLSDetails: in.MTLSDetails})

	for _, checker := range enabledDRCheckers {
		validations = validations.MergeValidations(checker.Check())
	}

	return validations
}

func (in DestinationRulesChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, destinationRule := range in.DestinationRules {
		validations.MergeValidations(in.runChecks(destinationRule))
	}

	return validations
}

func (in DestinationRulesChecker) runChecks(destinationRule *networking_v1beta1.DestinationRule) models.IstioValidations {
	destinationRuleName := destinationRule.Name
	key, rrValidation := EmptyValidValidation(destinationRuleName, destinationRule.Namespace, DestinationRuleCheckerType, in.Cluster)

	enabledCheckers := []Checker{
		destinationrules.DisabledNamespaceWideMTLSChecker{DestinationRule: destinationRule, MTLSDetails: in.MTLSDetails},
		destinationrules.DisabledMeshWideMTLSChecker{DestinationRule: destinationRule, MeshPeerAuthns: in.MTLSDetails.MeshPeerAuthentications},
	}
	if !in.Namespaces.IsNamespaceAmbient(destinationRule.Namespace, in.Cluster) {
		enabledCheckers = append(enabledCheckers, common.ExportToNamespaceChecker{ExportTo: destinationRule.Spec.ExportTo, Namespaces: in.Namespaces})
	}

	enabledCheckers = append(enabledCheckers, destinationrules.NamespaceWideMTLSChecker{DestinationRule: destinationRule, MTLSDetails: in.MTLSDetails})
	enabledCheckers = append(enabledCheckers, destinationrules.MeshWideMTLSChecker{DestinationRule: destinationRule, MTLSDetails: in.MTLSDetails})

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
