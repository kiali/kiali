package kubernetes

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"

	"k8s.io/client-go/rest"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var (
	portNameMatcher = regexp.MustCompile(`^[\-].*`)
	portProtocols   = [...]string{"grpc", "http", "http2", "https", "mongo", "redis", "tcp", "tls", "udp", "mysql"}
)

// Aux method to fetch proper (RESTClient, APIVersion) per API group
func (in *IstioClient) getApiClientVersion(apiGroup string) (*rest.RESTClient, string) {
	if apiGroup == ConfigGroupVersion.Group {
		return in.istioConfigApi, ApiConfigVersion
	} else if apiGroup == NetworkingGroupVersion.Group {
		return in.istioNetworkingApi, ApiNetworkingVersion
	} else if apiGroup == AuthenticationGroupVersion.Group {
		return in.istioAuthenticationApi, ApiAuthenticationVersion
	} else if apiGroup == RbacGroupVersion.Group {
		return in.istioRbacApi, ApiRbacVersion
	} else if apiGroup == MaistraAuthenticationGroupVersion.Group {
		return in.maistraAuthenticationApi, ApiMaistraAuthenticationVersion
	} else if apiGroup == MaistraRbacGroupVersion.Group {
		return in.maistraRbacApi, ApiMaistraRbacVersion
	} else if apiGroup == SecurityGroupVersion.Group {
		return in.istioSecurityApi, ApiSecurityVersion
	}
	return nil, ""
}

// CreateIstioObject creates an Istio object
func (in *IstioClient) CreateIstioObject(api, namespace, resourceType, json string) (IstioObject, error) {
	var result runtime.Object
	var err error

	typeMeta := meta_v1.TypeMeta{
		Kind:       "",
		APIVersion: "",
	}
	typeMeta.Kind = PluralType[resourceType]
	byteJson := []byte(json)

	var apiClient *rest.RESTClient
	apiClient, typeMeta.APIVersion = in.getApiClientVersion(api)
	if apiClient == nil {
		return nil, fmt.Errorf("%s is not supported in CreateIstioObject operation", api)
	}

	// MeshPolicies and ClusterRbacConfigs are cluster scope objects
	// Update: Removed the namespace filter as it doesn't work well in all platforms
	// https://issues.jboss.org/browse/KIALI-3223
	if resourceType == meshPolicies || resourceType == clusterrbacconfigs {
		result, err = apiClient.Post().Resource(resourceType).Body(byteJson).Do().Get()
	} else {
		result, err = apiClient.Post().Namespace(namespace).Resource(resourceType).Body(byteJson).Do().Get()
	}
	if err != nil {
		return nil, err
	}

	istioObject, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return an IstioObject object", namespace, resourceType)
	}
	istioObject.SetTypeMeta(typeMeta)
	return istioObject, err
}

// DeleteIstioObject deletes an Istio object from either config api or networking api
func (in *IstioClient) DeleteIstioObject(api, namespace, resourceType, name string) error {
	log.Debugf("DeleteIstioObject input: %s / %s / %s / %s", api, namespace, resourceType, name)
	var err error
	apiClient, _ := in.getApiClientVersion(api)
	if apiClient == nil {
		return fmt.Errorf("%s is not supported in DeleteIstioObject operation", api)
	}
	// MeshPolicies and ClusterRbacConfigs are cluster scope objects
	// Update: Removed the namespace filter as it doesn't work well in all platforms
	// https://issues.jboss.org/browse/KIALI-3223
	if resourceType == meshPolicies || resourceType == clusterrbacconfigs {
		_, err = apiClient.Delete().Resource(resourceType).Name(name).Do().Get()
	} else {
		_, err = apiClient.Delete().Namespace(namespace).Resource(resourceType).Name(name).Do().Get()
	}
	return err
}

// UpdateIstioObject updates an Istio object from either config api or networking api
func (in *IstioClient) UpdateIstioObject(api, namespace, resourceType, name, jsonPatch string) (IstioObject, error) {
	log.Debugf("UpdateIstioObject input: %s / %s / %s / %s", api, namespace, resourceType, name)
	var result runtime.Object
	var err error

	typeMeta := meta_v1.TypeMeta{
		Kind:       "",
		APIVersion: "",
	}
	typeMeta.Kind = PluralType[resourceType]
	bytePatch := []byte(jsonPatch)
	var apiClient *rest.RESTClient
	apiClient, typeMeta.APIVersion = in.getApiClientVersion(api)
	if apiClient == nil {
		return nil, fmt.Errorf("%s is not supported in UpdateIstioObject operation", api)
	}
	// MeshPolicies and ClusterRbacConfigs are cluster scope objects
	// Update: Removed the namespace filter as it doesn't work well in all platforms
	// https://issues.jboss.org/browse/KIALI-3223
	if resourceType == meshPolicies || resourceType == clusterrbacconfigs {
		result, err = apiClient.Patch(types.MergePatchType).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
	} else {
		result, err = apiClient.Patch(types.MergePatchType).Namespace(namespace).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
	}
	if err != nil {
		return nil, err
	}
	istioObject, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return an IstioObject object", namespace, name)
	}
	istioObject.SetTypeMeta(typeMeta)
	return istioObject, err
}

func (in *IstioClient) hasNetworkingResource(resource string) bool {
	return in.getNetworkingResources()[resource]
}

func (in *IstioClient) getNetworkingResources() map[string]bool {
	if in.networkingResources != nil {
		return *in.networkingResources
	}

	networkingResources := map[string]bool{}
	path := fmt.Sprintf("/apis/%s", ApiNetworkingVersion)
	resourceListRaw, err := in.k8s.RESTClient().Get().AbsPath(path).Do().Raw()
	if err == nil {
		resourceList := meta_v1.APIResourceList{}
		if errMarshall := json.Unmarshal(resourceListRaw, &resourceList); errMarshall == nil {
			for _, resource := range resourceList.APIResources {
				networkingResources[resource.Name] = true
			}
		}
	}
	in.networkingResources = &networkingResources

	return *in.networkingResources
}

