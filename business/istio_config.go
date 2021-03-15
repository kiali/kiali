package business

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	errors2 "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/util"
)

type IstioConfigService struct {
	kubeK8s       kubernetes.KubeClientInterface
	meshK8s       kubernetes.MeshClientInterface
	businessLayer *Layer
}

type IstioConfigCriteria struct {
	Namespace                     string
	IncludeGateways               bool
	IncludeVirtualServices        bool
	IncludeDestinationRules       bool
	IncludeServiceEntries         bool
	IncludeSidecars               bool
	IncludeAuthorizationPolicies  bool
	IncludePeerAuthentications    bool
	IncludeWorkloadEntries        bool
	IncludeRequestAuthentications bool
	IncludeEnvoyFilters           bool
	LabelSelector                 string
	WorkloadSelector              string
}

func (icc IstioConfigCriteria) Include(resource string) bool {
	// Flag used to skip object that are not used in a query when a WorkloadSelector is present
	isWorkloadSelector := icc.WorkloadSelector != ""
	switch resource {
	case kubernetes.Gateways:
		return icc.IncludeGateways
	case kubernetes.VirtualServices:
		return icc.IncludeVirtualServices && !isWorkloadSelector
	case kubernetes.DestinationRules:
		return icc.IncludeDestinationRules && !isWorkloadSelector
	case kubernetes.ServiceEntries:
		return icc.IncludeServiceEntries && !isWorkloadSelector
	case kubernetes.Sidecars:
		return icc.IncludeSidecars
	case kubernetes.AuthorizationPolicies:
		return icc.IncludeAuthorizationPolicies
	case kubernetes.PeerAuthentications:
		return icc.IncludePeerAuthentications
	case kubernetes.WorkloadEntries:
		return icc.IncludeWorkloadEntries && !isWorkloadSelector
	case kubernetes.RequestAuthentications:
		return icc.IncludeRequestAuthentications
	case kubernetes.EnvoyFilters:
		return icc.IncludeEnvoyFilters
	}
	return false
}

