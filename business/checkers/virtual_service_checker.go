package checkers

import (
	"github.com/kiali/kiali/kubernetes"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/virtualservices"
	"github.com/kiali/kiali/models"
)

type VirtualServiceChecker struct {
	Namespaces       models.Namespaces
	Cluster          string
	VirtualServices  []*networking_v1.VirtualService
	DestinationRules []*networking_v1.DestinationRule
}

// An Object Checker runs all checkers for an specific object type (i.e.: pod, route rule,...)
// It run two kinds of checkers:
// 1. Individual checks: validating individual objects.
// 2. Group checks: validating behaviour between configurations.
func (in VirtualServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(in.runIndividualChecks())
	validations = validations.MergeValidations(in.runGroupChecks())

	return validations
}

// Runs individual checks for each virtual service
func (in VirtualServiceChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, virtualService := range in.VirtualServices {
		validations.MergeValidations(in.runChecks(virtualService))
	}

	return validations
}

// runGroupChecks runs group checks for all virtual services
func (in VirtualServiceChecker) runGroupChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	enabledCheckers := []GroupChecker{
		virtualservices.SingleHostChecker{Namespaces: in.Namespaces, VirtualServices: in.VirtualServices, Cluster: in.Cluster},
	}

	for _, checker := range enabledCheckers {
		validations = validations.MergeValidations(checker.Check())
	}

	return validations
}

// runChecks runs all the individual checks for a single virtual service and appends the result into validations.
func (in VirtualServiceChecker) runChecks(virtualService *networking_v1.VirtualService) models.IstioValidations {
	virtualServiceName := virtualService.Name
	key, rrValidation := EmptyValidValidation(virtualServiceName, virtualService.Namespace, kubernetes.VirtualServices.String(), in.Cluster)

	enabledCheckers := []Checker{
		virtualservices.RouteChecker{VirtualService: virtualService, Namespaces: in.Namespaces.GetNames()},
		virtualservices.SubsetPresenceChecker{Namespaces: in.Namespaces.GetNames(), VirtualService: virtualService, DestinationRules: in.DestinationRules},
	}
	if !in.Namespaces.IsNamespaceAmbient(virtualService.Namespace, in.Cluster) {
		enabledCheckers = append(enabledCheckers, common.ExportToNamespaceChecker{ExportTo: virtualService.Spec.ExportTo, Namespaces: in.Namespaces})
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