func (in *IstioClient) hasConfigResource(resource string) bool {
	return in.getConfigResources()[resource]
}

func (in *IstioClient) getConfigResources() map[string]bool {
	if in.configResources != nil {
		return *in.configResources
	}

	configResources := map[string]bool{}
	path := fmt.Sprintf("/apis/%s", ApiConfigVersion)
	resourceListRaw, err := in.k8s.RESTClient().Get().AbsPath(path).Do().Raw()
	if err == nil {
		resourceList := meta_v1.APIResourceList{}
		if errMarshall := json.Unmarshal(resourceListRaw, &resourceList); errMarshall == nil {
			for _, resource := range resourceList.APIResources {
				configResources[resource.Name] = true
			}
		}
	}
	in.configResources = &configResources

	return *in.configResources
}

func (in *IstioClient) hasRbacResource(resource string) bool {
	return in.getRbacResources()[resource]
}

func (in *IstioClient) getRbacResources() map[string]bool {
	if in.rbacResources != nil {
		return *in.rbacResources
	}

	rbacResources := map[string]bool{}
	path := fmt.Sprintf("/apis/%s", ApiRbacVersion)
	resourceListRaw, err := in.k8s.RESTClient().Get().AbsPath(path).Do().Raw()
	if err == nil {
		resourceList := meta_v1.APIResourceList{}
		if errMarshall := json.Unmarshal(resourceListRaw, &resourceList); errMarshall == nil {
			for _, resource := range resourceList.APIResources {
				rbacResources[resource.Name] = true
			}
		}
	}
	in.rbacResources = &rbacResources

	return *in.rbacResources
}

func (in *IstioClient) hasSecurityResource(resource string) bool {
	return in.getSecurityResources()[resource]
}

func (in *IstioClient) getSecurityResources() map[string]bool {
	if in.securityResources != nil {
		return *in.securityResources
	}

	securityResources := map[string]bool{}
	path := fmt.Sprintf("/apis/%s", ApiSecurityVersion)
	resourceListRaw, err := in.k8s.RESTClient().Get().AbsPath(path).Do().Raw()
	if err == nil {
		resourceList := meta_v1.APIResourceList{}
		if errMarshall := json.Unmarshal(resourceListRaw, &resourceList); errMarshall == nil {
			for _, resource := range resourceList.APIResources {
				securityResources[resource.Name] = true
			}
		}
	}
	in.securityResources = &securityResources

	return *in.securityResources
}

func (in *IstioClient) hasAuthenticationResource(resource string) bool {
	return in.getAuthenticationResources()[resource]
}

func (in *IstioClient) getAuthenticationResources() map[string]bool {
	if in.authenticationResources != nil {
		return *in.authenticationResources
	}

	authenticationResources := map[string]bool{}
	path := fmt.Sprintf("/apis/%s", ApiAuthenticationVersion)
	resourceListRaw, err := in.k8s.RESTClient().Get().AbsPath(path).Do().Raw()
	if err == nil {
		resourceList := meta_v1.APIResourceList{}
		if errMarshall := json.Unmarshal(resourceListRaw, &resourceList); errMarshall == nil {
			for _, resource := range resourceList.APIResources {
				authenticationResources[resource.Name] = true
			}
		}
	}
	in.authenticationResources = &authenticationResources

	return *in.authenticationResources
}

// GetVirtualServices return all VirtualServices for a given namespace.
// If serviceName param is provided it will filter all VirtualServices having a host defined on a particular service.
// It returns an error on any problem.
func (in *IstioClient) GetVirtualServices(namespace string, serviceName string) ([]IstioObject, error) {
	// In case VirtualServices aren't present on Istio, return empty array.
	// I know this is unlikely but just to apply these check in all list get methods
	if !in.hasNetworkingResource(VirtualServices) {
		return []IstioObject{}, nil
	}

	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(VirtualServices).Do().Get()
	if err != nil {
		return nil, err
	}
	virtualServiceList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a VirtualService list", namespace, serviceName)
	}
	return FilterVirtualServices(virtualServiceList.GetItems(), namespace, serviceName), nil
}

func FilterVirtualServices(allVs []IstioObject, namespace string, serviceName string) []IstioObject {
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[VirtualServices],
		APIVersion: ApiNetworkingVersion,
	}
	virtualServices := make([]IstioObject, 0)
	for _, virtualService := range allVs {
		appendVirtualService := serviceName == ""
		routeProtocols := []string{"http", "tcp"}
		if !appendVirtualService && FilterByRoute(virtualService.GetSpec(), routeProtocols, serviceName, namespace, nil) {
			appendVirtualService = true
		}
		if appendVirtualService {
			vs := virtualService.DeepCopyIstioObject()
			vs.SetTypeMeta(typeMeta)
			virtualServices = append(virtualServices, vs)
		}
	}
	return virtualServices
}

// GetSidecars return all Sidecars for a given namespace.
// It returns an error on any problem
func (in *IstioClient) GetSidecars(namespace string) ([]IstioObject, error) {
	// In case Sidecars aren't present on Istio, return empty array.
	if !in.hasNetworkingResource(Sidecars) {
		return []IstioObject{}, nil
	}

	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(Sidecars).Do().Get()
	if err != nil {
		return nil, err
	}
	sidecarList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Sidecar list", namespace)
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[Sidecars],
		APIVersion: ApiNetworkingVersion,
	}
	sidecars := make([]IstioObject, 0)
	for _, sidecar := range sidecarList.GetItems() {
		sc := sidecar.DeepCopyIstioObject()
		sc.SetTypeMeta(typeMeta)
		sidecars = append(sidecars, sc)
	}
	return sidecars, nil
}

