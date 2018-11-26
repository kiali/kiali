package checkers

import (
	"github.com/kiali/kiali/business/checkers/gateways"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type GatewayChecker struct {
	GatewaysPerNamespace [][]kubernetes.IstioObject
}

func (g GatewayChecker) Check() models.IstioValidations {
	return gateways.MultiMatchChecker{
		GatewaysPerNamespace: g.GatewaysPerNamespace,
	}.Check()
}