// IstioConfig types used in the IstioConfig New Page Form
var newIstioConfigTypes = []string{
	kubernetes.AuthorizationPolicies,
	kubernetes.Sidecars,
	kubernetes.Gateways,
	kubernetes.PeerAuthentications,
	kubernetes.RequestAuthentications,
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
		Sidecars:               models.Sidecars{},
		AuthorizationPolicies:  models.AuthorizationPolicies{},
		PeerAuthentications:    models.PeerAuthentications{},
		WorkloadEntries:        models.WorkloadEntries{},
		RequestAuthentications: models.RequestAuthentications{},
		EnvoyFilters:           models.EnvoyFilters{},
	}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespace(criteria.Namespace); err != nil {
		return models.IstioConfigList{}, err
	}

	isWorkloadSelector := criteria.WorkloadSelector != ""
	workloadSelector := ""
	if isWorkloadSelector {
		workloadSelector = criteria.WorkloadSelector
	}

	errChan := make(chan error, 10)

	var wg sync.WaitGroup
	wg.Add(10)

	m := in.meshK8s
	go func(errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.Gateways) {
			var gg []kubernetes.IstioObject
			var ggErr error
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.Gateways) {
				gg, ggErr = kialiMeshCache.GetIstioObjects(criteria.Namespace, kubernetes.Gateways, criteria.LabelSelector)
			} else {
				gg, ggErr = m.GetIstioObjects(criteria.Namespace, kubernetes.Gateways, criteria.LabelSelector)
			}
			if ggErr == nil {
				if isWorkloadSelector {
					gg = kubernetes.FilterIstioObjectsForWorkloadSelector(workloadSelector, gg)
				}
				(&istioConfigList.Gateways).Parse(gg)
			} else {
				errChan <- ggErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.VirtualServices) {
			var vs []kubernetes.IstioObject
			var vsErr error
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.VirtualServices) {
				vs, vsErr = kialiMeshCache.GetIstioObjects(criteria.Namespace, kubernetes.VirtualServices, criteria.LabelSelector)
			} else {
				vs, vsErr = m.GetIstioObjects(criteria.Namespace, kubernetes.VirtualServices, criteria.LabelSelector)
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
		if criteria.Include(kubernetes.DestinationRules) {
			var dr []kubernetes.IstioObject
			var drErr error
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.DestinationRules) {
				dr, drErr = kialiMeshCache.GetIstioObjects(criteria.Namespace, kubernetes.DestinationRules, criteria.LabelSelector)
			} else {
				dr, drErr = m.GetIstioObjects(criteria.Namespace, kubernetes.DestinationRules, criteria.LabelSelector)
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
		if criteria.Include(kubernetes.ServiceEntries) {
			var se []kubernetes.IstioObject
			var seErr error
			// Check if namespace is cached
			if IsResourceCached(criteria.Namespace, kubernetes.ServiceEntries) {
				se, seErr = kialiMeshCache.GetIstioObjects(criteria.Namespace, kubernetes.ServiceEntries, criteria.LabelSelector)
			} else {
				se, seErr = m.GetIstioObjects(criteria.Namespace, kubernetes.ServiceEntries, criteria.LabelSelector)
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
		if criteria.Include(kubernetes.AuthorizationPolicies) {
			var ap []kubernetes.IstioObject
			var apErr error
			if IsResourceCached(criteria.Namespace, kubernetes.AuthorizationPolicies) {
				ap, apErr = kialiMeshCache.GetIstioObjects(criteria.Namespace, kubernetes.AuthorizationPolicies, criteria.LabelSelector)
			} else {
				ap, apErr = m.GetIstioObjects(criteria.Namespace, kubernetes.AuthorizationPolicies, criteria.LabelSelector)
			}
			if apErr == nil {
				if isWorkloadSelector {
					ap = kubernetes.FilterIstioObjectsForWorkloadSelector(workloadSelector, ap)
				}
				(&istioConfigList.AuthorizationPolicies).Parse(ap)
			} else {
				errChan <- apErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.PeerAuthentications) {
			var pa []kubernetes.IstioObject
			var paErr error
			if IsResourceCached(criteria.Namespace, kubernetes.PeerAuthentications) {
				pa, paErr = kialiMeshCache.GetIstioObjects(criteria.Namespace, kubernetes.PeerAuthentications, criteria.LabelSelector)
			} else {
				pa, paErr = m.GetIstioObjects(criteria.Namespace, kubernetes.PeerAuthentications, criteria.LabelSelector)
			}
			if paErr == nil {
				if isWorkloadSelector {
					pa = kubernetes.FilterIstioObjectsForWorkloadSelector(workloadSelector, pa)
				}
				(&istioConfigList.PeerAuthentications).Parse(pa)
			} else {
				errChan <- paErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.Sidecars) {
			var sc []kubernetes.IstioObject
			var scErr error
			if IsResourceCached(criteria.Namespace, kubernetes.Sidecars) {
				sc, scErr = kialiMeshCache.GetIstioObjects(criteria.Namespace, kubernetes.Sidecars, criteria.LabelSelector)
			} else {
				sc, scErr = m.GetIstioObjects(criteria.Namespace, kubernetes.Sidecars, criteria.LabelSelector)
			}
			if scErr == nil {
				if isWorkloadSelector {
					sc = kubernetes.FilterIstioObjectsForWorkloadSelector(workloadSelector, sc)
				}
				(&istioConfigList.Sidecars).Parse(sc)
			} else {
				errChan <- scErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.WorkloadEntries) {
			if we, weErr := m.GetIstioObjects(criteria.Namespace, kubernetes.WorkloadEntries, criteria.LabelSelector); weErr == nil {
				(&istioConfigList.WorkloadEntries).Parse(we)
			} else {
				errChan <- weErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.RequestAuthentications) {
			var ra []kubernetes.IstioObject
			var raErr error
			if IsResourceCached(criteria.Namespace, kubernetes.RequestAuthentications) {
				ra, raErr = kialiMeshCache.GetIstioObjects(criteria.Namespace, kubernetes.RequestAuthentications, criteria.LabelSelector)
			} else {
				ra, raErr = m.GetIstioObjects(criteria.Namespace, kubernetes.RequestAuthentications, criteria.LabelSelector)
			}
			if raErr == nil {
				if isWorkloadSelector {
					ra = kubernetes.FilterIstioObjectsForWorkloadSelector(workloadSelector, ra)
				}
				(&istioConfigList.RequestAuthentications).Parse(ra)
			} else {
				errChan <- raErr
			}
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if criteria.Include(kubernetes.EnvoyFilters) {
			if ef, efErr := m.GetIstioObjects(criteria.Namespace, kubernetes.EnvoyFilters, criteria.LabelSelector); efErr == nil {
				if isWorkloadSelector {
					ef = kubernetes.FilterIstioObjectsForWorkloadSelector(workloadSelector, ef)
				}
				(&istioConfigList.EnvoyFilters).Parse(ef)
			} else {
				errChan <- efErr
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
		canCreate, canUpdate, canDelete := getPermissions(in.kubeK8s, namespace, objectType)
		istioConfigDetail.Permissions = models.ResourcePermissions{
			Create: canCreate,
			Update: canUpdate,
			Delete: canDelete,
		}
	}()

	switch objectType {
	case kubernetes.Gateways:
		if gw, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.Gateways, object); iErr == nil {
			istioConfigDetail.Gateway = &models.Gateway{}
			istioConfigDetail.Gateway.Parse(gw)
		} else {
			err = iErr
		}
	case kubernetes.VirtualServices:
		if vs, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.VirtualServices, object); iErr == nil {
			istioConfigDetail.VirtualService = &models.VirtualService{}
			istioConfigDetail.VirtualService.Parse(vs)
		} else {
			err = iErr
		}
	case kubernetes.DestinationRules:
		if dr, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.DestinationRules, object); iErr == nil {
			istioConfigDetail.DestinationRule = &models.DestinationRule{}
			istioConfigDetail.DestinationRule.Parse(dr)
		} else {
			err = iErr
		}
	case kubernetes.ServiceEntries:
		if se, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.ServiceEntries, object); iErr == nil {
			istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
			istioConfigDetail.ServiceEntry.Parse(se)
		} else {
			err = iErr
		}
	case kubernetes.Sidecars:
		if sc, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.Sidecars, object); iErr == nil {
			istioConfigDetail.Sidecar = &models.Sidecar{}
			istioConfigDetail.Sidecar.Parse(sc)
		} else {
			err = iErr
		}
	case kubernetes.AuthorizationPolicies:
		if ap, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.AuthorizationPolicies, object); iErr == nil {
			istioConfigDetail.AuthorizationPolicy = &models.AuthorizationPolicy{}
			istioConfigDetail.AuthorizationPolicy.Parse(ap)
		} else {
			err = iErr
		}
	case kubernetes.PeerAuthentications:
		if ap, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.PeerAuthentications, object); iErr == nil {
			istioConfigDetail.PeerAuthentication = &models.PeerAuthentication{}
			istioConfigDetail.PeerAuthentication.Parse(ap)
		} else {
			err = iErr
		}
	case kubernetes.WorkloadEntries:
		if we, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.WorkloadEntries, object); iErr == nil {
			istioConfigDetail.WorkloadEntry = &models.WorkloadEntry{}
			istioConfigDetail.WorkloadEntry.Parse(we)
		} else {
			err = iErr
		}
	case kubernetes.RequestAuthentications:
		if ra, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.RequestAuthentications, object); iErr == nil {
			istioConfigDetail.RequestAuthentication = &models.RequestAuthentication{}
			istioConfigDetail.RequestAuthentication.Parse(ra)
		} else {
			err = iErr
		}
	case kubernetes.EnvoyFilters:
		if ef, iErr := in.meshK8s.GetIstioObject(namespace, kubernetes.EnvoyFilters, object); iErr == nil {
			istioConfigDetail.EnvoyFilter = &models.EnvoyFilter{}
			istioConfigDetail.EnvoyFilter.Parse(ef)
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

	err = in.meshK8s.DeleteIstioObject(api, namespace, resourceType, name)

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiMeshCache != nil && err == nil {
		kialiMeshCache.RefreshNamespace(namespace)
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
		result, err = in.meshK8s.CreateIstioObject(api, namespace, updatedType, json)
	} else {
		// Update/Path existing object
		result, err = in.meshK8s.UpdateIstioObject(api, namespace, updatedType, name, json)
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
	case kubernetes.AuthorizationPolicies:
		istioConfigDetail.AuthorizationPolicy = &models.AuthorizationPolicy{}
		istioConfigDetail.AuthorizationPolicy.Parse(result)
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
	default:
		err = fmt.Errorf("object type not found: %v", resourceType)
	}
	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiMeshCache != nil && err == nil {
		kialiMeshCache.RefreshNamespace(namespace)
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

func (in *IstioConfigService) GetIstioConfigPermissions(namespaces []string) models.IstioConfigPermissions {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioConfigService", "GetIstioConfigPermissions")
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
					permissions.Create, permissions.Update, permissions.Delete = getPermissions(in.kubeK8s, namespace, resource)
				}(ns, rs, resourcePermissions[rs], &wg)
			}
			istioConfigPermissions[ns] = &resourcePermissions
		}
		wg.Wait()
	}
	return istioConfigPermissions
}