func (in *IstioClient) GetSidecar(namespace string, sidecar string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(Sidecars).SubResource(sidecar).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[Sidecars],
		APIVersion: ApiNetworkingVersion,
	}
	sidecarObject, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a Sidecar object", namespace, sidecar)
	}
	sc := sidecarObject.DeepCopyIstioObject()
	sc.SetTypeMeta(typeMeta)
	return sc, nil
}

// GetWorkloadEntries return all WorkloadEntries for a given namespace.
// It returns an error on any problem
func (in *IstioClient) GetWorkloadEntries(namespace string) ([]IstioObject, error) {
	// In case WorkloadEntries aren't present on Istio, return empty array.
	if !in.hasNetworkingResource(WorkloadEntries) {
		return []IstioObject{}, nil
	}

	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(WorkloadEntries).Do().Get()
	if err != nil {
		return nil, err
	}
	workloadEntriesList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a WorkloadEntry list", namespace)
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[WorkloadEntries],
		APIVersion: ApiNetworkingVersion,
	}
	workloadEntries := make([]IstioObject, 0)
	for _, workloadEntry := range workloadEntriesList.GetItems() {
		we := workloadEntry.DeepCopyIstioObject()
		we.SetTypeMeta(typeMeta)
		workloadEntries = append(workloadEntries, we)
	}
	return workloadEntries, nil
}

func (in *IstioClient) GetWorkloadEntry(namespace string, name string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(WorkloadEntries).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[WorkloadEntries],
		APIVersion: ApiNetworkingVersion,
	}
	workloadEntryObject, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a WorkloadEntry object", namespace, name)
	}
	we := workloadEntryObject.DeepCopyIstioObject()
	we.SetTypeMeta(typeMeta)
	return we, nil
}

func (in *IstioClient) GetVirtualService(namespace string, virtualservice string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(VirtualServices).SubResource(virtualservice).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[VirtualServices],
		APIVersion: ApiNetworkingVersion,
	}
	virtualService, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a VirtualService object", namespace, virtualservice)
	}
	vs := virtualService.DeepCopyIstioObject()
	vs.SetTypeMeta(typeMeta)
	return vs, nil
}

// GetGateways return all Gateways for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetGateways(namespace string) ([]IstioObject, error) {
	// In case Gateways aren't present on Istio, return empty array.
	if !in.hasNetworkingResource(Gateways) {
		return []IstioObject{}, nil
	}

	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(Gateways).Do().Get()
	if err != nil {
		return nil, err
	}
	gatewayList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Gateway list", namespace)
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[Gateways],
		APIVersion: ApiNetworkingVersion,
	}
	gateways := make([]IstioObject, 0)
	for _, gateway := range gatewayList.GetItems() {
		gw := gateway.DeepCopyIstioObject()
		gw.SetTypeMeta(typeMeta)
		gateways = append(gateways, gw)
	}
	return gateways, nil
}

func (in *IstioClient) GetGateway(namespace string, gateway string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(Gateways).SubResource(gateway).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[Gateways],
		APIVersion: ApiNetworkingVersion,
	}
	gatewayObject, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a Gateway object", namespace, gateway)
	}
	gw := gatewayObject.DeepCopyIstioObject()
	gw.SetTypeMeta(typeMeta)
	return gw, nil
}

// GetServiceEntries return all ServiceEntry objects for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetServiceEntries(namespace string) ([]IstioObject, error) {
	// In case Serviceentries aren't present on Istio, return empty array.
	if !in.hasNetworkingResource(Serviceentries) {
		return []IstioObject{}, nil
	}

	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(Serviceentries).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[Serviceentries],
		APIVersion: ApiNetworkingVersion,
	}
	serviceEntriesList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceEntry list", namespace)
	}

	serviceEntries := make([]IstioObject, 0)
	for _, serviceEntry := range serviceEntriesList.GetItems() {
		se := serviceEntry.DeepCopyIstioObject()
		se.SetTypeMeta(typeMeta)
		serviceEntries = append(serviceEntries, se)
	}
	return serviceEntries, nil
}

func (in *IstioClient) GetServiceEntry(namespace string, serviceEntryName string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(Serviceentries).SubResource(serviceEntryName).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[Serviceentries],
		APIVersion: ApiNetworkingVersion,
	}
	serviceEntry, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%v doesn't return a ServiceEntry object", namespace, serviceEntry)
	}
	se := serviceEntry.DeepCopyIstioObject()
	se.SetTypeMeta(typeMeta)
	return se, nil
}

// GetDestinationRules returns all DestinationRules for a given namespace.
// If serviceName param is provided it will filter all DestinationRules having a host defined on a particular service.
// It returns an error on any problem.
func (in *IstioClient) GetDestinationRules(namespace string, serviceName string) ([]IstioObject, error) {
	// In case DestinationRules aren't present on Istio, return empty array.
	if !in.hasNetworkingResource(DestinationRules) {
		return []IstioObject{}, nil
	}

	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(DestinationRules).Do().Get()
	if err != nil {
		return nil, err
	}
	destinationRuleList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a DestinationRule list", namespace, serviceName)
	}
	return FilterDestinationRules(destinationRuleList.GetItems(), namespace, serviceName), nil
}

func FilterDestinationRules(allDr []IstioObject, namespace string, serviceName string) []IstioObject {
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[DestinationRules],
		APIVersion: ApiNetworkingVersion,
	}
	destinationRules := make([]IstioObject, 0)
	for _, destinationRule := range allDr {
		appendDestinationRule := serviceName == ""
		if host, ok := destinationRule.GetSpec()["host"]; ok {
			if dHost, ok := host.(string); ok && FilterByHost(dHost, serviceName, namespace) {
				appendDestinationRule = true
			}
		}
		if appendDestinationRule {
			dr := destinationRule.DeepCopyIstioObject()
			dr.SetTypeMeta(typeMeta)
			destinationRules = append(destinationRules, dr)
		}
	}
	return destinationRules
}

