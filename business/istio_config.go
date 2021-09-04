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
	"github.com/kiali/kiali/util"
)

const allResources string = "*"

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
	IncludeSidecars               bool
	IncludeAuthorizationPolicies  bool
	IncludePeerAuthentications    bool
	IncludeWorkloadEntries        bool
	IncludeWorkloadGroups         bool
	IncludeRequestAuthentications bool
	IncludeEnvoyFilters           bool
	LabelSelector                 string
	WorkloadSelector              string
}

type IstioResourceObject struct {
	ObjectType   string
	IstioObjects []kubernetes.IstioObject
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
	case kubernetes.WorkloadGroups:
		return icc.IncludeWorkloadGroups && !isWorkloadSelector
	case kubernetes.RequestAuthentications:
		return icc.IncludeRequestAuthentications
	case kubernetes.EnvoyFilters:
		return icc.IncludeEnvoyFilters
	}
	return false
}

// IstioConfig types used in the IstioConfig New Page Form
// networking.istio.io
var newNetworkingConfigTypes = []string{
	kubernetes.Sidecars,
	kubernetes.Gateways,
	kubernetes.ServiceEntries,
}

// security.istio.io
var newSecurityConfigTypes = []string{
	kubernetes.AuthorizationPolicies,
	kubernetes.PeerAuthentications,
	kubernetes.RequestAuthentications,
}

func (in *IstioConfigService) GetIstioObjects(
	criteria IstioConfigCriteria, resourceType string,
	wg *sync.WaitGroup, errChan chan error, istioResourceObject chan *IstioResourceObject,
) {
	defer wg.Done()

	if !criteria.Include(resourceType) {
		return
	}
	nameSpace := criteria.Namespace
	labelSelector := criteria.LabelSelector

	var ob []kubernetes.IstioObject
	var err error

	// Check if namespace is cached
	if IsResourceCached(nameSpace, resourceType) {
		ob, err = kialiCache.GetIstioObjects(nameSpace, resourceType, labelSelector)
	} else {
		ob, err = in.k8s.GetIstioObjects(nameSpace, resourceType, labelSelector)
	}
	if err != nil {
		errChan <- err
		return
	}

	istioObject := &IstioResourceObject{
		ObjectType:   resourceType,
		IstioObjects: ob,
	}
	istioResourceObject <- istioObject
	return
}

