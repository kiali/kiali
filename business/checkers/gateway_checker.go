package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/gateways"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type GatewayChecker struct {
	Gateways              []*networking_v1.Gateway
	WorkloadsPerNamespace map[string]models.Workloads
	IsGatewayToNamespace  bool
	Cluster               string
}

// Check runs checks for the all namespaces actions as well as for the single namespace validations
func (g GatewayChecker) Check() models.IstioValidations {
	// Multinamespace checkers
	validations := gateways.MultiMatchChecker{
		Gateways: g.Gateways,
		Cluster:  g.Cluster,
	}.Check()

	for _, gw := range g.Gateways {
		validations.MergeValidations(g.runSingleChecks(gw))
	}

	return validations
}

func (g GatewayChecker) runSingleChecks(gw *networking_v1.Gateway) models.IstioValidations {
	key, validations := EmptyValidValidation(gw.Name, gw.Namespace, kubernetes.Gateways, g.Cluster)

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