func (in *IstioClient) GetDestinationRule(namespace string, destinationrule string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(DestinationRules).SubResource(destinationrule).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[DestinationRules],
		APIVersion: ApiNetworkingVersion,
	}
	destinationRule, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a DestinationRule object", namespace, destinationrule)
	}
	dr := destinationRule.DeepCopyIstioObject()
	dr.SetTypeMeta(typeMeta)
	return dr, nil
}

// GetQuotaSpecs returns all QuotaSpecs objects for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetQuotaSpecs(namespace string) ([]IstioObject, error) {
	// In case quotaspecs aren't present on Istio, return empty array.
	if !in.hasConfigResource(quotaspecs) {
		return []IstioObject{}, nil
	}

	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(quotaspecs).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[quotaspecs],
		APIVersion: ApiConfigVersion,
	}
	quotaSpecList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a QuotaSpecList list", namespace)
	}

	quotaSpecs := make([]IstioObject, 0)
	for _, qs := range quotaSpecList.GetItems() {
		q := qs.DeepCopyIstioObject()
		q.SetTypeMeta(typeMeta)
		quotaSpecs = append(quotaSpecs, q)
	}
	return quotaSpecs, nil
}

func (in *IstioClient) GetQuotaSpec(namespace string, quotaSpecName string) (IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(quotaspecs).SubResource(quotaSpecName).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[quotaspecs],
		APIVersion: ApiConfigVersion,
	}
	quotaSpec, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a QuotaSpec object", namespace, quotaSpecName)
	}
	qs := quotaSpec.DeepCopyIstioObject()
	qs.SetTypeMeta(typeMeta)
	return qs, nil
}

// GetQuotaSpecBindings returns all QuotaSpecBindings objects for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetQuotaSpecBindings(namespace string) ([]IstioObject, error) {
	// In case quotaspecbindings aren't present on Istio, return empty array.
	if !in.hasConfigResource(quotaspecbindings) {
		return []IstioObject{}, nil
	}

	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(quotaspecbindings).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[quotaspecbindings],
		APIVersion: ApiConfigVersion,
	}
	quotaSpecBindingList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a QuotaSpecBindingList list", namespace)
	}

	quotaSpecBindings := make([]IstioObject, 0)
	for _, qs := range quotaSpecBindingList.GetItems() {
		q := qs.DeepCopyIstioObject()
		q.SetTypeMeta(typeMeta)
		quotaSpecBindings = append(quotaSpecBindings, q)
	}
	return quotaSpecBindings, nil
}

func (in *IstioClient) GetQuotaSpecBinding(namespace string, quotaSpecBindingName string) (IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(quotaspecbindings).SubResource(quotaSpecBindingName).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[quotaspecbindings],
		APIVersion: ApiConfigVersion,
	}
	quotaSpecBinding, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a QuotaSpecBinding object", namespace, quotaSpecBindingName)
	}
	qs := quotaSpecBinding.DeepCopyIstioObject()
	qs.SetTypeMeta(typeMeta)
	return qs, nil
}

func (in *IstioClient) GetPolicies(namespace string) ([]IstioObject, error) {
	// In case Policies aren't present on Istio, return empty array.
	if !in.hasAuthenticationResource(policies) {
		return []IstioObject{}, nil
	}

	result, err := in.istioAuthenticationApi.Get().Namespace(namespace).Resource(policies).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[policies],
		APIVersion: ApiAuthenticationVersion,
	}
	policyList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a PolicyList list", namespace)
	}

	policies := make([]IstioObject, 0)
	for _, ps := range policyList.GetItems() {
		p := ps.DeepCopyIstioObject()
		p.SetTypeMeta(typeMeta)
		policies = append(policies, p)
	}

	return policies, nil
}

func (in *IstioClient) GetPolicy(namespace string, policyName string) (IstioObject, error) {
	result, err := in.istioAuthenticationApi.Get().Namespace(namespace).Resource(policies).SubResource(policyName).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[policies],
		APIVersion: ApiAuthenticationVersion,
	}
	policy, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Policy object", namespace)
	}
	p := policy.DeepCopyIstioObject()
	p.SetTypeMeta(typeMeta)
	return p, nil
}

func (in *IstioClient) GetMeshPolicies() ([]IstioObject, error) {
	// In case MeshPolicies aren't present on Istio, return empty array.
	if !in.hasAuthenticationResource(meshPolicies) {
		return []IstioObject{}, nil
	}

	// MeshPolicies are not namespaced. However, API returns all the instances even asking for one specific namespace.
	// Due to soft-multitenancy, the call performed is namespaced to avoid triggering an error for cluster-wide access.
	// Update: Removed the namespace filter as it doesn't work well in all platforms
	// https://issues.jboss.org/browse/KIALI-3223
	result, err := in.istioAuthenticationApi.Get().Resource(meshPolicies).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[meshPolicies],
		APIVersion: ApiAuthenticationVersion,
	}
	policyList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("it doesn't return a MeshPolicyList list")
	}

	policies := make([]IstioObject, 0)
	for _, ps := range policyList.GetItems() {
		p := ps.DeepCopyIstioObject()
		p.SetTypeMeta(typeMeta)
		policies = append(policies, p)
	}

	return policies, nil
}

