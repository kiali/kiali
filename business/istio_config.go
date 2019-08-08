package business

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	errors2 "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type IstioConfigService struct {
	k8s kubernetes.IstioClientInterface
}

type IstioConfigCriteria struct {
	Namespace                     string
	IncludeGateways               bool
	IncludeVirtualServices        bool
	IncludeDestinationRules       bool
	IncludeServiceEntries         bool
	IncludeRules                  bool
	IncludeAdapters               bool
	IncludeTemplates              bool
	IncludeQuotaSpecs             bool
	IncludeQuotaSpecBindings      bool
	IncludePolicies               bool
	IncludeMeshPolicies           bool
	IncludeServiceMeshPolicies    bool
	IncludeClusterRbacConfigs     bool
	IncludeRbacConfigs            bool
	IncludeServiceMeshRbacConfigs bool
	IncludeServiceRoles           bool
	IncludeServiceRoleBindings    bool
	IncludeSidecars               bool
}

const (
	VirtualServices        = "virtualservices"
	DestinationRules       = "destinationrules"
	ServiceEntries         = "serviceentries"
	Gateways               = "gateways"
	Rules                  = "rules"
	Adapters               = "adapters"
	Templates              = "templates"
	QuotaSpecs             = "quotaspecs"
	QuotaSpecBindings      = "quotaspecbindings"
	Policies               = "policies"
	MeshPolicies           = "meshpolicies"
	ClusterRbacConfigs     = "clusterrbacconfigs"
	RbacConfigs            = "rbacconfigs"
	ServiceRoles           = "serviceroles"
	ServiceRoleBindings    = "servicerolebindings"
	Sidecars               = "sidecars"
	ServiceMeshPolicies    = "servicemeshpolicies"
	ServiceMeshRbacConfigs = "servicemeshrbacconfigs"
)

var resourceTypesToAPI = map[string]string{
	DestinationRules:       kubernetes.NetworkingGroupVersion.Group,
	VirtualServices:        kubernetes.NetworkingGroupVersion.Group,
	ServiceEntries:         kubernetes.NetworkingGroupVersion.Group,
	Gateways:               kubernetes.NetworkingGroupVersion.Group,
	Sidecars:               kubernetes.NetworkingGroupVersion.Group,
	Adapters:               kubernetes.ConfigGroupVersion.Group,
	Templates:              kubernetes.ConfigGroupVersion.Group,
	Rules:                  kubernetes.ConfigGroupVersion.Group,
	QuotaSpecs:             kubernetes.ConfigGroupVersion.Group,
	QuotaSpecBindings:      kubernetes.ConfigGroupVersion.Group,
	Policies:               kubernetes.AuthenticationGroupVersion.Group,
	MeshPolicies:           kubernetes.AuthenticationGroupVersion.Group,
	ClusterRbacConfigs:     kubernetes.RbacGroupVersion.Group,
	RbacConfigs:            kubernetes.RbacGroupVersion.Group,
	ServiceRoles:           kubernetes.RbacGroupVersion.Group,
	ServiceRoleBindings:    kubernetes.RbacGroupVersion.Group,
	ServiceMeshPolicies:    kubernetes.MaistraAuthenticationGroupVersion.Group,
	ServiceMeshRbacConfigs: kubernetes.MaistraRbacGroupVersion.Group,
}

var apiToVersion = map[string]string{
	kubernetes.NetworkingGroupVersion.Group:            kubernetes.ApiNetworkingVersion,
	kubernetes.ConfigGroupVersion.Group:                kubernetes.ApiConfigVersion,
	kubernetes.AuthenticationGroupVersion.Group:        kubernetes.ApiAuthenticationVersion,
	kubernetes.RbacGroupVersion.Group:                  kubernetes.ApiRbacVersion,
	kubernetes.MaistraAuthenticationGroupVersion.Group: kubernetes.ApiMaistraAuthenticationVersion,
	kubernetes.MaistraRbacGroupVersion.Group:           kubernetes.ApiMaistraRbacVersion,
}

