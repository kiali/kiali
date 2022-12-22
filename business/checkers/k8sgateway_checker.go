package checkers

import (
	"github.com/kiali/kiali/business/checkers/k8sgateways"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"

	"github.com/kiali/kiali/models"
)

const K8sGatewayCheckerType = "k8sgateway"

type K8sGatewayChecker struct {
	K8sGateways           []*k8s_networking_v1alpha2.Gateway
	WorkloadsPerNamespace map[string]models.WorkloadList
	IsGatewayToNamespace  bool
}

// Check runs checks for the all namespaces actions as well as for the single namespace validations
func (g K8sGatewayChecker) Check() models.IstioValidations {
	// Multinamespace checkers
	validations := k8sgateways.MultiMatchChecker{
		K8sGateways: g.K8sGateways,
	}.Check()

	for _, gw := range g.K8sGateways {
		validations.MergeValidations(g.runSingleChecks(gw))
	}

	return validations
}

func (g K8sGatewayChecker) runSingleChecks(gw *k8s_networking_v1alpha2.Gateway) models.IstioValidations {
	key, validations := EmptyValidValidation(gw.Name, gw.Namespace, GatewayCheckerType)

	enabledCheckers := []Checker{
		k8sgateways.SelectorChecker{
			K8sGateway:            gw,
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