func (in *IstioClient) GetMeshPolicy(policyName string) (IstioObject, error) {
	// Update: Removed the namespace filter as it doesn't work well in all platforms
	// https://issues.jboss.org/browse/KIALI-3223
	result, err := in.istioAuthenticationApi.Get().Resource(meshPolicies).SubResource(policyName).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[meshPolicies],
		APIVersion: ApiAuthenticationVersion,
	}
	mp, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a MeshPolicy object", policyName)
	}
	p := mp.DeepCopyIstioObject()
	p.SetTypeMeta(typeMeta)
	return p, nil
}

func (in *IstioClient) GetServiceMeshPolicies(namespace string) ([]IstioObject, error) {
	if !in.IsMaistraApi() {
		return []IstioObject{}, nil
	}
	result, err := in.maistraAuthenticationApi.Get().Namespace(namespace).Resource(serviceMeshPolicies).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[serviceMeshPolicies],
		APIVersion: ApiMaistraAuthenticationVersion,
	}
	serviceMeshPolicyList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("it doesn't return a ServiceMeshPolicyList list")
	}

	policies := make([]IstioObject, 0)
	for _, ps := range serviceMeshPolicyList.GetItems() {
		p := ps.DeepCopyIstioObject()
		p.SetTypeMeta(typeMeta)
		policies = append(policies, p)
	}

	return policies, nil
}

func (in *IstioClient) GetServiceMeshPolicy(namespace string, name string) (IstioObject, error) {
	result, err := in.maistraAuthenticationApi.Get().Namespace(namespace).Resource(serviceMeshPolicies).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[serviceMeshPolicies],
		APIVersion: ApiMaistraAuthenticationVersion,
	}
	serviceMeshPolicy, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceMeshPolicy object", namespace)
	}
	p := serviceMeshPolicy.DeepCopyIstioObject()
	p.SetTypeMeta(typeMeta)
	return p, nil
}

func (in *IstioClient) GetClusterRbacConfigs() ([]IstioObject, error) {
	// In case ClusterRbacConfigs aren't present on Istio, return empty array.
	if !in.hasRbacResource(clusterrbacconfigs) {
		return []IstioObject{}, nil
	}

	// Update: Removed the namespace filter as it doesn't work well in all platforms
	// https://issues.jboss.org/browse/KIALI-3223
	result, err := in.istioRbacApi.Get().Resource(clusterrbacconfigs).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[clusterrbacconfigs],
		APIVersion: ApiRbacVersion,
	}
	clusterRbacConfigList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("it doesn't return a ClusterRbacConfigList list")
	}

	clusterRbacConfigs := make([]IstioObject, 0)
	for _, crc := range clusterRbacConfigList.GetItems() {
		c := crc.DeepCopyIstioObject()
		c.SetTypeMeta(typeMeta)
		clusterRbacConfigs = append(clusterRbacConfigs, c)
	}
	return clusterRbacConfigs, nil
}

func (in *IstioClient) GetClusterRbacConfig(name string) (IstioObject, error) {
	// Update: Removed the namespace filter as it doesn't work well in all platforms
	// https://issues.jboss.org/browse/KIALI-3223
	result, err := in.istioRbacApi.Get().Resource(clusterrbacconfigs).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[clusterrbacconfigs],
		APIVersion: ApiRbacVersion,
	}
	clusterRbacConfig, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ClusterRbacConfig object", name)
	}
	c := clusterRbacConfig.DeepCopyIstioObject()
	c.SetTypeMeta(typeMeta)
	return c, nil
}

func (in *IstioClient) GetServiceMeshRbacConfigs(namespace string) ([]IstioObject, error) {
	if !in.IsMaistraApi() {
		return []IstioObject{}, nil
	}

	result, err := in.maistraRbacApi.Get().Namespace(namespace).Resource(serviceMeshRbacConfigs).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[serviceMeshRbacConfigs],
		APIVersion: ApiMaistraRbacVersion,
	}
	serviceMeshRbacConfigList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceMeshRbacConfigList list", namespace)
	}

	serviceMeshRbacConfigs := make([]IstioObject, 0)
	for _, crc := range serviceMeshRbacConfigList.GetItems() {
		c := crc.DeepCopyIstioObject()
		c.SetTypeMeta(typeMeta)
		serviceMeshRbacConfigs = append(serviceMeshRbacConfigs, c)
	}
	return serviceMeshRbacConfigs, nil
}

func (in *IstioClient) GetServiceMeshRbacConfig(namespace string, name string) (IstioObject, error) {
	result, err := in.maistraRbacApi.Get().Namespace(namespace).Resource(serviceMeshRbacConfigs).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[serviceMeshRbacConfigs],
		APIVersion: ApiMaistraRbacVersion,
	}
	serviceMeshRbacConfig, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceMeshRbacConfig object", namespace)
	}
	c := serviceMeshRbacConfig.DeepCopyIstioObject()
	c.SetTypeMeta(typeMeta)
	return c, nil
}

func (in *IstioClient) GetRbacConfigs(namespace string) ([]IstioObject, error) {
	// In case RbacConfigs aren't present on Istio, return empty array.
	if !in.hasRbacResource(rbacconfigs) {
		return []IstioObject{}, nil
	}

	result, err := in.istioRbacApi.Get().Namespace(namespace).Resource(rbacconfigs).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[rbacconfigs],
		APIVersion: ApiRbacVersion,
	}
	rbacConfigList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a RbacConfigList list", namespace)
	}

	rbacConfigs := make([]IstioObject, 0)
	for _, rc := range rbacConfigList.GetItems() {
		r := rc.DeepCopyIstioObject()
		r.SetTypeMeta(typeMeta)
		rbacConfigs = append(rbacConfigs, r)
	}
	return rbacConfigs, nil
}

func (in *IstioClient) GetRbacConfig(namespace string, name string) (IstioObject, error) {
	result, err := in.istioRbacApi.Get().Namespace(namespace).Resource(rbacconfigs).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[rbacconfigs],
		APIVersion: ApiRbacVersion,
	}
	rbacConfig, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a RbacConfig object", namespace)
	}
	r := rbacConfig.DeepCopyIstioObject()
	r.SetTypeMeta(typeMeta)
	return r, nil
}