// GetIstioConfigList returns a list of Istio routing objects, Mixer Rules, (etc.)
// per a given Namespace.
func (in *IstioConfigService) GetIstioConfigList(criteria IstioConfigCriteria) (models.IstioConfigList, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "GetIstioConfigList")
	defer promtimer.ObserveNow(&err)

	if criteria.Namespace == "" {
		return models.IstioConfigList{}, errors.New("GetIstioConfigList needs a non empty Namespace")
	}
	istioConfigList := models.IstioConfigList{
		Namespace:              models.Namespace{Name: criteria.Namespace},
		Gateways:               models.Gateways{},
		VirtualServices:        models.VirtualServices{Items: []models.VirtualService{}},
		DestinationRules:       models.DestinationRules{Items: []models.DestinationRule{}},
		ServiceEntries:         models.ServiceEntries{},
		Rules:                  models.IstioRules{},
		Adapters:               models.IstioAdapters{},
		Templates:              models.IstioTemplates{},
		QuotaSpecs:             models.QuotaSpecs{},
		QuotaSpecBindings:      models.QuotaSpecBindings{},
		Policies:               models.Policies{},
		MeshPolicies:           models.MeshPolicies{},
		ServiceMeshPolicies:    models.ServiceMeshPolicies{},
		ClusterRbacConfigs:     models.ClusterRbacConfigs{},
		RbacConfigs:            models.RbacConfigs{},
		ServiceMeshRbacConfigs: models.ServiceMeshRbacConfigs{},
		Sidecars:               models.Sidecars{},
		ServiceRoles:           models.ServiceRoles{},
		ServiceRoleBindings:    models.ServiceRoleBindings{},
	}

	errChan := make(chan error, 1)

	var wg sync.WaitGroup
	wg.Add(18)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeGateways {
			if gg, ggErr := in.k8s.GetGateways(criteria.Namespace); ggErr == nil {
				(&istioConfigList.Gateways).Parse(gg)
			} else {
				errChan <- ggErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeVirtualServices {
			if vs, vsErr := in.k8s.GetVirtualServices(criteria.Namespace, ""); vsErr == nil {
				(&istioConfigList.VirtualServices).Parse(vs)
			} else {
				errChan <- vsErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeDestinationRules {
			if dr, drErr := in.k8s.GetDestinationRules(criteria.Namespace, ""); drErr == nil {
				(&istioConfigList.DestinationRules).Parse(dr)
			} else {
				errChan <- drErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeServiceEntries {
			if se, seErr := in.k8s.GetServiceEntries(criteria.Namespace); seErr == nil {
				(&istioConfigList.ServiceEntries).Parse(se)
			} else {
				errChan <- seErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeRules {
			if mr, mrErr := in.k8s.GetIstioRules(criteria.Namespace, ""); mrErr == nil {
				istioConfigList.Rules = models.CastIstioRulesCollection(mr)
			} else {
				errChan <- mrErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeAdapters {
			if aa, aaErr := in.k8s.GetAdapters(criteria.Namespace, ""); aaErr == nil {
				istioConfigList.Adapters = models.CastIstioAdaptersCollection(aa)
			} else {
				errChan <- aaErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeTemplates {
			if tt, ttErr := in.k8s.GetTemplates(criteria.Namespace, ""); ttErr == nil {
				istioConfigList.Templates = models.CastIstioTemplatesCollection(tt)
			} else {
				errChan <- ttErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeQuotaSpecs {
			if qs, qsErr := in.k8s.GetQuotaSpecs(criteria.Namespace); qsErr == nil {
				(&istioConfigList.QuotaSpecs).Parse(qs)
			} else {
				errChan <- qsErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeQuotaSpecBindings {
			if qb, qbErr := in.k8s.GetQuotaSpecBindings(criteria.Namespace); qbErr == nil {
				(&istioConfigList.QuotaSpecBindings).Parse(qb)
			} else {
				errChan <- qbErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludePolicies {
			if pc, pcErr := in.k8s.GetPolicies(criteria.Namespace); pcErr == nil {
				(&istioConfigList.Policies).Parse(pc)
			} else {
				errChan <- pcErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		// MeshPolicies are not namespaced. They will be only listed for the namespace
		// where Istio is deployed. Only listed in non Maistra environments.
		if criteria.IncludeMeshPolicies && criteria.Namespace == config.Get().IstioNamespace && !in.k8s.IsMaistraApi() {
			if mp, mpErr := in.k8s.GetMeshPolicies(criteria.Namespace); mpErr == nil {
				(&istioConfigList.MeshPolicies).Parse(mp)
			} else {
				errChan <- mpErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		// ClusterRbacConfigs are not namespaced. They will be only listed for the namespace
		// where Istio is deployed. Only listed in non Maistra environments.
		if criteria.IncludeClusterRbacConfigs && criteria.Namespace == config.Get().IstioNamespace && !in.k8s.IsMaistraApi() {
			if crc, crcErr := in.k8s.GetClusterRbacConfigs(criteria.Namespace); crcErr == nil {
				(&istioConfigList.ClusterRbacConfigs).Parse(crc)
			} else {
				errChan <- crcErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeRbacConfigs {
			if rc, rcErr := in.k8s.GetRbacConfigs(criteria.Namespace); rcErr == nil {
				(&istioConfigList.RbacConfigs).Parse(rc)
			} else {
				errChan <- rcErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeSidecars {
			if sc, scErr := in.k8s.GetSidecars(criteria.Namespace); scErr == nil {
				(&istioConfigList.Sidecars).Parse(sc)
			} else {
				errChan <- scErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeServiceRoles {
			if sr, srErr := in.k8s.GetServiceRoles(criteria.Namespace); srErr == nil {
				(&istioConfigList.ServiceRoles).Parse(sr)
			} else {
				errChan <- srErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeServiceRoleBindings {
			if srb, srbErr := in.k8s.GetServiceRoleBindings(criteria.Namespace); srbErr == nil {
				(&istioConfigList.ServiceRoleBindings).Parse(srb)
			} else {
				errChan <- srbErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		// This query is only executed if Maistra API is present, backend will ignore it in other environments
		if criteria.IncludeServiceMeshPolicies && in.k8s.IsMaistraApi() {
			if smp, smpErr := in.k8s.GetServiceMeshPolicies(criteria.Namespace); smpErr == nil {
				(&istioConfigList.ServiceMeshPolicies).Parse(smp)
			} else {
				errChan <- smpErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		// This query is only executed if Maistra API is present, backend will ignore it in other environments
		if criteria.IncludeServiceMeshRbacConfigs && in.k8s.IsMaistraApi() {
			if smrc, smrcErr := in.k8s.GetServiceMeshRbacConfigs(criteria.Namespace); smrcErr == nil {
				(&istioConfigList.ServiceMeshRbacConfigs).Parse(smrc)
			} else {
				errChan <- smrcErr
			}
		}
	}(errChan)

	wg.Wait()

	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			err = e // To update the Kiali metric
			return models.IstioConfigList{}, err
		}
	}

	return istioConfigList, nil
}

// GetIstioConfigDetails returns a specific Istio configuration object.
// It uses following parameters:
// - "namespace": 		namespace where configuration is stored
// - "objectType":		type of the configuration
// - "objectSubtype":	subtype of the configuration, used when objectType == "adapters" or "templates", empty/not used otherwise
// - "object":			name of the configuration
func (in *IstioConfigService) GetIstioConfigDetails(namespace, objectType, objectSubtype, object string) (models.IstioConfigDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "GetIstioConfigDetails")
	defer promtimer.ObserveNow(&err)

	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = objectType

	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		canCreate, canUpdate, canDelete := getPermissions(in.k8s, namespace, objectType, objectSubtype)
		istioConfigDetail.Permissions = models.ResourcePermissions{
			Create: canCreate,
			Update: canUpdate,
			Delete: canDelete,
		}
	}()

	switch objectType {
	case Gateways:
		if gw, iErr := in.k8s.GetGateway(namespace, object); iErr == nil {
			istioConfigDetail.Gateway = &models.Gateway{}
			istioConfigDetail.Gateway.Parse(gw)
		} else {
			err = iErr
		}
	case VirtualServices:
		if vs, iErr := in.k8s.GetVirtualService(namespace, object); iErr == nil {
			istioConfigDetail.VirtualService = &models.VirtualService{}
			istioConfigDetail.VirtualService.Parse(vs)
		} else {
			err = iErr
		}
	case DestinationRules:
		if dr, iErr := in.k8s.GetDestinationRule(namespace, object); iErr == nil {
			istioConfigDetail.DestinationRule = &models.DestinationRule{}
			istioConfigDetail.DestinationRule.Parse(dr)
		} else {
			err = iErr
		}
	case ServiceEntries:
		if se, iErr := in.k8s.GetServiceEntry(namespace, object); iErr == nil {
			istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
			istioConfigDetail.ServiceEntry.Parse(se)
		} else {
			err = iErr
		}
	case Sidecars:
		if sc, iErr := in.k8s.GetSidecar(namespace, object); iErr == nil {
			istioConfigDetail.Sidecar = &models.Sidecar{}
			istioConfigDetail.Sidecar.Parse(sc)
		} else {
			err = iErr
		}
	case Rules:
		if r, iErr := in.k8s.GetIstioRule(namespace, object); iErr == nil {
			istioRule := models.CastIstioRule(r)
			istioConfigDetail.Rule = &istioRule
		} else {
			err = iErr
		}
	case Adapters:
		if a, iErr := in.k8s.GetAdapter(namespace, objectSubtype, object); iErr == nil {
			adapter := models.CastIstioAdapter(a)
			istioConfigDetail.Adapter = &adapter
		} else {
			err = iErr
		}
	case Templates:
		if t, iErr := in.k8s.GetTemplate(namespace, objectSubtype, object); iErr == nil {
			template := models.CastIstioTemplate(t)
			istioConfigDetail.Template = &template
		} else {
			err = iErr
		}
	case QuotaSpecs:
		if qs, iErr := in.k8s.GetQuotaSpec(namespace, object); iErr == nil {
			istioConfigDetail.QuotaSpec = &models.QuotaSpec{}
			istioConfigDetail.QuotaSpec.Parse(qs)
		} else {
			err = iErr
		}
	case QuotaSpecBindings:
		if qb, iErr := in.k8s.GetQuotaSpecBinding(namespace, object); iErr == nil {
			istioConfigDetail.QuotaSpecBinding = &models.QuotaSpecBinding{}
			istioConfigDetail.QuotaSpecBinding.Parse(qb)
		} else {
			err = iErr
		}
	case Policies:
		if pc, iErr := in.k8s.GetPolicy(namespace, object); iErr == nil {
			istioConfigDetail.Policy = &models.Policy{}
			istioConfigDetail.Policy.Parse(pc)
		} else {
			err = iErr
		}
	case MeshPolicies:
		if mp, iErr := in.k8s.GetMeshPolicy(namespace, object); iErr == nil {
			istioConfigDetail.MeshPolicy = &models.MeshPolicy{}
			istioConfigDetail.MeshPolicy.Parse(mp)
		} else {
			err = iErr
		}
	case ServiceMeshPolicies:
		if mp, iErr := in.k8s.GetServiceMeshPolicy(namespace, object); iErr == nil {
			istioConfigDetail.ServiceMeshPolicy = &models.ServiceMeshPolicy{}
			istioConfigDetail.ServiceMeshPolicy.Parse(mp)
		} else {
			err = iErr
		}
	case ClusterRbacConfigs:
		if crc, iErr := in.k8s.GetClusterRbacConfig(namespace, object); iErr == nil {
			istioConfigDetail.ClusterRbacConfig = &models.ClusterRbacConfig{}
			istioConfigDetail.ClusterRbacConfig.Parse(crc)
		} else {
			err = iErr
		}
	case RbacConfigs:
		if rc, iErr := in.k8s.GetRbacConfig(namespace, object); iErr == nil {
			istioConfigDetail.RbacConfig = &models.RbacConfig{}
			istioConfigDetail.RbacConfig.Parse(rc)
		} else {
			err = iErr
		}
	case ServiceMeshRbacConfigs:
		if rc, iErr := in.k8s.GetServiceMeshRbacConfig(namespace, object); iErr == nil {
			istioConfigDetail.ServiceMeshRbacConfig = &models.ServiceMeshRbacConfig{}
			istioConfigDetail.ServiceMeshRbacConfig.Parse(rc)
		} else {
			err = iErr
		}
	case ServiceRoles:
		if sr, iErr := in.k8s.GetServiceRole(namespace, object); iErr == nil {
			istioConfigDetail.ServiceRole = &models.ServiceRole{}
			istioConfigDetail.ServiceRole.Parse(sr)
		} else {
			err = iErr
		}
	case ServiceRoleBindings:
		if srb, iErr := in.k8s.GetServiceRoleBinding(namespace, object); iErr == nil {
			istioConfigDetail.ServiceRoleBinding = &models.ServiceRoleBinding{}
			istioConfigDetail.ServiceRoleBinding.Parse(srb)
		} else {
			err = iErr
		}
	default:
		err = fmt.Errorf("object type not found: %v", objectType)
	}

	wg.Wait()

	return istioConfigDetail, err
}

// GetIstioAPI provides the Kubernetes API that manages this Istio resource type
// or empty string if it's not managed
func GetIstioAPI(resourceType string) string {
	return resourceTypesToAPI[resourceType]
}

// ParseJsonForCreate checks if a json is well formed according resourceType/subresourceType.
// It returns a json validated to be used in the Create operation, or an error to report in the handler layer.
func (in *IstioConfigService) ParseJsonForCreate(resourceType, subresourceType string, body []byte) (string, error) {
	var err error
	istioConfigDetail := models.IstioConfigDetails{}
	apiVersion := apiToVersion[resourceTypesToAPI[resourceType]]
	var kind string
	var marshalled string
	if resourceType == Adapters || resourceType == Templates {
		kind = kubernetes.PluralType[subresourceType]
	} else {
		kind = kubernetes.PluralType[resourceType]
	}
	switch resourceType {
	case Gateways:
		istioConfigDetail.Gateway = &models.Gateway{}
		err = json.Unmarshal(body, istioConfigDetail.Gateway)
	case VirtualServices:
		istioConfigDetail.VirtualService = &models.VirtualService{}
		err = json.Unmarshal(body, istioConfigDetail.VirtualService)
	case DestinationRules:
		istioConfigDetail.DestinationRule = &models.DestinationRule{}
		err = json.Unmarshal(body, istioConfigDetail.DestinationRule)
	case ServiceEntries:
		istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
		err = json.Unmarshal(body, istioConfigDetail.ServiceEntry)
	case Sidecars:
		istioConfigDetail.Sidecar = &models.Sidecar{}
		err = json.Unmarshal(body, istioConfigDetail.Sidecar)
	case Rules:
		istioConfigDetail.Rule = &models.IstioRule{}
		err = json.Unmarshal(body, istioConfigDetail.Rule)
	case Adapters:
		istioConfigDetail.Adapter = &models.IstioAdapter{}
		err = json.Unmarshal(body, istioConfigDetail.Adapter)
	case Templates:
		istioConfigDetail.Template = &models.IstioTemplate{}
		err = json.Unmarshal(body, istioConfigDetail.Template)
	case QuotaSpecs:
		istioConfigDetail.QuotaSpec = &models.QuotaSpec{}
		err = json.Unmarshal(body, istioConfigDetail.QuotaSpec)
	case QuotaSpecBindings:
		istioConfigDetail.QuotaSpecBinding = &models.QuotaSpecBinding{}
		err = json.Unmarshal(body, istioConfigDetail.QuotaSpecBinding)
	case Policies:
		istioConfigDetail.Policy = &models.Policy{}
		err = json.Unmarshal(body, istioConfigDetail.Policy)
	case MeshPolicies:
		istioConfigDetail.MeshPolicy = &models.MeshPolicy{}
		err = json.Unmarshal(body, istioConfigDetail.MeshPolicy)
	case ServiceMeshPolicies:
		istioConfigDetail.ServiceMeshPolicy = &models.ServiceMeshPolicy{}
		err = json.Unmarshal(body, istioConfigDetail.ServiceMeshPolicy)
	case ServiceMeshRbacConfigs:
		istioConfigDetail.ServiceMeshRbacConfig = &models.ServiceMeshRbacConfig{}
		err = json.Unmarshal(body, istioConfigDetail.ServiceMeshRbacConfig)
	default:
		err = fmt.Errorf("object type not found: %v", resourceType)
	}
	if err != nil {
		return "", err
	}
	// Append apiVersion and kind
	marshalled = string(body)
	marshalled = strings.TrimSpace(marshalled)
	marshalled = "" +
		"{\n" +
		"\"kind\": \"" + kind + "\",\n" +
		"\"apiVersion\": \"" + apiVersion + "\"," +
		marshalled[1:]

	return marshalled, nil
}

// DeleteIstioConfigDetail deletes the given Istio resource
func (in *IstioConfigService) DeleteIstioConfigDetail(api, namespace, resourceType, resourceSubtype, name string) (err error) {
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "DeleteIstioConfigDetail")
	defer promtimer.ObserveNow(&err)

	if resourceType == Adapters || resourceType == Templates {
		err = in.k8s.DeleteIstioObject(api, namespace, resourceSubtype, name)
	} else {
		err = in.k8s.DeleteIstioObject(api, namespace, resourceType, name)
	}
	return err
}

func (in *IstioConfigService) UpdateIstioConfigDetail(api, namespace, resourceType, resourceSubtype, name, jsonPatch string) (models.IstioConfigDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "UpdateIstioConfigDetail")
	defer promtimer.ObserveNow(&err)

	return in.modifyIstioConfigDetail(api, namespace, resourceType, resourceSubtype, name, jsonPatch, false)
}

func (in *IstioConfigService) modifyIstioConfigDetail(api, namespace, resourceType, resourceSubtype, name, json string, create bool) (models.IstioConfigDetails, error) {
	var err error
	updatedType := resourceType
	if resourceType == Adapters || resourceType == Templates {
		updatedType = resourceSubtype
	}

	var result kubernetes.IstioObject
	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = resourceType

	if create {
		// Create new object
		result, err = in.k8s.CreateIstioObject(api, namespace, updatedType, json)
	} else {
		// Update/Path existing object
		result, err = in.k8s.UpdateIstioObject(api, namespace, updatedType, name, json)
	}
	if err != nil {
		return istioConfigDetail, err
	}

	switch resourceType {
	case Gateways:
		istioConfigDetail.Gateway = &models.Gateway{}
		istioConfigDetail.Gateway.Parse(result)
	case VirtualServices:
		istioConfigDetail.VirtualService = &models.VirtualService{}
		istioConfigDetail.VirtualService.Parse(result)
	case DestinationRules:
		istioConfigDetail.DestinationRule = &models.DestinationRule{}
		istioConfigDetail.DestinationRule.Parse(result)
	case ServiceEntries:
		istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
		istioConfigDetail.ServiceEntry.Parse(result)
	case Sidecars:
		istioConfigDetail.Sidecar = &models.Sidecar{}
		istioConfigDetail.Sidecar.Parse(result)
	case Rules:
		istioRule := models.CastIstioRule(result)
		istioConfigDetail.Rule = &istioRule
	case Adapters:
		adapter := models.CastIstioAdapter(result)
		istioConfigDetail.Adapter = &adapter
	case Templates:
		template := models.CastIstioTemplate(result)
		istioConfigDetail.Template = &template
	case QuotaSpecs:
		istioConfigDetail.QuotaSpec = &models.QuotaSpec{}
		istioConfigDetail.QuotaSpec.Parse(result)
	case QuotaSpecBindings:
		istioConfigDetail.QuotaSpecBinding = &models.QuotaSpecBinding{}
		istioConfigDetail.QuotaSpecBinding.Parse(result)
	case Policies:
		istioConfigDetail.Policy = &models.Policy{}
		istioConfigDetail.Policy.Parse(result)
	case MeshPolicies:
		istioConfigDetail.MeshPolicy = &models.MeshPolicy{}
		istioConfigDetail.MeshPolicy.Parse(result)
	case ServiceMeshPolicies:
		istioConfigDetail.ServiceMeshPolicy = &models.ServiceMeshPolicy{}
		istioConfigDetail.ServiceMeshPolicy.Parse(result)
	case ClusterRbacConfigs:
		istioConfigDetail.ClusterRbacConfig = &models.ClusterRbacConfig{}
		istioConfigDetail.ClusterRbacConfig.Parse(result)
	case RbacConfigs:
		istioConfigDetail.RbacConfig = &models.RbacConfig{}
		istioConfigDetail.RbacConfig.Parse(result)
	case ServiceMeshRbacConfigs:
		istioConfigDetail.ServiceMeshRbacConfig = &models.ServiceMeshRbacConfig{}
		istioConfigDetail.ServiceMeshRbacConfig.Parse(result)
	case ServiceRoles:
		istioConfigDetail.ServiceRole = &models.ServiceRole{}
		istioConfigDetail.ServiceRole.Parse(result)
	case ServiceRoleBindings:
		istioConfigDetail.ServiceRoleBinding = &models.ServiceRoleBinding{}
		istioConfigDetail.ServiceRoleBinding.Parse(result)
	default:
		err = fmt.Errorf("object type not found: %v", resourceType)
	}
	return istioConfigDetail, err

}

func (in *IstioConfigService) CreateIstioConfigDetail(api, namespace, resourceType, resourceSubtype string, body []byte) (models.IstioConfigDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "CreateIstioConfigDetail")
	defer promtimer.ObserveNow(&err)

	json, err := in.ParseJsonForCreate(resourceType, resourceSubtype, body)
	if err != nil {
		return models.IstioConfigDetails{}, errors2.NewBadRequest(err.Error())
	}
	return in.modifyIstioConfigDetail(api, namespace, resourceType, resourceSubtype, "", json, true)
}

func getPermissions(k8s kubernetes.IstioClientInterface, namespace, objectType, objectSubtype string) (bool, bool, bool) {
	var canCreate, canPatch, canUpdate, canDelete bool
	if api, ok := resourceTypesToAPI[objectType]; ok {
		// objectType will always match the api used in adapters/templates
		// but if objectSubtype is present it should be used as resourceType
		resourceType := objectType
		if objectSubtype != "" {
			resourceType = objectSubtype
		}
		ssars, permErr := k8s.GetSelfSubjectAccessReview(namespace, api, resourceType, []string{"create", "patch", "update", "delete"})
		if permErr == nil {
			for _, ssar := range ssars {
				if ssar.Spec.ResourceAttributes != nil {
					switch ssar.Spec.ResourceAttributes.Verb {
					case "create":
						canCreate = ssar.Status.Allowed
					case "patch":
						canPatch = ssar.Status.Allowed
					case "update":
						canUpdate = ssar.Status.Allowed
					case "delete":
						canDelete = ssar.Status.Allowed
					}
				}
			}
		} else {
			log.Errorf("Error getting permissions [namespace: %s, api: %s, resourceType: %s]: %v", namespace, api, resourceType, permErr)
		}
	}
	return canCreate, (canUpdate || canPatch), canDelete
}
