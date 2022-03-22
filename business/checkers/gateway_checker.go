package checkers

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/business/checkers/gateways"
	"github.com/kiali/kiali/models"
)

const GatewayCheckerType = "gateway"

type GatewayChecker struct {
	Gateways              []networking_v1alpha3.Gateway
	Namespace             string
	WorkloadsPerNamespace map[string]models.WorkloadList
	IsGatewayToNamespace  bool
}

// Check runs checks for the all namespaces actions as well as for the single namespace validations
func (g GatewayChecker) Check() models.IstioValidations {
	// Multinamespace checkers
	validations := gateways.MultiMatchChecker{
		Gateways: g.Gateways,
	}.Check()

	for _, gw := range g.Gateways {
		if gw.Namespace == g.Namespace {
			validations.MergeValidations(g.runSingleChecks(gw))
		}
	}

	return validations
}

func (g GatewayChecker) runSingleChecks(gw networking_v1alpha3.Gateway) models.IstioValidations {
	key, validations := EmptyValidValidation(gw.Name, gw.Namespace, GatewayCheckerType)

	enabledCheckers := []Checker{
		gateways.SelectorChecker{
			Gateway:               gw,
			WorkloadsPerNamespace: g.WorkloadsPerNamespace,
			IsGatewayToNamespace:  g.IsGatewayToNamespace,
		},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