// GetIstioConfigList returns a list of Istio routing objects, Mixer Rules, (etc.)
// per a given Namespace.
func (in *IstioConfigService) GetIstioConfigList(criteria IstioConfigCriteria) (models.IstioConfigList, error) {
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
		WorkloadGroups:         models.WorkloadGroups{},
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

	objectTypes := []string{
		kubernetes.Gateways,
		kubernetes.VirtualServices,
		kubernetes.DestinationRules,
		kubernetes.ServiceEntries,
		kubernetes.AuthorizationPolicies,
		kubernetes.PeerAuthentications,
		kubernetes.Sidecars,
		kubernetes.WorkloadEntries,
		kubernetes.WorkloadGroups,
		kubernetes.RequestAuthentications,
		kubernetes.EnvoyFilters,
	}

	var wg sync.WaitGroup
	errChan := make(chan error, len(objectTypes))
	istioObjectChan := make(chan *IstioResourceObject, len(objectTypes))

	for _, item := range objectTypes {
		resourceType := item
		wg.Add(1)
		go in.GetIstioObjects(criteria, resourceType, &wg, errChan, istioObjectChan)
	}

	wg.Wait()

	close(errChan)
	close(istioObjectChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			err := e // To update the Kiali metric
			return models.IstioConfigList{}, err
		}
	}

	for ob := range istioObjectChan {
		if ob != nil {
			switch ob.ObjectType {
			case kubernetes.Gateways,
				kubernetes.AuthorizationPolicies,
				kubernetes.PeerAuthentications,
				kubernetes.Sidecars,
				kubernetes.RequestAuthentications,
				kubernetes.EnvoyFilters:

				if isWorkloadSelector {
					ob.IstioObjects = kubernetes.FilterIstioObjectsForWorkloadSelector(workloadSelector, ob.IstioObjects)
				}
			}
			switch ob.ObjectType {
			case kubernetes.Gateways:
				(&istioConfigList.Gateways).Parse(ob.IstioObjects)
			case kubernetes.VirtualServices:
				(&istioConfigList.VirtualServices).Parse(ob.IstioObjects)
			case kubernetes.DestinationRules:
				(&istioConfigList.DestinationRules).Parse(ob.IstioObjects)
			case kubernetes.ServiceEntries:
				(&istioConfigList.ServiceEntries).Parse(ob.IstioObjects)
			case kubernetes.AuthorizationPolicies:
				(&istioConfigList.AuthorizationPolicies).Parse(ob.IstioObjects)
			case kubernetes.PeerAuthentications:
				(&istioConfigList.PeerAuthentications).Parse(ob.IstioObjects)
			case kubernetes.Sidecars:
				(&istioConfigList.Sidecars).Parse(ob.IstioObjects)
			case kubernetes.WorkloadEntries:
				(&istioConfigList.WorkloadEntries).Parse(ob.IstioObjects)
			case kubernetes.WorkloadGroups:
				(&istioConfigList.WorkloadGroups).Parse(ob.IstioObjects)
			case kubernetes.RequestAuthentications:
				(&istioConfigList.RequestAuthentications).Parse(ob.IstioObjects)
			case kubernetes.EnvoyFilters:
				(&istioConfigList.EnvoyFilters).Parse(ob.IstioObjects)
			default:
			}
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

	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = objectType

	if !kubernetes.IsIstioObjectTypeValid(objectType) {
		return istioConfigDetail, fmt.Errorf("object type not found: %v", objectType)
	}

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

	ob, err := in.k8s.GetIstioObject(namespace, kubernetes.Gateways, object)
	if err == nil {
		switch objectType {
		case kubernetes.Gateways:
			istioConfigDetail.Gateway = &models.Gateway{}
			istioConfigDetail.Gateway.Parse(ob)
		case kubernetes.VirtualServices:
			istioConfigDetail.VirtualService = &models.VirtualService{}
			istioConfigDetail.VirtualService.Parse(ob)
		case kubernetes.DestinationRules:
			istioConfigDetail.DestinationRule = &models.DestinationRule{}
			istioConfigDetail.DestinationRule.Parse(ob)
		case kubernetes.ServiceEntries:
			istioConfigDetail.ServiceEntry = &models.ServiceEntry{}
			istioConfigDetail.ServiceEntry.Parse(ob)
		case kubernetes.Sidecars:
			istioConfigDetail.Sidecar = &models.Sidecar{}
			istioConfigDetail.Sidecar.Parse(ob)
		case kubernetes.AuthorizationPolicies:
			istioConfigDetail.AuthorizationPolicy = &models.AuthorizationPolicy{}
			istioConfigDetail.AuthorizationPolicy.Parse(ob)
		case kubernetes.PeerAuthentications:
			istioConfigDetail.PeerAuthentication = &models.PeerAuthentication{}
			istioConfigDetail.PeerAuthentication.Parse(ob)
		case kubernetes.WorkloadEntries:
			istioConfigDetail.WorkloadEntry = &models.WorkloadEntry{}
			istioConfigDetail.WorkloadEntry.Parse(ob)
		case kubernetes.WorkloadGroups:
			istioConfigDetail.WorkloadGroup = &models.WorkloadGroup{}
			istioConfigDetail.WorkloadGroup.Parse(ob)
		case kubernetes.RequestAuthentications:
			istioConfigDetail.RequestAuthentication = &models.RequestAuthentication{}
			istioConfigDetail.RequestAuthentication.Parse(ob)
		case kubernetes.EnvoyFilters:
			istioConfigDetail.EnvoyFilter = &models.EnvoyFilter{}
			istioConfigDetail.EnvoyFilter.Parse(ob)
		default:
			err = fmt.Errorf("object type not found: %v", objectType)
		}
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

	if !kubernetes.IsIstioObjectTypeValid(resourceType) {
		return "", fmt.Errorf("object type not found: %v", resourceType)
	}

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
	err = in.k8s.DeleteIstioObject(api, namespace, resourceType, name)

	// Cache is stopped after a Create/Update/Delete operation to force a refresh
	if kialiCache != nil && err == nil {
		kialiCache.RefreshNamespace(namespace)
	}
	return err
}

func (in *IstioConfigService) UpdateIstioConfigDetail(api, namespace, resourceType, name, jsonPatch string) (models.IstioConfigDetails, error) {
	return in.modifyIstioConfigDetail(api, namespace, resourceType, name, jsonPatch, false)
}

func (in *IstioConfigService) modifyIstioConfigDetail(api, namespace, resourceType, name, json string, create bool) (models.IstioConfigDetails, error) {
	var err error
	var result kubernetes.IstioObject
	istioConfigDetail := models.IstioConfigDetails{}
	istioConfigDetail.Namespace = models.Namespace{Name: namespace}
	istioConfigDetail.ObjectType = resourceType

	if !kubernetes.IsIstioObjectTypeValid(resourceType) {
		return istioConfigDetail, fmt.Errorf("object type not found: %v", resourceType)
	}

	if create {
		// Create new object
		result, err = in.k8s.CreateIstioObject(api, namespace, resourceType, json)
	} else {
		// Update/Path existing object
		result, err = in.k8s.UpdateIstioObject(api, namespace, resourceType, name, json)
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
	case kubernetes.WorkloadGroups:
		istioConfigDetail.WorkloadGroup = &models.WorkloadGroup{}
		istioConfigDetail.WorkloadGroup.Parse(result)
	case kubernetes.EnvoyFilters:
		istioConfigDetail.EnvoyFilter = &models.EnvoyFilter{}
		istioConfigDetail.EnvoyFilter.Parse(result)
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
	json, err := in.ParseJsonForCreate(resourceType, body)
	if err != nil {
		return models.IstioConfigDetails{}, errors2.NewBadRequest(err.Error())
	}
	return in.modifyIstioConfigDetail(api, namespace, resourceType, "", json, true)
}

func (in *IstioConfigService) GetIstioConfigPermissions(namespaces []string) models.IstioConfigPermissions {
	istioConfigPermissions := make(models.IstioConfigPermissions, len(namespaces))

	if len(namespaces) > 0 {
		networkingPermissions := make(models.IstioConfigPermissions, len(namespaces))
		securityPermissions := make(models.IstioConfigPermissions, len(namespaces))

		wg := sync.WaitGroup{}
		// We will query 2 times per namespace (networking.istio.io and security.istio.io)
		wg.Add(len(namespaces) * 2)
		for _, ns := range namespaces {
			networkingRP := make(models.ResourcesPermissions, len(newNetworkingConfigTypes))
			securityRP := make(models.ResourcesPermissions, len(newSecurityConfigTypes))
			networkingPermissions[ns] = &networkingRP
			securityPermissions[ns] = &securityRP
			/*
				We can optimize this logic.
				Instead of query all editable objects of networking.istio.io and security.istio.io we can query
				only one per API, that will save several queries to the backend.

				Synced with:
				https://github.com/kiali/kiali-operator/blob/master/roles/default/kiali-deploy/templates/kubernetes/role.yaml#L62
			*/
			go func(namespace string, wg *sync.WaitGroup, networkingPermissions *models.ResourcesPermissions) {
				defer wg.Done()
				canCreate, canUpdate, canDelete := getPermissionsApi(in.k8s, namespace, kubernetes.NetworkingGroupVersion.Group, allResources)
				for _, rs := range newNetworkingConfigTypes {
					networkingRP[rs] = &models.ResourcePermissions{
						Create: canCreate,
						Update: canUpdate,
						Delete: canDelete,
					}
				}
			}(ns, &wg, &networkingRP)

			go func(namespace string, wg *sync.WaitGroup, securityPermissions *models.ResourcesPermissions) {
				defer wg.Done()
				canCreate, canUpdate, canDelete := getPermissionsApi(in.k8s, namespace, kubernetes.SecurityGroupVersion.Group, allResources)
				for _, rs := range newSecurityConfigTypes {
					securityRP[rs] = &models.ResourcePermissions{
						Create: canCreate,
						Update: canUpdate,
						Delete: canDelete,
					}
				}
			}(ns, &wg, &securityRP)
		}
		wg.Wait()

		// Join networking and security permissions into a single result
		for _, ns := range namespaces {
			allRP := make(models.ResourcesPermissions, len(newNetworkingConfigTypes)+len(newSecurityConfigTypes))
			istioConfigPermissions[ns] = &allRP
			for resource, permissions := range *networkingPermissions[ns] {
				(*istioConfigPermissions[ns])[resource] = permissions
			}
			for resource, permissions := range *securityPermissions[ns] {
				(*istioConfigPermissions[ns])[resource] = permissions
			}
		}
	}
	return istioConfigPermissions
}

func getPermissions(k8s kubernetes.ClientInterface, namespace, objectType string) (bool, bool, bool) {
	var canCreate, canPatch, canDelete bool

	if api, ok := kubernetes.ResourceTypesToAPI[objectType]; ok {
		resourceType := objectType
		return getPermissionsApi(k8s, namespace, api, resourceType)
	}
	return canCreate, canPatch, canDelete
}

func getPermissionsApi(k8s kubernetes.ClientInterface, namespace, api, resourceType string) (bool, bool, bool) {
	var canCreate, canPatch, canDelete bool

	// In view only mode, there is not need to check RBAC permissions, return false early
	if config.Get().Deployment.ViewOnlyMode {
		log.Debug("View only mode configured, skipping RBAC checks")
		return canCreate, canPatch, canDelete
	}

	/*
		Kiali only uses create,patch,delete as WRITE permissions

		"update" creates an extra call to the API that we know that it will always fail, introducing extra latency

		Synced with:
		https://github.com/kiali/kiali-operator/blob/master/roles/default/kiali-deploy/templates/kubernetes/role.yaml#L62
	*/
	ssars, permErr := k8s.GetSelfSubjectAccessReview(namespace, api, resourceType, []string{"create", "patch", "delete"})
	if permErr == nil {
		for _, ssar := range ssars {
			if ssar.Spec.ResourceAttributes != nil {
				switch ssar.Spec.ResourceAttributes.Verb {
				case "create":
					canCreate = ssar.Status.Allowed
				case "patch":
					canPatch = ssar.Status.Allowed
				case "delete":
					canDelete = ssar.Status.Allowed
				}
			}
		}
	} else {
		log.Errorf("Error getting permissions [namespace: %s, api: %s, resourceType: %s]: %v", namespace, api, "*", permErr)
	}
	return canCreate, canPatch, canDelete
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
	criteria.IncludeWorkloadGroups = defaultInclude
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
	if checkType(types, kubernetes.WorkloadGroups) {
		criteria.IncludeWorkloadGroups = true
	}
	if checkType(types, kubernetes.RequestAuthentications) {
		criteria.IncludeRequestAuthentications = true
	}
	if checkType(types, kubernetes.EnvoyFilters) {
		criteria.IncludeEnvoyFilters = true
	}
	return criteria
}
