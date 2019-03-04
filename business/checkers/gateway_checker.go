package checkers

import (
	"github.com/kiali/kiali/business/checkers/gateways"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type GatewayChecker struct {
	ObjectCheck
	GatewaysPerNamespace [][]kubernetes.IstioObject
	Namespace            string
}

func (g GatewayChecker) GetType() string {
	return "gateway"
}

func (g GatewayChecker) GetGroupCheckers() []GroupChecker {
	return []GroupChecker{
		gateways.MultiMatchChecker{GatewaysPerNamespace: g.GatewaysPerNamespace},
	}
}

func (g GatewayChecker) GetIndividualCheckers(object kubernetes.IstioObject) []IndividualChecker {
	return []IndividualChecker{
		gateways.PortChecker{Gateway: object},
	}
}

func (oc GatewayChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(oc.runIndividualChecks())
	validations = validations.MergeValidations(oc.runGroupChecks())

	return validations
}

func (g GatewayChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	// Single namespace
	for _, nssGw := range g.GatewaysPerNamespace {
		for _, gw := range nssGw {
			if gw.GetObjectMeta().Namespace == g.Namespace {
				validations.MergeValidations(g.runChecks(gw))
			}
		}
	}

	return validations
}
