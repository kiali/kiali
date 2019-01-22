package kubernetes

import (
	"fmt"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
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

// DeleteIstioObject deletes an Istio object from either config api or networking api
func (in *IstioClient) DeleteIstioObject(api, namespace, resourceType, name string) error {
	log.Infof("DeleteIstioObject input: %s / %s / %s / %s", api, namespace, resourceType, name)
	var err error
	if api == configGroupVersion.Group {
		_, err = in.istioConfigApi.Delete().Namespace(namespace).Resource(resourceType).Name(name).Do().Get()
	} else if api == networkingGroupVersion.Group {
		_, err = in.istioNetworkingApi.Delete().Namespace(namespace).Resource(resourceType).Name(name).Do().Get()
	} else {
		_, err = in.istioAuthenticationApi.Delete().Namespace(namespace).Resource(resourceType).Name(name).Do().Get()
	}
	return err
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

	virtualServices := make([]IstioObject, 0)
	for _, virtualService := range virtualServiceList.GetItems() {
		appendVirtualService := serviceName == ""
		routeProtocols := []string{"http", "tcp"}
		if !appendVirtualService && FilterByRoute(virtualService.GetSpec(), routeProtocols, serviceName, namespace, nil) {
			appendVirtualService = true
		}
		if appendVirtualService {
			virtualServices = append(virtualServices, virtualService.DeepCopyIstioObject())
		}
	}
	return virtualServices, nil
}

func (in *IstioClient) GetVirtualService(namespace string, virtualservice string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(virtualServices).SubResource(virtualservice).Do().Get()
	if err != nil {
		return nil, err
	}

	virtualService, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a VirtualService object", namespace, virtualservice)
	}
	return virtualService.DeepCopyIstioObject(), nil
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

	gateways := make([]IstioObject, 0)
	for _, gateway := range gatewayList.GetItems() {
		gateways = append(gateways, gateway.DeepCopyIstioObject())
	}
	return gateways, nil
}

func (in *IstioClient) GetGateway(namespace string, gateway string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(gateways).SubResource(gateway).Do().Get()
	if err != nil {
		return nil, err
	}

	gatewayObject, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a Gateway object", namespace, gateway)
	}
	return gatewayObject.DeepCopyIstioObject(), nil
}

// GetServiceEntries return all ServiceEntry objects for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetServiceEntries(namespace string) ([]IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(serviceentries).Do().Get()
	if err != nil {
		return nil, err
	}
	serviceEntriesList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a ServiceEntry list", namespace)
	}

	serviceEntries := make([]IstioObject, 0)
	for _, serviceEntry := range serviceEntriesList.GetItems() {
		serviceEntries = append(serviceEntries, serviceEntry.DeepCopyIstioObject())
	}
	return serviceEntries, nil
}

func (in *IstioClient) GetServiceEntry(namespace string, serviceEntryName string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(serviceentries).SubResource(serviceEntryName).Do().Get()
	if err != nil {
		return nil, err
	}

	serviceEntry, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%v doesn't return a ServiceEntry object", namespace, serviceEntry)
	}
	return serviceEntry.DeepCopyIstioObject(), nil
}

// GetDestinationRules returns all DestinationRules for a given namespace.
// If serviceName param is provided it will filter all DestinationRules having a host defined on a particular service.
// It returns an error on any problem.
func (in *IstioClient) GetDestinationRules(namespace string, serviceName string) ([]IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(destinationRules).Do().Get()
	if err != nil {
		return nil, err
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
			destinationRules = append(destinationRules, destinationRule.DeepCopyIstioObject())
		}
	}
	return destinationRules, nil
}

func (in *IstioClient) GetDestinationRule(namespace string, destinationrule string) (IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(destinationRules).SubResource(destinationrule).Do().Get()
	if err != nil {
		return nil, err
	}
	destinationRule, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a DestinationRule object", namespace, destinationrule)
	}
	return destinationRule.DeepCopyIstioObject(), nil
}

// GetQuotaSpecs returns all QuotaSpecs objects for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetQuotaSpecs(namespace string) ([]IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(quotaspecs).Do().Get()
	if err != nil {
		return nil, err
	}
	quotaSpecList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a QuotaSpecList list", namespace)
	}

	quotaSpecs := make([]IstioObject, 0)
	for _, qs := range quotaSpecList.GetItems() {
		quotaSpecs = append(quotaSpecs, qs.DeepCopyIstioObject())
	}
	return quotaSpecs, nil
}

func (in *IstioClient) GetQuotaSpec(namespace string, quotaSpecName string) (IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(quotaspecs).SubResource(quotaSpecName).Do().Get()
	if err != nil {
		return nil, err
	}

	quotaSpec, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a QuotaSpec object", namespace, quotaSpecName)
	}
	return quotaSpec.DeepCopyIstioObject(), nil
}