func (in *IstioClient) GetServiceRoles(namespace string) ([]IstioObject, error) {
	// In case ServiceRoles aren't present on Istio, return empty array.
	if !in.hasRbacResource(serviceroles) {
		return []IstioObject{}, nil
	}

	result, err := in.istioRbacApi.Get().Namespace(namespace).Resource(serviceroles).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[serviceroles],
		APIVersion: ApiRbacVersion,
	}
	serviceRoleList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceRoleList list", namespace)
	}

	serviceRoles := make([]IstioObject, 0)
	for _, sr := range serviceRoleList.GetItems() {
		s := sr.DeepCopyIstioObject()
		s.SetTypeMeta(typeMeta)
		serviceRoles = append(serviceRoles, s)
	}
	return serviceRoles, nil
}

func (in *IstioClient) GetServiceRole(namespace string, name string) (IstioObject, error) {
	result, err := in.istioRbacApi.Get().Namespace(namespace).Resource(serviceroles).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[serviceroles],
		APIVersion: ApiRbacVersion,
	}
	serviceRole, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceRole object", namespace)
	}
	s := serviceRole.DeepCopyIstioObject()
	s.SetTypeMeta(typeMeta)
	return s, nil
}

func (in *IstioClient) GetServiceRoleBindings(namespace string) ([]IstioObject, error) {
	// In case ServiceRoleBindings aren't present on Istio, return empty array.
	if !in.hasRbacResource(servicerolebindings) {
		return []IstioObject{}, nil
	}

	result, err := in.istioRbacApi.Get().Namespace(namespace).Resource(servicerolebindings).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[servicerolebindings],
		APIVersion: ApiRbacVersion,
	}
	serviceRoleBindingList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceRoleBindingList list", namespace)
	}

	serviceRoleBindings := make([]IstioObject, 0)
	for _, sr := range serviceRoleBindingList.GetItems() {
		s := sr.DeepCopyIstioObject()
		s.SetTypeMeta(typeMeta)
		serviceRoleBindings = append(serviceRoleBindings, s)
	}
	return serviceRoleBindings, nil
}

func (in *IstioClient) GetServiceRoleBinding(namespace string, name string) (IstioObject, error) {
	result, err := in.istioRbacApi.Get().Namespace(namespace).Resource(servicerolebindings).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[servicerolebindings],
		APIVersion: ApiRbacVersion,
	}
	serviceRoleBinding, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceRoleBinding object", namespace)
	}
	s := serviceRoleBinding.DeepCopyIstioObject()
	s.SetTypeMeta(typeMeta)
	return s, nil
}

func (in *IstioClient) GetAuthorizationPolicies(namespace string) ([]IstioObject, error) {
	// In case AuthorizationPolicies aren't present on Istio, return empty array.
	if !in.hasSecurityResource(AuthorizationPolicies) {
		return []IstioObject{}, nil
	}

	result, err := in.istioSecurityApi.Get().Namespace(namespace).Resource(AuthorizationPolicies).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[AuthorizationPolicies],
		APIVersion: ApiSecurityVersion,
	}
	authorizationPoliciesList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a AuthorizationPoliciesList list", namespace)
	}

	authorizationPolicies := make([]IstioObject, 0)
	for _, sr := range authorizationPoliciesList.GetItems() {
		s := sr.DeepCopyIstioObject()
		s.SetTypeMeta(typeMeta)
		authorizationPolicies = append(authorizationPolicies, s)
	}
	return authorizationPolicies, nil
}

func (in *IstioClient) GetPeerAuthentications(namespace string) ([]IstioObject, error) {
	// In case PeerAuthentication aren't present on Istio, return empty array.
	if !in.hasSecurityResource(PeerAuthentications) {
		return []IstioObject{}, nil
	}

	result, err := in.istioSecurityApi.Get().Namespace(namespace).Resource(PeerAuthentications).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[PeerAuthentications],
		APIVersion: ApiSecurityVersion,
	}
	peerAuthenticationsList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a PeerAuthentication list", namespace)
	}

	peerAuthentications := make([]IstioObject, 0)
	for _, pa := range peerAuthenticationsList.GetItems() {
		s := pa.DeepCopyIstioObject()
		s.SetTypeMeta(typeMeta)
		peerAuthentications = append(peerAuthentications, s)
	}
	return peerAuthentications, nil
}

func (in *IstioClient) GetPeerAuthentication(namespace string, name string) (IstioObject, error) {
	result, err := in.istioSecurityApi.Get().Namespace(namespace).Resource(PeerAuthentications).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[PeerAuthentications],
		APIVersion: ApiSecurityVersion,
	}
	peerAuthentication, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a PeerAuthentication object", namespace)
	}
	p := peerAuthentication.DeepCopyIstioObject()
	p.SetTypeMeta(typeMeta)
	return p, nil
}

func (in *IstioClient) GetRequestAuthentications(namespace string) ([]IstioObject, error) {
	// In case RequestAuthentication aren't present on Istio, return empty array.
	if !in.hasSecurityResource(RequestAuthentications) {
		return []IstioObject{}, nil
	}

	result, err := in.istioSecurityApi.Get().Namespace(namespace).Resource(RequestAuthentications).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[RequestAuthentications],
		APIVersion: ApiSecurityVersion,
	}
	requestAuthenticationsList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a RequestAuthentication list", namespace)
	}

	requestAuthentications := make([]IstioObject, 0)
	for _, ra := range requestAuthenticationsList.GetItems() {
		r := ra.DeepCopyIstioObject()
		r.SetTypeMeta(typeMeta)
		requestAuthentications = append(requestAuthentications, r)
	}
	return requestAuthentications, nil
}

