package checkers

import (
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/business/checkers/k8sgateways"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type K8sGatewayChecker struct {
	K8sGateways    []*k8s_networking_v1.Gateway
	GatewayClasses []config.GatewayAPIClass
	Cluster        string
}

// Check runs checks for the all namespaces actions as well as for the single namespace validations
func (g K8sGatewayChecker) Check() models.IstioValidations {
	// Multinamespace checkers
	validations := k8sgateways.MultiMatchChecker{
		K8sGateways: g.K8sGateways,
		Cluster:     g.Cluster,
	}.Check()

	for _, gw := range g.K8sGateways {
		validations.MergeValidations(g.runSingleChecks(gw))
	}

	return validations
}

func (g K8sGatewayChecker) runSingleChecks(gw *k8s_networking_v1.Gateway) models.IstioValidations {
	key, validations := EmptyValidValidation(gw.Name, gw.Namespace, kubernetes.K8sGateways.String(), g.Cluster)

	enabledCheckers := []Checker{
		k8sgateways.StatusChecker{
			K8sGateway: gw,
		},
		k8sgateways.GatewayClassChecker{
			K8sGateway:     gw,
			GatewayClasses: g.GatewayClasses,
		},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
