package checkers

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/business/checkers/gateways"
	"github.com/kiali/kiali/models"
)

const GatewayCheckerType = "gateway"

type GatewayChecker struct {
	GatewaysPerNamespace  [][]networking_v1alpha3.Gateway
	Namespace             string
	WorkloadsPerNamespace map[string]models.WorkloadList
}

// Check runs checks for the all namespaces actions as well as for the single namespace validations
func (g GatewayChecker) Check() models.IstioValidations {
	// Multinamespace checkers
	validations := gateways.MultiMatchChecker{
		GatewaysPerNamespace: g.GatewaysPerNamespace,
	}.Check()

	// Single namespace
	for _, nssGw := range g.GatewaysPerNamespace {
		for _, gw := range nssGw {
			if gw.Namespace == g.Namespace {
				validations.MergeValidations(g.runSingleChecks(gw))
			}
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
		},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