func (in *IstioClient) GetRequestAuthentication(namespace string, name string) (IstioObject, error) {
	result, err := in.istioSecurityApi.Get().Namespace(namespace).Resource(RequestAuthentications).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[RequestAuthentications],
		APIVersion: ApiSecurityVersion,
	}
	requestAuthentication, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a PeerAuthentication object", namespace)
	}
	p := requestAuthentication.DeepCopyIstioObject()
	p.SetTypeMeta(typeMeta)
	return p, nil
}

func (in *IstioClient) GetAuthorizationPolicy(namespace string, name string) (IstioObject, error) {
	result, err := in.istioSecurityApi.Get().Namespace(namespace).Resource(AuthorizationPolicies).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[AuthorizationPolicies],
		APIVersion: ApiSecurityVersion,
	}
	authorizationPolicy, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a AuthorizationPolicy object", namespace)
	}
	s := authorizationPolicy.DeepCopyIstioObject()
	s.SetTypeMeta(typeMeta)
	return s, nil
}

// GetAuthorizationDetails returns ServiceRoles, ServiceRoleBindings and ClusterRbacDetails
func (in *IstioClient) GetAuthorizationDetails(namespace string) (*RBACDetails, error) {
	rb := &RBACDetails{}

	errChan := make(chan error, 1)
	var wg sync.WaitGroup
	wg.Add(4)

	go func(errChan chan error) {
		defer wg.Done()
		if aps, err := in.GetAuthorizationPolicies(namespace); err == nil {
			rb.AuthorizationPolicies = aps
		} else {
			errChan <- err
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if srb, err := in.GetServiceRoleBindings(namespace); err == nil {
			rb.ServiceRoleBindings = srb
		} else {
			errChan <- err
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		if sr, err := in.GetServiceRoles(namespace); err == nil {
			rb.ServiceRoles = sr
		} else {
			errChan <- err
		}
	}(errChan)

	go func(errChan chan error) {
		defer wg.Done()
		// Maistra has migrated ClusterRbacConfigs to ServiceMeshRbacConfigs resources
		if !in.IsMaistraApi() {
			if crc, err := in.GetClusterRbacConfigs(); err == nil {
				rb.ClusterRbacConfigs = crc
			} else {
				errChan <- err
			}
		} else {
			if smrc, err := in.GetServiceMeshRbacConfigs(namespace); err == nil {
				rb.ServiceMeshRbacConfigs = smrc
			} else {
				errChan <- err
			}
		}
	}(errChan)

	wg.Wait()
	close(errChan)

	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return rb, e
		}
	}

	return rb, nil
}

func FilterByHost(host, serviceName, namespace string) bool {
	// Check single name
	if host == serviceName {
		return true
	}
	// Check service.namespace
	if host == fmt.Sprintf("%s.%s", serviceName, namespace) {
		return true
	}
	// Check the FQDN. <service>.<namespace>.svc
	if host == fmt.Sprintf("%s.%s.%s", serviceName, namespace, "svc") {
		return true
	}

	// Check the FQDN. <service>.<namespace>.svc.<zone>
	if host == fmt.Sprintf("%s.%s.%s", serviceName, namespace, config.Get().ExternalServices.Istio.IstioIdentityDomain) {
		return true
	}

	// Note, FQDN names are defined from Kubernetes registry specification [1]
	// [1] https://github.com/kubernetes/dns/blob/master/docs/specification.md

	return false
}

