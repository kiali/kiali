package checkers

import (
	"github.com/kiali/kiali/business/checkers/gateways"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const GatewayCheckerType = "gateway"

type GatewayChecker struct {
	GatewaysPerNamespace  [][]kubernetes.IstioObject
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
			if gw.GetObjectMeta().Namespace == g.Namespace {
				validations.MergeValidations(g.runSingleChecks(gw))
			}
		}
	}

	return validations
}

func (g GatewayChecker) runSingleChecks(gw kubernetes.IstioObject) models.IstioValidations {
	key, validations := EmptyValidValidation(gw.GetObjectMeta().Name, gw.GetObjectMeta().Namespace, GatewayCheckerType)

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
