package kubernetes

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var (
	portNameMatcher = regexp.MustCompile(`^[\-].*`)
	portProtocols   = [...]string{"grpc", "http", "http2", "https", "mongo", "redis", "tcp", "tls", "udp"}
)

// GetIstioDetails returns Istio details for a given namespace,
// on this version it collects the VirtualServices and DestinationRules defined for a namespace.
// If serviceName param is provided, it filters all the Istio objects pointing to a particular service.
// It returns an error on any problem.
func (in *IstioClient) GetIstioDetails(namespace string, serviceName string) (*IstioDetails, error) {

	wg := sync.WaitGroup{}
	errChan := make(chan error, 4)

	istioDetails := IstioDetails{}
	vss := make([]IstioObject, 0)
	drs := make([]IstioObject, 0)
	gws := make([]IstioObject, 0)
	ses := make([]IstioObject, 0)

	wg.Add(4)
	go fetchNoEntry(&ses, namespace, in.GetServiceEntries, &wg, errChan)
	go fetchNoEntry(&gws, namespace, in.GetGateways, &wg, errChan)
	go fetch(&vss, namespace, serviceName, in.GetVirtualServices, &wg, errChan)
	go fetch(&drs, namespace, serviceName, in.GetDestinationRules, &wg, errChan)
	wg.Wait()

	if len(errChan) != 0 {
		// We return first error only, likely to be the same issue for all
		err := <-errChan
		return nil, err
	}

	istioDetails.VirtualServices = vss
	istioDetails.DestinationRules = drs
	istioDetails.Gateways = gws
	istioDetails.ServiceEntries = ses

	return &istioDetails, nil
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
	if api == ConfigGroupVersion.Group {
		result, err = in.istioConfigApi.Post().Namespace(namespace).Resource(resourceType).Body(byteJson).Do().Get()
		typeMeta.APIVersion = ApiConfigVersion
	} else if api == NetworkingGroupVersion.Group {
		result, err = in.istioNetworkingApi.Post().Namespace(namespace).Resource(resourceType).Body(byteJson).Do().Get()
		typeMeta.APIVersion = ApiNetworkingVersion
	} else if api == AuthenticationGroupVersion.Group {
		result, err = in.istioAuthenticationApi.Post().Namespace(namespace).Resource(resourceType).Body(byteJson).Do().Get()
		typeMeta.APIVersion = ApiAuthenticationVersion
	} else {
		result, err = in.istioRbacApi.Post().Namespace(namespace).Resource(resourceType).Body(byteJson).Do().Get()
		typeMeta.APIVersion = ApiRbacVersion
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
	if api == ConfigGroupVersion.Group {
		_, err = in.istioConfigApi.Delete().Namespace(namespace).Resource(resourceType).Name(name).Do().Get()
	} else if api == NetworkingGroupVersion.Group {
		_, err = in.istioNetworkingApi.Delete().Namespace(namespace).Resource(resourceType).Name(name).Do().Get()
	} else if api == AuthenticationGroupVersion.Group {
		_, err = in.istioAuthenticationApi.Delete().Namespace(namespace).Resource(resourceType).Name(name).Do().Get()
	} else {
		_, err = in.istioRbacApi.Delete().Namespace(namespace).Resource(resourceType).Name(name).Do().Get()
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
	if api == ConfigGroupVersion.Group {
		result, err = in.istioConfigApi.Patch(types.MergePatchType).Namespace(namespace).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
		typeMeta.APIVersion = ApiConfigVersion
	} else if api == NetworkingGroupVersion.Group {
		result, err = in.istioNetworkingApi.Patch(types.MergePatchType).Namespace(namespace).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
		typeMeta.APIVersion = ApiNetworkingVersion
	} else if api == AuthenticationGroupVersion.Group {
		result, err = in.istioAuthenticationApi.Patch(types.MergePatchType).Namespace(namespace).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
		typeMeta.APIVersion = ApiAuthenticationVersion
	} else {
		result, err = in.istioRbacApi.Patch(types.MergePatchType).Namespace(namespace).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
		typeMeta.APIVersion = ApiRbacVersion
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

func (in *IstioClient) hasRbacResource(resource string) bool {
	return in.getRbacResources()[resource]
}

func (in *IstioClient) getRbacResources() map[string]bool {
	if in.rbacResources != nil {
		return *in.rbacResources
	}

	rbacResources := map[string]bool{}
	resourceListRaw, err := in.k8s.RESTClient().Get().AbsPath("/apis/rbac.istio.io/v1alpha1").Do().Raw()
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

// GetVirtualServices return all VirtualServices for a given namespace.
// If serviceName param is provided it will filter all VirtualServices having a host defined on a particular service.
// It returns an error on any problem.
func (in *IstioClient) GetVirtualServices(namespace string, serviceName string) ([]IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(virtualServices).Do().Get()
	if err != nil {
		return nil, err
	}
	virtualServiceList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a VirtualService list", namespace, serviceName)
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[virtualServices],
		APIVersion: ApiNetworkingVersion,
	}
	virtualServices := make([]IstioObject, 0)
	for _, virtualService := range virtualServiceList.GetItems() {
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
	return virtualServices, nil
}

// GetSidecars return all Sidecars for a given namespace.
// It returns an error on any problem
func (in *IstioClient) GetSidecars(namespace string) ([]IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(sidecars).Do().Get()
	if err != nil {
		return nil, err
	}
	sidecarList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Sidecar list", namespace)
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[sidecars],
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
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(sidecars).SubResource(sidecar).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[sidecars],
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

func (in *IstioClient) GetVirtualService(namespace string, virtualservice string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(virtualServices).SubResource(virtualservice).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[virtualServices],
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
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(gateways).Do().Get()
	if err != nil {
		return nil, err
	}
	gatewayList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Gateway list", namespace)
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[gateways],
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
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(gateways).SubResource(gateway).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[gateways],
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
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(serviceentries).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[serviceentries],
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
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(serviceentries).SubResource(serviceEntryName).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[serviceentries],
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
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(destinationRules).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[destinationRules],
		APIVersion: ApiNetworkingVersion,
	}
	destinationRuleList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a DestinationRule list", namespace, serviceName)
	}

	destinationRules := make([]IstioObject, 0)
	for _, destinationRule := range destinationRuleList.Items {
		appendDestinationRule := serviceName == ""
		if host, ok := destinationRule.Spec["host"]; ok {
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
	return destinationRules, nil
}

func (in *IstioClient) GetDestinationRule(namespace string, destinationrule string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(destinationRules).SubResource(destinationrule).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[destinationRules],
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

func (in *IstioClient) GetMeshPolicies(namespace string) ([]IstioObject, error) {
	// MeshPolicies are not namespaced. However, API returns all the instances even asking for one specific namespace.
	// Due to soft-multitenancy, the call performed is namespaced to avoid triggering an error for cluster-wide access.
	result, err := in.istioAuthenticationApi.Get().Namespace(namespace).Resource(meshPolicies).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[meshPolicies],
		APIVersion: ApiAuthenticationVersion,
	}
	policyList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("it doesn't return a PolicyList list")
	}

	policies := make([]IstioObject, 0)
	for _, ps := range policyList.GetItems() {
		p := ps.DeepCopyIstioObject()
		p.SetTypeMeta(typeMeta)
		policies = append(policies, p)
	}

	return policies, nil
}

func (in *IstioClient) GetMeshPolicy(namespace string, policyName string) (IstioObject, error) {
	result, err := in.istioAuthenticationApi.Get().Namespace(namespace).Resource(meshPolicies).SubResource(policyName).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[meshPolicies],
		APIVersion: ApiAuthenticationVersion,
	}
	mp, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a MeshPolicy object", namespace)
	}
	p := mp.DeepCopyIstioObject()
	p.SetTypeMeta(typeMeta)
	return p, nil
}

func (in *IstioClient) GetClusterRbacConfigs(namespace string) ([]IstioObject, error) {
	// In case ClusterRbacConfigs aren't present on Istio, return empty array.
	if !in.hasRbacResource(clusterrbacconfigs) {
		return []IstioObject{}, nil
	}

	result, err := in.istioRbacApi.Get().Namespace(namespace).Resource(clusterrbacconfigs).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[clusterrbacconfigs],
		APIVersion: ApiRbacVersion,
	}
	clusterRbacConfigList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a RbacConfigList list", namespace)
	}

	clusterRbacConfigs := make([]IstioObject, 0)
	for _, crc := range clusterRbacConfigList.GetItems() {
		c := crc.DeepCopyIstioObject()
		c.SetTypeMeta(typeMeta)
		clusterRbacConfigs = append(clusterRbacConfigs, c)
	}
	return clusterRbacConfigs, nil
}

func (in *IstioClient) GetClusterRbacConfig(namespace string, name string) (IstioObject, error) {
	result, err := in.istioRbacApi.Get().Namespace(namespace).Resource(clusterrbacconfigs).SubResource(name).Do().Get()
	if err != nil {
		return nil, err
	}
	typeMeta := meta_v1.TypeMeta{
		Kind:       PluralType[clusterrbacconfigs],
		APIVersion: ApiRbacVersion,
	}
	clusterRbacConfig, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ClusterRbacConfig object", namespace)
	}
	c := clusterRbacConfig.DeepCopyIstioObject()
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

// GetAuthorizationDetails returns ServiceRoles, ServiceRoleBindings and ClusterRbacDetails
func (in *IstioClient) GetAuthorizationDetails(namespace string) (*RBACDetails, error) {
	rb := &RBACDetails{}

	// TODO Should we use concurrency here? Are these cached?
	srb, err := in.GetServiceRoleBindings(namespace)
	if err != nil {
		return nil, err
	}

	sr, err := in.GetServiceRoles(namespace)
	if err != nil {
		return nil, err
	}

	crc, err := in.GetClusterRbacConfigs(namespace)
	if err != nil {
		return nil, err
	}

	rb.ServiceRoleBindings = srb
	rb.ServiceRoles = sr
	rb.ClusterRbacConfigs = crc

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
							if aDestinationWeight, ok := route.([]interface{}); ok {
								for _, destination := range aDestinationWeight {
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

func PolicyHasStrictMTLS(policy IstioObject) bool {
	_, mode := PolicyHasMTLSEnabled(policy)
	return mode == "STRICT"
}

func PolicyHasMTLSEnabled(policy IstioObject) (bool, string) {
	// It is mandatory to have default as a name
	if policyMeta := policy.GetObjectMeta(); policyMeta.Name != "default" {
		return false, ""
	}

	// It is no globally enabled when has targets
	targets, targetPresent := policy.GetSpec()["targets"]
	specificTarget := targetPresent && len(targets.([]interface{})) > 0
	if specificTarget {
		return false, ""
	}

	// It is globally enabled when a peer has mtls enabled
	peers, peersPresent := policy.GetSpec()["peers"]
	if !peersPresent {
		return false, ""
	}

	for _, peer := range peers.([]interface{}) {
		peerMap := peer.(map[string]interface{})
		if mtls, present := peerMap["mtls"]; present {
			if mtlsMap, ok := mtls.(map[string]interface{}); ok {
				if modeItf, found := mtlsMap["mode"]; found {
					if mode, ok := modeItf.(string); ok {
						return true, mode
					} else {
						return false, ""
					}
				}
			}

			// STRICT mode when mtls object is empty
			return true, "STRICT"
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

func fetch(rValue *[]IstioObject, namespace string, service string, fetcher func(string, string) ([]IstioObject, error), wg *sync.WaitGroup, errChan chan error) {
	defer wg.Done()
	fetched, err := fetcher(namespace, service)
	*rValue = append(*rValue, fetched...)
	if err != nil {
		errChan <- err
	}
}

// Identical to above, but since k8s layer has both (namespace, serviceentry) and (namespace) queries, we need two different functions
func fetchNoEntry(rValue *[]IstioObject, namespace string, fetcher func(string) ([]IstioObject, error), wg *sync.WaitGroup, errChan chan error) {
	defer wg.Done()
	fetched, err := fetcher(namespace)
	*rValue = append(*rValue, fetched...)
	if err != nil && len(errChan) == 0 {
		errChan <- err
	}
}
