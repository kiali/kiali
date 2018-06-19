package business

import (
	"fmt"
	"sync"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type IstioConfigService struct {
	k8s kubernetes.IstioClientInterface
}

type IstioConfigCriteria struct {
	Namespace                  string
	IncludeGateways            bool
	IncludeRouteRules          bool
	IncludeDestinationPolicies bool
	IncludeVirtualServices     bool
	IncludeDestinationRules    bool
	IncludeRules               bool
}

// GetIstioConfig returns a list of Istio routing objects (RouteRule, DestinationPolicy, VirtualService, DestinationRule)
// and Mixer Rules per a given Namespace.
func (in *IstioConfigService) GetIstioConfig(criteria IstioConfigCriteria) (models.IstioConfigList, error) {
	if criteria.Namespace == "" {
		return models.IstioConfigList{}, fmt.Errorf("GetIstioConfig needs a non null Namespace")
	}
	istioConfigList := models.IstioConfigList{
		Namespace:           models.Namespace{Name: criteria.Namespace},
		Gateways:            models.Gateways{},
		RouteRules:          models.RouteRules{},
		DestinationPolicies: models.DestinationPolicies{},
		VirtualServices:     models.VirtualServices{},
		DestinationRules:    models.DestinationRules{},
		Rules:               models.IstioRules{},
	}
	var ggErr, rrErr, dpErr, vsErr, drErr, mrErr error
	var wg sync.WaitGroup
	wg.Add(6)

	go func() {
		defer wg.Done()
		if criteria.IncludeGateways {
			if gg, ggErr := in.k8s.GetGateways(criteria.Namespace); ggErr == nil {
				(&istioConfigList.Gateways).Parse(gg)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeRouteRules {
			if rr, rrErr := in.k8s.GetRouteRules(criteria.Namespace, ""); rrErr == nil {
				(&istioConfigList.RouteRules).Parse(rr)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeDestinationPolicies {
			if dp, dpErr := in.k8s.GetDestinationPolicies(criteria.Namespace, ""); dpErr == nil {
				(&istioConfigList.DestinationPolicies).Parse(dp)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeVirtualServices {
			if vs, vsErr := in.k8s.GetVirtualServices(criteria.Namespace, ""); vsErr == nil {
				(&istioConfigList.VirtualServices).Parse(vs)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeDestinationRules {
			if dr, drErr := in.k8s.GetDestinationRules(criteria.Namespace, ""); drErr == nil {
				(&istioConfigList.DestinationRules).Parse(dr)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeRules {
			if mr, mrErr := in.k8s.GetIstioRules(criteria.Namespace); mrErr == nil {
				istioConfigList.Rules = models.CastIstioRulesCollection(mr)
			}
		}
	}()

	wg.Wait()

	if ggErr != nil {
		return models.IstioConfigList{}, ggErr
	}

	if rrErr != nil {
		return models.IstioConfigList{}, rrErr
	}

	if dpErr != nil {
		return models.IstioConfigList{}, dpErr
	}

	if vsErr != nil {
		return models.IstioConfigList{}, vsErr
	}

	if drErr != nil {
		return models.IstioConfigList{}, drErr
	}

	if mrErr != nil {
		return models.IstioConfigList{}, mrErr
	}

	return istioConfigList, nil
}

func (in *IstioConfigService) GetIstioConfigDetails(namespace string, objectType string, object string) (models.IstioConfigDetails, error) {
	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = objectType
	var gw, rr, dp, vs, dr kubernetes.IstioObject
	var r *kubernetes.IstioRuleDetails
	var err error
	switch objectType {
	case "gateways":
		if gw, err = in.k8s.GetGateway(namespace, object); err == nil {
			istioConfigDetail.Gateway = &models.Gateway{}
			istioConfigDetail.Gateway.Parse(gw)
		}
	case "routerules":
		if rr, err = in.k8s.GetRouteRule(namespace, object); err == nil {
			istioConfigDetail.RouteRule = &models.RouteRule{}
			istioConfigDetail.RouteRule.Parse(rr)
		}
	case "destinationpolicies":
		if dp, err = in.k8s.GetDestinationPolicy(namespace, object); err == nil {
			istioConfigDetail.DestinationPolicy = &models.DestinationPolicy{}
			istioConfigDetail.DestinationPolicy.Parse(dp)
		}
	case "virtualservices":
		if vs, err = in.k8s.GetVirtualService(namespace, object); err == nil {
			istioConfigDetail.VirtualService = &models.VirtualService{}
			istioConfigDetail.VirtualService.Parse(vs)
		}
	case "destinationrules":
		if dr, err = in.k8s.GetDestinationRule(namespace, object); err == nil {
			istioConfigDetail.DestinationRule = &models.DestinationRule{}
			istioConfigDetail.DestinationRule.Parse(dr)
		}
	case "rules":
		if r, err = in.k8s.GetIstioRuleDetails(namespace, object); err == nil {
			istioConfigDetail.ObjectType = "rules"
			istioConfigDetail.Rule = models.CastIstioRuleDetails(r)

		}
	default:
		err = fmt.Errorf("Object type not found: %v", objectType)
	}

	return istioConfigDetail, err
}