func getPermissions(k8s kubernetes.KubeClientInterface, namespace, objectType string) (bool, bool, bool) {
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

func ParseIstioConfigCriteria(namespace, objects, labelSelector, workloadSelector string) IstioConfigCriteria {
	defaultInclude := objects == ""
	criteria := IstioConfigCriteria{}
	criteria.Namespace = namespace
	criteria.IncludeGateways = defaultInclude
	criteria.IncludeVirtualServices = defaultInclude
	criteria.IncludeDestinationRules = defaultInclude
	criteria.IncludeServiceEntries = defaultInclude
	criteria.IncludeSidecars = defaultInclude
	criteria.IncludeAuthorizationPolicies = defaultInclude
	criteria.IncludePeerAuthentications = defaultInclude
	criteria.IncludeWorkloadEntries = defaultInclude
	criteria.IncludeRequestAuthentications = defaultInclude
	criteria.IncludeEnvoyFilters = defaultInclude
	criteria.LabelSelector = labelSelector
	criteria.WorkloadSelector = workloadSelector

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
	if checkType(types, kubernetes.Sidecars) {
		criteria.IncludeSidecars = true
	}
	if checkType(types, kubernetes.AuthorizationPolicies) {
		criteria.IncludeAuthorizationPolicies = true
	}
	if checkType(types, kubernetes.PeerAuthentications) {
		criteria.IncludePeerAuthentications = true
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
	return criteria
}