// GetQuotaSpecBindings returns all QuotaSpecBindings objects for a given namespace.
// It returns an error on any problem.
func (in *IstioClient) GetQuotaSpecBindings(namespace string) ([]IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(quotaspecbindings).Do().Get()
	if err != nil {
		return nil, err
	}
	quotaSpecBindingList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a QuotaSpecBindingList list", namespace)
	}

	quotaSpecBindings := make([]IstioObject, 0)
	for _, qs := range quotaSpecBindingList.GetItems() {
		quotaSpecBindings = append(quotaSpecBindings, qs.DeepCopyIstioObject())
	}
	return quotaSpecBindings, nil
}

func (in *IstioClient) GetQuotaSpecBinding(namespace string, quotaSpecBindingName string) (IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(quotaspecbindings).SubResource(quotaSpecBindingName).Do().Get()
	if err != nil {
		return nil, err
	}

	quotaSpecBinding, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a QuotaSpecBinding object", namespace, quotaSpecBindingName)
	}
	return quotaSpecBinding.DeepCopyIstioObject(), nil
}

func (in *IstioClient) GetPolicies(namespace string) ([]IstioObject, error) {
	result, err := in.istioAuthenticationApi.Get().Namespace(namespace).Resource(policies).Do().Get()
	if err != nil {
		return nil, err
	}

	policyList, ok := result.(*GenericIstioObjectList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a PolicyList list", namespace)
	}

	policies := make([]IstioObject, 0)
	for _, ps := range policyList.GetItems() {
		policies = append(policies, ps.DeepCopyIstioObject())
	}

	return policies, nil
}

func (in *IstioClient) GetPolicy(namespace string, policyName string) (IstioObject, error) {
	result, err := in.istioAuthenticationApi.Get().Namespace(namespace).Resource(policies).SubResource(policyName).Do().Get()
	if err != nil {
		return nil, err
	}

	policy, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a Policy object", namespace)
	}

	return policy.DeepCopyIstioObject(), nil
}

// UpdateIstioObject updates an Istio object from either config api or networking api
func (in *IstioClient) UpdateIstioObject(api, namespace, resourceType, name, jsonPatch string) (IstioObject, error) {
	log.Infof("UpdateIstioObject input: %s / %s / %s / %s", api, namespace, resourceType, name)
	var result runtime.Object
	var err error
	bytePatch := []byte(jsonPatch)
	if api == configGroupVersion.Group {
		result, err = in.istioConfigApi.Patch(types.MergePatchType).Namespace(namespace).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
	} else if api == networkingGroupVersion.Group {
		result, err = in.istioNetworkingApi.Patch(types.MergePatchType).Namespace(namespace).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
	} else {
		result, err = in.istioAuthenticationApi.Patch(types.MergePatchType).Namespace(namespace).Resource(resourceType).SubResource(name).Body(bytePatch).Do().Get()
	}
	if err != nil {
		return nil, err
	}
	istioObject, ok := result.(*GenericIstioObject)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return an IstioObject object", namespace, name)
	}
	return istioObject, err
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
func ServiceEntryHostnames(serviceEntries []IstioObject) map[string]struct{} {
	var empty struct{}
	hostnames := make(map[string]struct{})

	for _, v := range serviceEntries {
		if hostsSpec, found := v.GetSpec()["hosts"]; found {
			if hosts, ok := hostsSpec.([]interface{}); ok {
				// Seek the protocol
				if portsSpec, found := v.GetSpec()["ports"]; found {
					if ports, ok := portsSpec.(map[string]interface{}); ok {
						if proto, found := ports["protocol"]; found {
							if protocol, ok := proto.(string); ok {
								protocol = mapPortToVirtualServiceProtocol(protocol)
								for _, v := range hosts {
									hostnames[fmt.Sprintf("%v%v", protocol, v)] = empty
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

// GatewayNames extracts the gateway names for easier matching
func GatewayNames(gateways []IstioObject) map[string]struct{} {
	var empty struct{}
	names := make(map[string]struct{})
	for _, v := range gateways {
		v := v
		names[v.GetObjectMeta().Name] = empty
	}
	return names
}

// ValidateVirtualServiceGateways checks all VirtualService gateways (except mesh, which is reserved word) and checks that they're found from the given list of gatewayNames. Also return index of missing gatways to show clearer error path in editor
func ValidateVirtualServiceGateways(spec map[string]interface{}, gatewayNames map[string]struct{}) (bool, int) {
	if gatewaysSpec, found := spec["gateways"]; found {
		if gateways, ok := gatewaysSpec.([]interface{}); ok {
			for index, g := range gateways {
				if gate, ok := g.(string); ok {
					if _, found := gatewayNames[gate]; !found && gate != "mesh" {
						return false, index
					}
				}
			}
		}
	}
	// No gateways defined or all found. Return -1 indicates no missing gateway
	return true, -1
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
