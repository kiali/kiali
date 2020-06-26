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
	"github.com/kiali/kiali/util"
)

type IstioConfigService struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
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
	IncludeHandlers               bool
	IncludeInstances              bool
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
	IncludeAuthorizationPolicies  bool
	IncludePeerAuthentication     bool
	IncludeWorkloadEntries        bool
	IncludeRequestAuthentications bool
	IncludeEnvoyFilters           bool
	IncludeAttributeManifests     bool
	IncludeHttpApiSpecBindings    bool
	IncludeHttpApiSpecs           bool
	LabelSelector                 string
}

// IstioConfig types used in the IstioConfig New Page Form
var newIstioConfigTypes = []string{
	kubernetes.AuthorizationPolicies,
	kubernetes.Sidecars,
	kubernetes.Gateways,
	kubernetes.PeerAuthentications,
	kubernetes.RequestAuthentications,
	kubernetes.Handlers,
	kubernetes.Rules,
	kubernetes.Instances,
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
		Handlers:               models.IstioHandlers{},
		Instances:              models.IstioInstances{},
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
		AuthorizationPolicies:  models.AuthorizationPolicies{},
		PeerAuthentications:    models.PeerAuthentications{},
		WorkloadEntries:        models.WorkloadEntries{},
		RequestAuthentications: models.RequestAuthentications{},
		EnvoyFilters:           models.EnvoyFilters{},
		AttributeManifests:     models.AttributeManifests{},
		HttpApiSpecBindings:    models.HttpApiSpecBindings{},
		HttpApiSpecs:           models.HttpApiSpecs{},
	}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespace(criteria.Namespace); err != nil {
		return models.IstioConfigList{}, err
	}

	errChan := make(chan error, 26)

	var wg sync.WaitGroup
	wg.Add(28)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeGateways {
			var gg []kubernetes.IstioObject
			var ggErr error
			// Check if namespace is cached
			if kialiCache != nil && kialiCache.CheckIstioResource(kubernetes.Gateways) && kialiCache.CheckNamespace(criteria.Namespace) {
				gg, ggErr = kialiCache.GetIstioObjects(criteria.Namespace, kubernetes.Gateways, criteria.LabelSelector)
			} else {
				gg, ggErr = in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.Gateways, criteria.LabelSelector)
			}
			if ggErr == nil {
				(&istioConfigList.Gateways).Parse(gg)
			} else {
				errChan <- ggErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeVirtualServices {
			var vs []kubernetes.IstioObject
			var vsErr error
			// Check if namespace is cached
			if kialiCache != nil && kialiCache.CheckIstioResource(kubernetes.VirtualServices) && kialiCache.CheckNamespace(criteria.Namespace) {
				vs, vsErr = kialiCache.GetIstioObjects(criteria.Namespace, kubernetes.VirtualServices, criteria.LabelSelector)
			} else {
				vs, vsErr = in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.VirtualServices, criteria.LabelSelector)
			}
			if vsErr == nil {
				(&istioConfigList.VirtualServices).Parse(vs)
			} else {
				errChan <- vsErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeDestinationRules {
			var dr []kubernetes.IstioObject
			var drErr error
			// Check if namespace is cached
			if kialiCache != nil && kialiCache.CheckIstioResource(kubernetes.DestinationRules) && kialiCache.CheckNamespace(criteria.Namespace) {
				dr, drErr = kialiCache.GetIstioObjects(criteria.Namespace, kubernetes.DestinationRules, criteria.LabelSelector)
			} else {
				dr, drErr = in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.DestinationRules, criteria.LabelSelector)
			}
			if drErr == nil {
				(&istioConfigList.DestinationRules).Parse(dr)
			} else {
				errChan <- drErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeServiceEntries {
			var se []kubernetes.IstioObject
			var seErr error
			// Check if namespace is cached
			if kialiCache != nil && kialiCache.CheckIstioResource(kubernetes.ServiceEntries) && kialiCache.CheckNamespace(criteria.Namespace) {
				se, seErr = kialiCache.GetIstioObjects(criteria.Namespace, kubernetes.ServiceEntries, criteria.LabelSelector)
			} else {
				se, seErr = in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.ServiceEntries, criteria.LabelSelector)
			}
			if seErr == nil {
				(&istioConfigList.ServiceEntries).Parse(se)
			} else {
				errChan <- seErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeRules {
			if mr, mrErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.Rules, criteria.LabelSelector); mrErr == nil {
				istioConfigList.Rules = models.CastIstioRulesCollection(mr)
			} else {
				errChan <- mrErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeAdapters {
			if aa, aaErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.Adapters, criteria.LabelSelector); aaErr == nil {
				istioConfigList.Adapters = models.CastIstioAdaptersCollection(aa)
			} else {
				errChan <- aaErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeTemplates {
			if tt, ttErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.Templates, criteria.LabelSelector); ttErr == nil {
				istioConfigList.Templates = models.CastIstioTemplatesCollection(tt)
			} else {
				errChan <- ttErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeHandlers {
			if hh, hhErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.Handlers, criteria.LabelSelector); hhErr == nil {
				istioConfigList.Handlers = models.CastIstioHandlersCollection(hh)
			} else {
				errChan <- hhErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeInstances {
			if ii, iiErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.Instances, criteria.LabelSelector); iiErr == nil {
				istioConfigList.Instances = models.CastIstioInstancesCollection(ii)
			} else {
				errChan <- iiErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeQuotaSpecs {
			if qs, qsErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.QuotaSpecs, criteria.LabelSelector); qsErr == nil {
				(&istioConfigList.QuotaSpecs).Parse(qs)
			} else {
				errChan <- qsErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeQuotaSpecBindings {
			if qb, qbErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.QuotaSpecBindings, criteria.LabelSelector); qbErr == nil {
				(&istioConfigList.QuotaSpecBindings).Parse(qb)
			} else {
				errChan <- qbErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludePolicies {
			if pc, pcErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.Policies, criteria.LabelSelector); pcErr == nil {
				(&istioConfigList.Policies).Parse(pc)
			} else {
				errChan <- pcErr
			}
		}
	}(errChan)

	go func() {
		defer wg.Done()
		// MeshPeerAuthentications are not namespaced. They will be only listed for an Istio namespace.
		// Only listed in non Maistra environments.
		if criteria.IncludeMeshPolicies && config.IsIstioNamespace(criteria.Namespace) && !in.k8s.IsMaistraApi() {
			if mp, mpErr := in.k8s.GetIstioObjects("", kubernetes.MeshPolicies, criteria.LabelSelector); mpErr == nil {
				(&istioConfigList.MeshPolicies).Parse(mp)
			} else {
				// This query can return false if user doesn't have cluster permissions
				// On this case we log internally the error but we return an empty list
				checkForbidden("GetMeshPolicies", mpErr, "probably Kiali doesn't have cluster permissions")
			}
		}
	}()

	go func() {
		defer wg.Done()
		// ClusterRbacConfigs are not namespaced. They will be only listed for an Istio namespace.
		// Only listed in non Maistra environments.
		if criteria.IncludeClusterRbacConfigs && config.IsIstioNamespace(criteria.Namespace) && !in.k8s.IsMaistraApi() {
			if crc, crcErr := in.k8s.GetIstioObjects("", kubernetes.ClusterRbacConfigs, criteria.LabelSelector); crcErr == nil {
				(&istioConfigList.ClusterRbacConfigs).Parse(crc)
			} else {
				// This query can return false if user doesn't have cluster permissions
				// On this case we log internally the error but we return an empty list
				checkForbidden("GetClusterRbacConfigs", crcErr, "probably Kiali doesn't have cluster permissions")
			}
		}
	}()

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeRbacConfigs {
			if rc, rcErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.RbacConfigs, criteria.LabelSelector); rcErr == nil {
				(&istioConfigList.RbacConfigs).Parse(rc)
			} else {
				errChan <- rcErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeAuthorizationPolicies {
			if ap, apErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.AuthorizationPolicies, criteria.LabelSelector); apErr == nil {
				(&istioConfigList.AuthorizationPolicies).Parse(ap)
			} else {
				errChan <- apErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludePeerAuthentication {
			if pa, paErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.PeerAuthentications, criteria.LabelSelector); paErr == nil {
				(&istioConfigList.PeerAuthentications).Parse(pa)
			} else {
				errChan <- paErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeSidecars {
			if sc, scErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.Sidecars, criteria.LabelSelector); scErr == nil {
				(&istioConfigList.Sidecars).Parse(sc)
			} else {
				errChan <- scErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeServiceRoles {
			if sr, srErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.ServiceRoles, criteria.LabelSelector); srErr == nil {
				(&istioConfigList.ServiceRoles).Parse(sr)
			} else {
				errChan <- srErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeServiceRoleBindings {
			if srb, srbErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.ServiceRoleBindings, criteria.LabelSelector); srbErr == nil {
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
			if smp, smpErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.ServiceMeshPolicies, criteria.LabelSelector); smpErr == nil {
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
			if smrc, smrcErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.ServiceMeshRbacConfigs, criteria.LabelSelector); smrcErr == nil {
				(&istioConfigList.ServiceMeshRbacConfigs).Parse(smrc)
			} else {
				errChan <- smrcErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeWorkloadEntries {
			if we, weErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.WorkloadEntries, criteria.LabelSelector); weErr == nil {
				(&istioConfigList.WorkloadEntries).Parse(we)
			} else {
				errChan <- weErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeRequestAuthentications {
			if ra, raErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.RequestAuthentications, criteria.LabelSelector); raErr == nil {
				(&istioConfigList.RequestAuthentications).Parse(ra)
			} else {
				errChan <- raErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeEnvoyFilters {
			if ef, efErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.EnvoyFilters, criteria.LabelSelector); efErr == nil {
				(&istioConfigList.EnvoyFilters).Parse(ef)
			} else {
				errChan <- efErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeAttributeManifests {
			if am, amErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.AttributeManifests, criteria.LabelSelector); amErr == nil {
				(&istioConfigList.AttributeManifests).Parse(am)
			} else {
				errChan <- amErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeHttpApiSpecBindings {
			if hb, hbErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.HttpApiSpecBindings, criteria.LabelSelector); hbErr == nil {
				(&istioConfigList.HttpApiSpecBindings).Parse(hb)
			} else {
				errChan <- hbErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.IncludeHttpApiSpecs {
			if hs, hsErr := in.k8s.GetIstioObjects(criteria.Namespace, kubernetes.HttpApiSpecs, criteria.LabelSelector); hsErr == nil {
				(&istioConfigList.HttpApiSpecs).Parse(hs)
			} else {
				errChan <- hsErr
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
// - "object":			name of the configuration
func (in *IstioConfigService) GetIstioConfigDetails(namespace, objectType, object string) (models.IstioConfigDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "GetIstioConfigDetails")
	defer promtimer.ObserveNow(&err)

	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = objectType

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return istioConfigDetail, err
	}

	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		canCreate, canUpdate, canDelete := getPermissions(in.k8s, namespace, objectType)
		istioConfigDetail.Permissions = models.ResourcePermissions{
			Create: canCreate,
			Update: canUpdate,
			Delete: canDelete,
		}
	}()

	switch objectType {
	case kubernetes.Gateways:
		if gw, iErr := in.k8s.GetIstioObject(namespace, kubernetes.Gateways, object); iErr == nil {
			istioConfigDetail.Gateway = &models.Gateway{}
			istioConfigDetail.Gateway.Parse(gw)
		} else {
			err = iErr
		}
	case kubernetes.VirtualServices:
		if vs, iErr := in.k8s.GetIstioObject(namespace, kubernetes.VirtualServices, object); iErr == nil {
			istioConfigDetail.VirtualService = &models.VirtualService{}
			istioConfigDetail.VirtualService.Parse(vs)
		} else {
			err = iErr
		}
	case kubernetes.DestinationRules:
		if dr, iErr := in.k8s.GetIstioObject(namespace, kubernetes.DestinationRules, object); iErr == nil {
			istioConfigDetail.DestinationRule = &models.DestinationRule{}
			istioConfigDetail.DestinationRule.Parse(dr)
		} else {
			err = iErr
		}
	case kubernetes.ServiceEntries:
		if se, iErr := in.k8s.GetIstioObject(namespace, kubernetes.ServiceEntries, object); iErr == nil {
			istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
			istioConfigDetail.ServiceEntry.Parse(se)
		} else {
			err = iErr
		}
	case kubernetes.Sidecars:
		if sc, iErr := in.k8s.GetIstioObject(namespace, kubernetes.Sidecars, object); iErr == nil {
			istioConfigDetail.Sidecar = &models.Sidecar{}
			istioConfigDetail.Sidecar.Parse(sc)
		} else {
			err = iErr
		}
	case kubernetes.Rules:
		if r, iErr := in.k8s.GetIstioObject(namespace, kubernetes.Rules, object); iErr == nil {
			istioRule := models.CastIstioRule(r)
			istioConfigDetail.Rule = &istioRule
		} else {
			err = iErr
		}
	case kubernetes.Adapters:
		if a, iErr := in.k8s.GetIstioObject(namespace, kubernetes.Adapters, object); iErr == nil {
			adapter := models.CastIstioAdapter(a)
			istioConfigDetail.Adapter = &adapter
		} else {
			err = iErr
		}
	case kubernetes.Templates:
		if t, iErr := in.k8s.GetIstioObject(namespace, kubernetes.Templates, object); iErr == nil {
			template := models.CastIstioTemplate(t)
			istioConfigDetail.Template = &template
		} else {
			err = iErr
		}
	case kubernetes.Handlers:
		if h, iErr := in.k8s.GetIstioObject(namespace, kubernetes.Handlers, object); iErr == nil {
			handler := models.CastIstioHandler(h)
			istioConfigDetail.Handler = &handler
		} else {
			err = iErr
		}
	case kubernetes.Instances:
		if i, iErr := in.k8s.GetIstioObject(namespace, kubernetes.Instances, object); iErr == nil {
			instance := models.CastIstioInstance(i)
			istioConfigDetail.Instance = &instance
		} else {
			err = iErr
		}
	case kubernetes.QuotaSpecs:
		if qs, iErr := in.k8s.GetIstioObject(namespace, kubernetes.QuotaSpecs, object); iErr == nil {
			istioConfigDetail.QuotaSpec = &models.QuotaSpec{}
			istioConfigDetail.QuotaSpec.Parse(qs)
		} else {
			err = iErr
		}
	case kubernetes.QuotaSpecBindings:
		if qb, iErr := in.k8s.GetIstioObject(namespace, kubernetes.QuotaSpecBindings, object); iErr == nil {
			istioConfigDetail.QuotaSpecBinding = &models.QuotaSpecBinding{}
			istioConfigDetail.QuotaSpecBinding.Parse(qb)
		} else {
			err = iErr
		}
	case kubernetes.Policies:
		if pc, iErr := in.k8s.GetIstioObject(namespace, kubernetes.Policies, object); iErr == nil {
			istioConfigDetail.Policy = &models.Policy{}
			istioConfigDetail.Policy.Parse(pc)
		} else {
			err = iErr
		}
	case kubernetes.MeshPolicies:
		// MeshPeerAuthentications are not namespaced. They will be only listed for an Istio namespace.
		// Only listed in non Maistra environments.
		if config.IsIstioNamespace(namespace) {
			if mp, iErr := in.k8s.GetIstioObject("", kubernetes.MeshPolicies, object); iErr == nil {
				istioConfigDetail.MeshPolicy = &models.MeshPolicy{}
				istioConfigDetail.MeshPolicy.Parse(mp)
			} else {
				err = iErr
			}
		}
	case kubernetes.ServiceMeshPolicies:
		if mp, iErr := in.k8s.GetIstioObject(namespace, kubernetes.ServiceMeshPolicies, object); iErr == nil {
			istioConfigDetail.ServiceMeshPolicy = &models.ServiceMeshPolicy{}
			istioConfigDetail.ServiceMeshPolicy.Parse(mp)
		} else {
			err = iErr
		}
	case kubernetes.ClusterRbacConfigs:
		// ClusterRbacConfigs are not namespaced. They will be only listed for an istio namespace.
		// Only listed in non Maistra environments.
		if config.IsIstioNamespace(namespace) {
			if crc, iErr := in.k8s.GetIstioObject("", kubernetes.ClusterRbacConfigs, object); iErr == nil {
				istioConfigDetail.ClusterRbacConfig = &models.ClusterRbacConfig{}
				istioConfigDetail.ClusterRbacConfig.Parse(crc)
			} else {
				err = iErr
			}
		}
	case kubernetes.RbacConfigs:
		if rc, iErr := in.k8s.GetIstioObject(namespace, kubernetes.RbacConfigs, object); iErr == nil {
			istioConfigDetail.RbacConfig = &models.RbacConfig{}
			istioConfigDetail.RbacConfig.Parse(rc)
		} else {
			err = iErr
		}
	case kubernetes.ServiceMeshRbacConfigs:
		if rc, iErr := in.k8s.GetIstioObject(namespace, kubernetes.ServiceMeshRbacConfigs, object); iErr == nil {
			istioConfigDetail.ServiceMeshRbacConfig = &models.ServiceMeshRbacConfig{}
			istioConfigDetail.ServiceMeshRbacConfig.Parse(rc)
		} else {
			err = iErr
		}
	case kubernetes.ServiceRoles:
		if sr, iErr := in.k8s.GetIstioObject(namespace, kubernetes.ServiceRoles, object); iErr == nil {
			istioConfigDetail.ServiceRole = &models.ServiceRole{}
			istioConfigDetail.ServiceRole.Parse(sr)
		} else {
			err = iErr
		}
	case kubernetes.ServiceRoleBindings:
		if srb, iErr := in.k8s.GetIstioObject(namespace, kubernetes.ServiceRoleBindings, object); iErr == nil {
			istioConfigDetail.ServiceRoleBinding = &models.ServiceRoleBinding{}
			istioConfigDetail.ServiceRoleBinding.Parse(srb)
		} else {
			err = iErr
		}
	case kubernetes.AuthorizationPolicies:
		if ap, iErr := in.k8s.GetIstioObject(namespace, kubernetes.AuthorizationPolicies, object); iErr == nil {
			istioConfigDetail.AuthorizationPolicy = &models.AuthorizationPolicy{}
			istioConfigDetail.AuthorizationPolicy.Parse(ap)
		} else {
			err = iErr
		}
	case kubernetes.PeerAuthentications:
		if ap, iErr := in.k8s.GetIstioObject(namespace, kubernetes.PeerAuthentications, object); iErr == nil {
			istioConfigDetail.PeerAuthentication = &models.PeerAuthentication{}
			istioConfigDetail.PeerAuthentication.Parse(ap)
		} else {
			err = iErr
		}
	case kubernetes.WorkloadEntries:
		if we, iErr := in.k8s.GetIstioObject(namespace, kubernetes.WorkloadEntries, object); iErr == nil {
			istioConfigDetail.WorkloadEntry = &models.WorkloadEntry{}
			istioConfigDetail.WorkloadEntry.Parse(we)
		} else {
			err = iErr
		}
	case kubernetes.RequestAuthentications:
		if ra, iErr := in.k8s.GetIstioObject(namespace, kubernetes.RequestAuthentications, object); iErr == nil {
			istioConfigDetail.RequestAuthentication = &models.RequestAuthentication{}
			istioConfigDetail.RequestAuthentication.Parse(ra)
		} else {
			err = iErr
		}
	case kubernetes.EnvoyFilters:
		if ef, iErr := in.k8s.GetIstioObject(namespace, kubernetes.EnvoyFilters, object); iErr == nil {
			istioConfigDetail.EnvoyFilter = &models.EnvoyFilter{}
			istioConfigDetail.EnvoyFilter.Parse(ef)
		} else {
			err = iErr
		}
	case kubernetes.AttributeManifests:
		if am, iErr := in.k8s.GetIstioObject(namespace, kubernetes.AttributeManifests, object); iErr == nil {
			istioConfigDetail.AttributeManifest = &models.AttributeManifest{}
			istioConfigDetail.AttributeManifest.Parse(am)
		} else {
			err = iErr
		}
	case kubernetes.HttpApiSpecBindings:
		if hb, iErr := in.k8s.GetIstioObject(namespace, kubernetes.HttpApiSpecBindings, object); iErr == nil {
			istioConfigDetail.HttpApiSpecBinding = &models.HttpApiSpecBinding{}
			istioConfigDetail.HttpApiSpecBinding.Parse(hb)
		} else {
			err = iErr
		}
	case kubernetes.HttpApiSpecs:
		if hs, iErr := in.k8s.GetIstioObject(namespace, kubernetes.HttpApiSpecs, object); iErr == nil {
			istioConfigDetail.HttpApiSpec = &models.HttpApiSpec{}
			istioConfigDetail.HttpApiSpec.Parse(hs)
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
	return kubernetes.ResourceTypesToAPI[resourceType]
}

// ParseJsonForCreate checks if a json is well formed according resourceType
// It returns a json validated to be used in the Create operation, or an error to report in the handler layer.
func (in *IstioConfigService) ParseJsonForCreate(resourceType string, body []byte) (string, error) {
	var err error
	istioConfigDetail := models.IstioConfigDetails{}
	apiVersion := kubernetes.ApiToVersion[kubernetes.ResourceTypesToAPI[resourceType]]
	var kind string
	var marshalled string
	kind = kubernetes.PluralType[resourceType]
	switch resourceType {
	case kubernetes.Gateways:
		istioConfigDetail.Gateway = &models.Gateway{}
		err = json.Unmarshal(body, istioConfigDetail.Gateway)
	case kubernetes.VirtualServices:
		istioConfigDetail.VirtualService = &models.VirtualService{}
		err = json.Unmarshal(body, istioConfigDetail.VirtualService)
	case kubernetes.DestinationRules:
		istioConfigDetail.DestinationRule = &models.DestinationRule{}
		err = json.Unmarshal(body, istioConfigDetail.DestinationRule)
	case kubernetes.ServiceEntries:
		istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
		err = json.Unmarshal(body, istioConfigDetail.ServiceEntry)
	case kubernetes.Sidecars:
		istioConfigDetail.Sidecar = &models.Sidecar{}
		err = json.Unmarshal(body, istioConfigDetail.Sidecar)
	case kubernetes.Rules:
		istioConfigDetail.Rule = &models.IstioRule{}
		err = json.Unmarshal(body, istioConfigDetail.Rule)
	case kubernetes.Adapters:
		istioConfigDetail.Adapter = &models.IstioAdapter{}
		err = json.Unmarshal(body, istioConfigDetail.Adapter)
	case kubernetes.Templates:
		istioConfigDetail.Template = &models.IstioTemplate{}
		err = json.Unmarshal(body, istioConfigDetail.Template)
	case kubernetes.Handlers:
		istioConfigDetail.Handler = &models.IstioHandler{}
		err = json.Unmarshal(body, istioConfigDetail.Handler)
	case kubernetes.Instances:
		istioConfigDetail.Instance = &models.IstioInstance{}
		err = json.Unmarshal(body, istioConfigDetail.Instance)
	case kubernetes.QuotaSpecs:
		istioConfigDetail.QuotaSpec = &models.QuotaSpec{}
		err = json.Unmarshal(body, istioConfigDetail.QuotaSpec)
	case kubernetes.QuotaSpecBindings:
		istioConfigDetail.QuotaSpecBinding = &models.QuotaSpecBinding{}
		err = json.Unmarshal(body, istioConfigDetail.QuotaSpecBinding)
	case kubernetes.Policies:
		istioConfigDetail.Policy = &models.Policy{}
		err = json.Unmarshal(body, istioConfigDetail.Policy)
	case kubernetes.MeshPolicies:
		istioConfigDetail.MeshPolicy = &models.MeshPolicy{}
		err = json.Unmarshal(body, istioConfigDetail.MeshPolicy)
	case kubernetes.ServiceMeshPolicies:
		istioConfigDetail.ServiceMeshPolicy = &models.ServiceMeshPolicy{}
		err = json.Unmarshal(body, istioConfigDetail.ServiceMeshPolicy)
	case kubernetes.ServiceMeshRbacConfigs:
		istioConfigDetail.ServiceMeshRbacConfig = &models.ServiceMeshRbacConfig{}
		err = json.Unmarshal(body, istioConfigDetail.ServiceMeshRbacConfig)
	case kubernetes.AuthorizationPolicies:
		istioConfigDetail.AuthorizationPolicy = &models.AuthorizationPolicy{}
		err = json.Unmarshal(body, istioConfigDetail.AuthorizationPolicy)
	case kubernetes.PeerAuthentications:
		istioConfigDetail.PeerAuthentication = &models.PeerAuthentication{}
		err = json.Unmarshal(body, istioConfigDetail.PeerAuthentication)
	case kubernetes.RequestAuthentications:
		istioConfigDetail.RequestAuthentication = &models.RequestAuthentication{}
		err = json.Unmarshal(body, istioConfigDetail.RequestAuthentication)
	default:
		err = fmt.Errorf("object type not found: %v", resourceType)
	}
	// Validation object against the scheme
	if err != nil {
		return "", err
	}
	var generic map[string]interface{}
	err = json.Unmarshal(body, &generic)
	if err != nil {
		return "", err
	}

	util.RemoveNilValues(generic)

	var marshalledBytes []byte
	marshalledBytes, err = json.Marshal(generic)
	if err != nil {
		return "", err
	}

	// Append apiVersion and kind
	marshalled = string(marshalledBytes)
	marshalled = strings.TrimSpace(marshalled)
	marshalled = "" +
		"{\n" +
		"\"kind\": \"" + kind + "\",\n" +
		"\"apiVersion\": \"" + apiVersion + "\"," +
		marshalled[1:]

	return marshalled, nil
}

// DeleteIstioConfigDetail deletes the given Istio resource
func (in *IstioConfigService) DeleteIstioConfigDetail(api, namespace, resourceType, name string) (err error) {
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "DeleteIstioConfigDetail")
	defer promtimer.ObserveNow(&err)

	err = in.k8s.DeleteIstioObject(api, namespace, resourceType, name)

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiCache != nil && err == nil {
		kialiCache.RefreshNamespace(namespace)
	}
	return err
}

func (in *IstioConfigService) UpdateIstioConfigDetail(api, namespace, resourceType, name, jsonPatch string) (models.IstioConfigDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "UpdateIstioConfigDetail")
	defer promtimer.ObserveNow(&err)

	return in.modifyIstioConfigDetail(api, namespace, resourceType, name, jsonPatch, false)
}

func (in *IstioConfigService) modifyIstioConfigDetail(api, namespace, resourceType, name, json string, create bool) (models.IstioConfigDetails, error) {
	var err error
	updatedType := resourceType

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
	case kubernetes.Gateways:
		istioConfigDetail.Gateway = &models.Gateway{}
		istioConfigDetail.Gateway.Parse(result)
	case kubernetes.VirtualServices:
		istioConfigDetail.VirtualService = &models.VirtualService{}
		istioConfigDetail.VirtualService.Parse(result)
	case kubernetes.DestinationRules:
		istioConfigDetail.DestinationRule = &models.DestinationRule{}
		istioConfigDetail.DestinationRule.Parse(result)
	case kubernetes.ServiceEntries:
		istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
		istioConfigDetail.ServiceEntry.Parse(result)
	case kubernetes.Sidecars:
		istioConfigDetail.Sidecar = &models.Sidecar{}
		istioConfigDetail.Sidecar.Parse(result)
	case kubernetes.Rules:
		istioRule := models.CastIstioRule(result)
		istioConfigDetail.Rule = &istioRule
	case kubernetes.Adapters:
		adapter := models.CastIstioAdapter(result)
		istioConfigDetail.Adapter = &adapter
	case kubernetes.Templates:
		template := models.CastIstioTemplate(result)
		istioConfigDetail.Template = &template
	case kubernetes.Handlers:
		handler := models.CastIstioHandler(result)
		istioConfigDetail.Handler = &handler
	case kubernetes.Instances:
		instance := models.CastIstioInstance(result)
		istioConfigDetail.Instance = &instance
	case kubernetes.QuotaSpecs:
		istioConfigDetail.QuotaSpec = &models.QuotaSpec{}
		istioConfigDetail.QuotaSpec.Parse(result)
	case kubernetes.QuotaSpecBindings:
		istioConfigDetail.QuotaSpecBinding = &models.QuotaSpecBinding{}
		istioConfigDetail.QuotaSpecBinding.Parse(result)
	case kubernetes.Policies:
		istioConfigDetail.Policy = &models.Policy{}
		istioConfigDetail.Policy.Parse(result)
	case kubernetes.MeshPolicies:
		istioConfigDetail.MeshPolicy = &models.MeshPolicy{}
		istioConfigDetail.MeshPolicy.Parse(result)
	case kubernetes.ServiceMeshPolicies:
		istioConfigDetail.ServiceMeshPolicy = &models.ServiceMeshPolicy{}
		istioConfigDetail.ServiceMeshPolicy.Parse(result)
	case kubernetes.ClusterRbacConfigs:
		istioConfigDetail.ClusterRbacConfig = &models.ClusterRbacConfig{}
		istioConfigDetail.ClusterRbacConfig.Parse(result)
	case kubernetes.RbacConfigs:
		istioConfigDetail.RbacConfig = &models.RbacConfig{}
		istioConfigDetail.RbacConfig.Parse(result)
	case kubernetes.AuthorizationPolicies:
		istioConfigDetail.AuthorizationPolicy = &models.AuthorizationPolicy{}
		istioConfigDetail.AuthorizationPolicy.Parse(result)
	case kubernetes.ServiceMeshRbacConfigs:
		istioConfigDetail.ServiceMeshRbacConfig = &models.ServiceMeshRbacConfig{}
		istioConfigDetail.ServiceMeshRbacConfig.Parse(result)
	case kubernetes.ServiceRoles:
		istioConfigDetail.ServiceRole = &models.ServiceRole{}
		istioConfigDetail.ServiceRole.Parse(result)
	case kubernetes.ServiceRoleBindings:
		istioConfigDetail.ServiceRoleBinding = &models.ServiceRoleBinding{}
		istioConfigDetail.ServiceRoleBinding.Parse(result)
	case kubernetes.PeerAuthentications:
		istioConfigDetail.PeerAuthentication = &models.PeerAuthentication{}
		istioConfigDetail.PeerAuthentication.Parse(result)
	case kubernetes.RequestAuthentications:
		istioConfigDetail.RequestAuthentication = &models.RequestAuthentication{}
		istioConfigDetail.RequestAuthentication.Parse(result)
	case kubernetes.WorkloadEntries:
		istioConfigDetail.WorkloadEntry = &models.WorkloadEntry{}
		istioConfigDetail.WorkloadEntry.Parse(result)
	case kubernetes.EnvoyFilters:
		istioConfigDetail.EnvoyFilter = &models.EnvoyFilter{}
		istioConfigDetail.EnvoyFilter.Parse(result)
	case kubernetes.AttributeManifests:
		istioConfigDetail.AttributeManifest = &models.AttributeManifest{}
		istioConfigDetail.AttributeManifest.Parse(result)
	case kubernetes.HttpApiSpecs:
		istioConfigDetail.HttpApiSpec = &models.HttpApiSpec{}
		istioConfigDetail.HttpApiSpec.Parse(result)
	case kubernetes.HttpApiSpecBindings:
		istioConfigDetail.HttpApiSpecBinding = &models.HttpApiSpecBinding{}
		istioConfigDetail.HttpApiSpecBinding.Parse(result)
	default:
		err = fmt.Errorf("object type not found: %v", resourceType)
	}
	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiCache != nil && err == nil {
		kialiCache.RefreshNamespace(namespace)
	}
	return istioConfigDetail, err
}

func (in *IstioConfigService) CreateIstioConfigDetail(api, namespace, resourceType string, body []byte) (models.IstioConfigDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "CreateIstioConfigDetail")
	defer promtimer.ObserveNow(&err)

	json, err := in.ParseJsonForCreate(resourceType, body)
	if err != nil {
		return models.IstioConfigDetails{}, errors2.NewBadRequest(err.Error())
	}
	return in.modifyIstioConfigDetail(api, namespace, resourceType, "", json, true)
}

func (in *IstioConfigService) GeIstioConfigPermissions(namespaces []string) models.IstioConfigPermissions {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "GeIstioConfigPermissions")
	defer promtimer.ObserveNow(&err)

	istioConfigPermissions := make(models.IstioConfigPermissions, len(namespaces))

	if len(namespaces) > 0 {
		wg := sync.WaitGroup{}
		wg.Add(len(namespaces) * len(newIstioConfigTypes))
		for _, ns := range namespaces {
			resourcePermissions := make(models.ResourcesPermissions, len(newIstioConfigTypes))
			for _, rs := range newIstioConfigTypes {
				resourcePermissions[rs] = &models.ResourcePermissions{
					Create: false,
					Update: false,
					Delete: false,
				}
				go func(namespace, resource string, permissions *models.ResourcePermissions, wg *sync.WaitGroup) {
					defer wg.Done()
					permissions.Create, permissions.Update, permissions.Delete = getPermissions(in.k8s, namespace, resource)
				}(ns, rs, resourcePermissions[rs], &wg)
			}
			istioConfigPermissions[ns] = &resourcePermissions
		}
		wg.Wait()
	}
	return istioConfigPermissions
}

func getPermissions(k8s kubernetes.ClientInterface, namespace, objectType string) (bool, bool, bool) {
	var canCreate, canPatch, canUpdate, canDelete bool
	if api, ok := kubernetes.ResourceTypesToAPI[objectType]; ok {
		resourceType := objectType
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

func checkType(types []string, name string) bool {
	for _, typeName := range types {
		if typeName == name {
			return true
		}
	}
	return false
}

func ParseIstioConfigCriteria(namespace string, objects string, labelSelector string) IstioConfigCriteria {
	defaultInclude := objects == ""
	criteria := IstioConfigCriteria{}
	criteria.Namespace = namespace
	criteria.IncludeGateways = defaultInclude
	criteria.IncludeVirtualServices = defaultInclude
	criteria.IncludeDestinationRules = defaultInclude
	criteria.IncludeServiceEntries = defaultInclude
	criteria.IncludeRules = defaultInclude
	criteria.IncludeAdapters = defaultInclude
	criteria.IncludeTemplates = defaultInclude
	criteria.IncludeHandlers = defaultInclude
	criteria.IncludeInstances = defaultInclude
	criteria.IncludeQuotaSpecs = defaultInclude
	criteria.IncludeQuotaSpecBindings = defaultInclude
	criteria.IncludePolicies = defaultInclude
	criteria.IncludeMeshPolicies = defaultInclude
	criteria.IncludeServiceMeshPolicies = defaultInclude
	criteria.IncludeClusterRbacConfigs = defaultInclude
	criteria.IncludeRbacConfigs = defaultInclude
	criteria.IncludeServiceMeshRbacConfigs = defaultInclude
	criteria.IncludeServiceRoles = defaultInclude
	criteria.IncludeServiceRoleBindings = defaultInclude
	criteria.IncludeSidecars = defaultInclude
	criteria.IncludeAuthorizationPolicies = defaultInclude
	criteria.IncludePeerAuthentication = defaultInclude
	criteria.IncludeWorkloadEntries = defaultInclude
	criteria.IncludeRequestAuthentications = defaultInclude
	criteria.IncludeEnvoyFilters = defaultInclude
	criteria.IncludeAttributeManifests = defaultInclude
	criteria.IncludeHttpApiSpecBindings = defaultInclude
	criteria.IncludeHttpApiSpecs = defaultInclude
	criteria.LabelSelector = labelSelector

	if defaultInclude {
		return criteria
	}

	types := strings.Split(objects, ",")
	if checkType(types, kubernetes.Gateways) {
		criteria.IncludeGateways = true
	}
	if checkType(types, kubernetes.VirtualServices) {
		criteria.IncludeVirtualServices = true
	}
	if checkType(types, kubernetes.DestinationRules) {
		criteria.IncludeDestinationRules = true
	}
	if checkType(types, kubernetes.ServiceEntries) {
		criteria.IncludeServiceEntries = true
	}
	if checkType(types, kubernetes.Rules) {
		criteria.IncludeRules = true
	}
	if checkType(types, kubernetes.Adapters) {
		criteria.IncludeAdapters = true
	}
	if checkType(types, kubernetes.Templates) {
		criteria.IncludeTemplates = true
	}
	if checkType(types, kubernetes.Handlers) {
		criteria.IncludeHandlers = true
	}
	if checkType(types, kubernetes.Instances) {
		criteria.IncludeInstances = true
	}
	if checkType(types, kubernetes.QuotaSpecs) {
		criteria.IncludeQuotaSpecs = true
	}
	if checkType(types, kubernetes.QuotaSpecBindings) {
		criteria.IncludeQuotaSpecBindings = true
	}
	if checkType(types, kubernetes.Policies) {
		criteria.IncludePolicies = true
	}
	if checkType(types, kubernetes.MeshPolicies) {
		criteria.IncludeMeshPolicies = true
	}
	if checkType(types, kubernetes.ServiceMeshPolicies) {
		criteria.IncludeServiceMeshPolicies = true
	}
	if checkType(types, kubernetes.ClusterRbacConfigs) {
		criteria.IncludeClusterRbacConfigs = true
	}
	if checkType(types, kubernetes.RbacConfigs) {
		criteria.IncludeRbacConfigs = true
	}
	if checkType(types, kubernetes.ServiceMeshRbacConfigs) {
		criteria.IncludeServiceMeshRbacConfigs = true
	}
	if checkType(types, kubernetes.ServiceRoles) {
		criteria.IncludeServiceRoles = true
	}
	if checkType(types, kubernetes.ServiceRoleBindings) {
		criteria.IncludeServiceRoleBindings = true
	}
	if checkType(types, kubernetes.Sidecars) {
		criteria.IncludeSidecars = true
	}
	if checkType(types, kubernetes.AuthorizationPolicies) {
		criteria.IncludeAuthorizationPolicies = true
	}
	if checkType(types, kubernetes.PeerAuthentications) {
		criteria.IncludePeerAuthentication = true
	}
	if checkType(types, kubernetes.WorkloadEntries) {
		criteria.IncludeWorkloadEntries = true
	}
	if checkType(types, kubernetes.RequestAuthentications) {
		criteria.IncludeRequestAuthentications = true
	}
	if checkType(types, kubernetes.EnvoyFilters) {
		criteria.IncludeEnvoyFilters = true
	}
	if checkType(types, kubernetes.AttributeManifests) {
		criteria.IncludeAttributeManifests = true
	}
	if checkType(types, kubernetes.HttpApiSpecBindings) {
		criteria.IncludeHttpApiSpecBindings = true
	}
	if checkType(types, kubernetes.HttpApiSpecs) {
		criteria.IncludeHttpApiSpecs = true
	}
	return criteria
}
