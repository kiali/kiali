package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/destinationrules"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type DestinationRulesChecker struct {
	Conf             *config.Config
	DestinationRules []*networking_v1.DestinationRule
	MTLSDetails      kubernetes.MTLSDetails
	ServiceEntries   []*networking_v1.ServiceEntry
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
		destinationrules.MultiMatchChecker{Conf: in.Conf, Namespaces: in.Namespaces.GetNames(), ServiceEntries: seHosts, DestinationRules: in.DestinationRules, Cluster: in.Cluster},
	}

	enabledDRCheckers = append(enabledDRCheckers, destinationrules.TrafficPolicyChecker{Conf: in.Conf, DestinationRules: in.DestinationRules, MTLSDetails: in.MTLSDetails, Cluster: in.Cluster})

	for _, checker := range enabledDRCheckers {
		validations = validations.MergeValidations(checker.Check())
	}

	return validations
}

func (in DestinationRulesChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	nsNames := in.Namespaces.GetNames()
	for _, destinationRule := range in.DestinationRules {
		validations.MergeValidations(in.runChecks(destinationRule, nsNames))
	}

	return validations
}

func (in DestinationRulesChecker) runChecks(destinationRule *networking_v1.DestinationRule, nsNames []string) models.IstioValidations {
	destinationRuleName := destinationRule.Name
	key, rrValidation := EmptyValidValidation(destinationRuleName, destinationRule.Namespace, kubernetes.DestinationRules, in.Cluster)

	enabledCheckers := []Checker{
		destinationrules.DisabledNamespaceWideMTLSChecker{Conf: in.Conf, DestinationRule: destinationRule, MTLSDetails: in.MTLSDetails},
		destinationrules.DisabledMeshWideMTLSChecker{DestinationRule: destinationRule, MeshPeerAuthns: in.MTLSDetails.MeshPeerAuthentications},
	}
	if !in.Namespaces.IsNamespaceAmbient(destinationRule.Namespace, in.Cluster) {
		enabledCheckers = append(enabledCheckers, common.ExportToNamespaceChecker{ExportTo: destinationRule.Spec.ExportTo, Namespaces: nsNames})
	}

	enabledCheckers = append(enabledCheckers, destinationrules.NamespaceWideMTLSChecker{Conf: in.Conf, DestinationRule: destinationRule, MTLSDetails: in.MTLSDetails})
	enabledCheckers = append(enabledCheckers, destinationrules.MeshWideMTLSChecker{DestinationRule: destinationRule, MTLSDetails: in.MTLSDetails})

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