func FilterByRoute(spec map[string]interface{}, protocols []string, service string, namespace string, serviceEntries map[string]struct{}) bool {
	if len(protocols) == 0 {
		return false
	}
	for _, protocol := range protocols {
		if prot, ok := spec[protocol]; ok {
			if aHttp, ok := prot.([]interface{}); ok {
				for _, httpRoute := range aHttp {
					if mHttpRoute, ok := httpRoute.(map[string]interface{}); ok {
						if route, ok := mHttpRoute["route"]; ok {
							if aRouteDestination, ok := route.([]interface{}); ok {
								for _, destination := range aRouteDestination {
									if mDestination, ok := destination.(map[string]interface{}); ok {
										if destinationW, ok := mDestination["destination"]; ok {
											if mDestinationW, ok := destinationW.(map[string]interface{}); ok {
												if host, ok := mDestinationW["host"]; ok {
													if sHost, ok := host.(string); ok {
														if FilterByHost(sHost, service, namespace) {
															return true
														}
														if serviceEntries != nil {
															// We have ServiceEntry to check
															if _, found := serviceEntries[strings.ToLower(protocol)+sHost]; found {
																return true
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
	return false
}

// ServiceEntryHostnames returns a list of hostnames defined in the ServiceEntries Specs. Key in the resulting map is the protocol (in lowercase) + hostname
// exported for test
func ServiceEntryHostnames(serviceEntries []IstioObject) map[string][]string {
	hostnames := make(map[string][]string)

	for _, v := range serviceEntries {
		if hostsSpec, found := v.GetSpec()["hosts"]; found {
			if hosts, ok := hostsSpec.([]interface{}); ok {
				// Seek the protocol
				for _, h := range hosts {
					if hostname, ok := h.(string); ok {
						hostnames[hostname] = make([]string, 0, 1)
					}
				}
			}
		}
		if portsSpec, found := v.GetSpec()["ports"]; found {
			if portsArray, ok := portsSpec.([]interface{}); ok {
				for _, portDef := range portsArray {
					if ports, ok := portDef.(map[string]interface{}); ok {
						if proto, found := ports["protocol"]; found {
							if protocol, ok := proto.(string); ok {
								protocol = mapPortToVirtualServiceProtocol(protocol)
								for host := range hostnames {
									hostnames[host] = append(hostnames[host], protocol)
								}
							}
						}
					}
				}
			}
		}
	}

	return hostnames
}

// mapPortToVirtualServiceProtocol transforms Istio's Port-definitions' protocol names to VirtualService's protocol names
func mapPortToVirtualServiceProtocol(proto string) string {
	// http: HTTP/HTTP2/GRPC/ TLS-terminated-HTTPS and service entry ports using HTTP/HTTP2/GRPC protocol
	// tls: HTTPS/TLS protocols (i.e. with “passthrough” TLS mode) and service entry ports using HTTPS/TLS protocols.
	// tcp: everything else

	switch proto {
	case "HTTP":
		fallthrough
	case "HTTP2":
		fallthrough
	case "GRPC":
		return "http"
	case "HTTPS":
		fallthrough
	case "TLS":
		return "tls"
	default:
		return "tcp"
	}
}

// ValidaPort parses the Istio Port definition and validates the naming scheme
func ValidatePort(portDef interface{}) bool {
	return MatchPortNameRule(parsePort(portDef))
}

func parsePort(portDef interface{}) (string, string) {
	var name, proto string
	if port, ok := portDef.(map[string]interface{}); ok {
		if portNameDef, found := port["name"]; found {
			if portName, ok := portNameDef.(string); ok {
				name = portName
			}
		}
		if protocolDef, found := port["protocol"]; found {
			if protocol, ok := protocolDef.(string); ok {
				proto = protocol
			}
		}
	}

	return name, proto
}

func MatchPortNameRule(portName, protocol string) bool {
	protocol = strings.ToLower(protocol)
	// Check that portName begins with the protocol

	if protocol == "tcp" || protocol == "udp" {
		// TCP and UDP protocols do not care about the name
		return true
	}

	if !strings.HasPrefix(portName, protocol) {
		return false
	}

	// If longer than protocol, then it must adhere to <protocol>[-suffix]
	// and if there's -, then there must be a suffix ..
	if len(portName) > len(protocol) {
		restPortName := portName[len(protocol):]
		return portNameMatcher.MatchString(restPortName)
	}

	// Case portName == protocolName
	return true
}

func MatchPortNameWithValidProtocols(portName string) bool {
	for _, protocol := range portProtocols {
		if strings.HasPrefix(portName, protocol) &&
			(strings.ToLower(portName) == protocol || portNameMatcher.MatchString(portName[len(protocol):])) {
			return true
		}
	}
	return false
}

// GatewayNames extracts the gateway names for easier matching
func GatewayNames(gateways [][]IstioObject) map[string]struct{} {
	var empty struct{}
	names := make(map[string]struct{})
	for _, ns := range gateways {
		for _, gw := range ns {
			gw := gw
			clusterName := gw.GetObjectMeta().ClusterName
			if clusterName == "" {
				clusterName = config.Get().ExternalServices.Istio.IstioIdentityDomain
			}
			names[ParseHost(gw.GetObjectMeta().Name, gw.GetObjectMeta().Namespace, clusterName).String()] = empty
		}
	}
	return names
}

func PeerAuthnHasStrictMTLS(peerAuthn IstioObject) bool {
	_, mode := PeerAuthnHasMTLSEnabled(peerAuthn)
	return mode == "STRICT"
}

func PeerAuthnHasMTLSEnabled(peerAuthn IstioObject) (bool, string) {
	// It is no globally enabled when has targets
	if peerAuthn.HasMatchLabelsSelector() {
		return false, ""
	}

	// It is globally enabled when mtls is in STRICT mode
	if mtls, mtlsPresent := peerAuthn.GetSpec()["mtls"]; mtlsPresent {
		if mtlsMap, ok := mtls.(map[string]interface{}); ok {
			if modeItf, found := mtlsMap["mode"]; found {
				if mode, ok := modeItf.(string); ok {
					return true, mode
				} else {
					return false, ""
				}
			} else {
				// STRICT when mtls object is empty
				return true, "STRICT"
			}
		}
	}

	return false, ""
}

func DestinationRuleHasMeshWideMTLSEnabled(destinationRule IstioObject) (bool, string) {
	// Following the suggested procedure to enable mesh-wide mTLS, host might be '*.local':
	// https://istio.io/docs/tasks/security/authn-policy/#globally-enabling-istio-mutual-tls
	return DestinationRuleHasMTLSEnabledForHost("*.local", destinationRule)
}

func DestinationRuleHasNamespaceWideMTLSEnabled(namespace string, destinationRule IstioObject) (bool, string) {
	// Following the suggested procedure to enable namespace-wide mTLS, host might be '*.namespace.svc.cluster.local'
	// https://istio.io/docs/tasks/security/authn-policy/#namespace-wide-policy
	nsHost := fmt.Sprintf("*.%s.%s", namespace, config.Get().ExternalServices.Istio.IstioIdentityDomain)
	return DestinationRuleHasMTLSEnabledForHost(nsHost, destinationRule)
}

func DestinationRuleHasMTLSEnabledForHost(expectedHost string, destinationRule IstioObject) (bool, string) {
	host, hostPresent := destinationRule.GetSpec()["host"]
	if !hostPresent || host != expectedHost {
		return false, ""
	}

	if trafficPolicy, trafficPresent := destinationRule.GetSpec()["trafficPolicy"]; trafficPresent {
		if trafficCasted, ok := trafficPolicy.(map[string]interface{}); ok {
			if tls, found := trafficCasted["tls"]; found {
				if tlsCasted, ok := tls.(map[string]interface{}); ok {
					if mode, found := tlsCasted["mode"]; found {
						if modeCasted, ok := mode.(string); ok {
							return modeCasted == "ISTIO_MUTUAL", modeCasted
						}
					}
				}
			}
		}
	}

	return false, ""
}
