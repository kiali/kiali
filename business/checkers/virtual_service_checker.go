package checkers

import (
	"github.com/kiali/kiali/business/checkers/virtual_services"
	"github.com/kiali/kiali/kubernetes"
)

type VirtualServiceChecker struct {
	ObjectCheck
	Namespace        string
	DestinationRules []kubernetes.IstioObject
	VirtualServices  []kubernetes.IstioObject
}

func (in VirtualServiceChecker) GetType() string {
	return "virtualservice"
}

func (in VirtualServiceChecker) GetObjects() []kubernetes.IstioObject {
	return in.VirtualServices
}

func (in VirtualServiceChecker) GetGroupCheckers() []GroupChecker {
	return []GroupChecker{
		virtual_services.SingleHostChecker{Namespace: in.Namespace, VirtualServices: in.VirtualServices},
	}
}

func (in VirtualServiceChecker) GetIndividualCheckers(virtualService kubernetes.IstioObject) []IndividualChecker {
	return []IndividualChecker{
		virtual_services.RouteChecker{Route: virtualService},
		virtual_services.SubsetPresenceChecker{Namespace: in.Namespace, DestinationRules: in.DestinationRules, VirtualService: virtualService},
	}
}
