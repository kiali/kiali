package checkers

import (
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/business/checkers/k8sgateways"
	"github.com/kiali/kiali/models"
)

const K8sGatewayCheckerType = "k8sgateway"

type K8sGatewayChecker struct {
	K8sGateways []*k8s_networking_v1beta1.Gateway
	Cluster     string
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

func (g K8sGatewayChecker) runSingleChecks(gw *k8s_networking_v1beta1.Gateway) models.IstioValidations {
	key, validations := EmptyValidValidation(gw.Name, gw.Namespace, K8sGatewayCheckerType, g.Cluster)

	enabledCheckers := []Checker{
		k8sgateways.StatusChecker{
			K8sGateway: gw,
		},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	result := make(models.IstioValidations)
	result[key] = validations
	return result
}
