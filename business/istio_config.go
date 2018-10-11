package business

import (
	"fmt"
	"sync"

	auth_v1 "k8s.io/api/authorization/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type IstioConfigService struct {
	k8s kubernetes.IstioClientInterface
}

type IstioConfigCriteria struct {
	Namespace                string
	IncludeGateways          bool
	IncludeVirtualServices   bool
	IncludeDestinationRules  bool
	IncludeServiceEntries    bool
	IncludeRules             bool
	IncludeQuotaSpecs        bool
	IncludeQuotaSpecBindings bool
}

var resourceTypesToAPI = map[string]string{
	"destinationrules":  "networking.istio.io",
	"virtualservices":   "networking.istio.io",
	"serviceentries":    "networking.istio.io",
	"gateways":          "networking.istio.io",
	"rules":             "config.istio.io",
	"quotaspecs":        "config.istio.io",
	"quotaspecbindings": "config.istio.io",
}

// GetIstioConfig returns a list of Istio routing objects
// and Mixer Rules per a given Namespace.
func (in *IstioConfigService) GetIstioConfig(criteria IstioConfigCriteria) (models.IstioConfigList, error) {
	if criteria.Namespace == "" {
		return models.IstioConfigList{}, fmt.Errorf("GetIstioConfig needs a non null Namespace")
	}
	istioConfigList := models.IstioConfigList{
		Namespace:         models.Namespace{Name: criteria.Namespace},
		Gateways:          models.Gateways{},
		VirtualServices:   models.VirtualServices{},
		DestinationRules:  models.DestinationRules{},
		ServiceEntries:    models.ServiceEntries{},
		Rules:             models.IstioRules{},
		QuotaSpecs:        models.QuotaSpecs{},
		QuotaSpecBindings: models.QuotaSpecBindings{},
		Permissions:       make(map[string]models.ResourcePermissions),
	}
	var gg, vs, dr, se, qs, qb []kubernetes.IstioObject
	var mr *kubernetes.IstioRules
	var ggErr, vsErr, drErr, seErr, mrErr, qsErr, qbErr, pxErr error
	var wg sync.WaitGroup
	wg.Add(8)

	go func() {
		defer wg.Done()
		if criteria.IncludeGateways {
			if gg, ggErr = in.k8s.GetGateways(criteria.Namespace); ggErr == nil {
				(&istioConfigList.Gateways).Parse(gg)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeVirtualServices {
			if vs, vsErr = in.k8s.GetVirtualServices(criteria.Namespace, ""); vsErr == nil {
				(&istioConfigList.VirtualServices).Parse(vs)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeDestinationRules {
			if dr, drErr = in.k8s.GetDestinationRules(criteria.Namespace, ""); drErr == nil {
				(&istioConfigList.DestinationRules).Parse(dr)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeServiceEntries {
			if se, seErr = in.k8s.GetServiceEntries(criteria.Namespace); seErr == nil {
				(&istioConfigList.ServiceEntries).Parse(se)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeRules {
			if mr, mrErr = in.k8s.GetIstioRules(criteria.Namespace); mrErr == nil {
				istioConfigList.Rules = models.CastIstioRulesCollection(mr)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeQuotaSpecs {
			if qs, qsErr = in.k8s.GetQuotaSpecs(criteria.Namespace); qsErr == nil {
				(&istioConfigList.QuotaSpecs).Parse(qs)
			}
		}
	}()

	go func() {
		defer wg.Done()
		if criteria.IncludeQuotaSpecBindings {
			if qb, qbErr = in.k8s.GetQuotaSpecBindings(criteria.Namespace); qbErr == nil {
				(&istioConfigList.QuotaSpecBindings).Parse(qb)
			}
		}
	}()

	go func() {
		defer wg.Done()
		ssars, pxErr := in.k8s.GetSelfSubjectAccessReview(criteria.Namespace, []string{"create", "update", "delete"}, resourceTypesToAPI)
		if pxErr == nil {
			for _, ssar := range ssars {
				fillPermission(istioConfigList.Permissions, ssar)
			}
		}
	}()

	wg.Wait()

	for _, genErr := range []error{ggErr, vsErr, drErr, seErr, mrErr, qsErr, qbErr, pxErr} {
		if genErr != nil {
			return models.IstioConfigList{}, genErr
		}
	}

	return istioConfigList, nil
}

func (in *IstioConfigService) GetIstioConfigDetails(namespace string, objectType string, object string) (models.IstioConfigDetails, error) {
	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = objectType
	var gw, vs, dr, se, qs, qb kubernetes.IstioObject
	var r *kubernetes.IstioRuleDetails
	var err error
	permissions := make(models.ResourcePermissions)
	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		if api, ok := resourceTypesToAPI[objectType]; ok {
			resourceAndGroup := map[string]string{objectType: api}
			ssars, permErr := in.k8s.GetSelfSubjectAccessReview(namespace, []string{"create", "update", "delete"}, resourceAndGroup)
			if permErr == nil {
				for _, ssar := range ssars {
					permissions[ssar.Spec.ResourceAttributes.Verb] = ssar.Status.Allowed
				}
			}
		}
	}()

	switch objectType {
	case "gateways":
		if gw, err = in.k8s.GetGateway(namespace, object); err == nil {
			istioConfigDetail.Gateway = &models.Gateway{}
			istioConfigDetail.Gateway.Parse(gw)
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
	case "serviceentries":
		if se, err = in.k8s.GetServiceEntry(namespace, object); err == nil {
			istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
			istioConfigDetail.ServiceEntry.Parse(se)
		}
	case "rules":
		if r, err = in.k8s.GetIstioRuleDetails(namespace, object); err == nil {
			istioConfigDetail.ObjectType = "rules"
			istioConfigDetail.Rule = models.CastIstioRuleDetails(r)
		}
	case "quotaspecs":
		if qs, err = in.k8s.GetQuotaSpec(namespace, object); err == nil {
			istioConfigDetail.ObjectType = "quotaspecs"
			istioConfigDetail.QuotaSpec = &models.QuotaSpec{}
			istioConfigDetail.QuotaSpec.Parse(qs)
		}
	case "quotaspecbindings":
		if qb, err = in.k8s.GetQuotaSpecBinding(namespace, object); err == nil {
			istioConfigDetail.ObjectType = "quotaspecbindings"
			istioConfigDetail.QuotaSpecBinding = &models.QuotaSpecBinding{}
			istioConfigDetail.QuotaSpecBinding.Parse(qb)
		}
	default:
		err = fmt.Errorf("Object type not found: %v", objectType)
	}

	wg.Wait()
	istioConfigDetail.Permissions = permissions

	return istioConfigDetail, err
}

func fillPermission(allPerms map[string]models.ResourcePermissions, ssar *auth_v1.SelfSubjectAccessReview) {
	resource := ssar.Spec.ResourceAttributes.Resource
	perm, ok := allPerms[resource]
	if !ok {
		perm = make(models.ResourcePermissions)
		allPerms[resource] = perm
	}
	perm[ssar.Spec.ResourceAttributes.Verb] = ssar.Status.Allowed
}
