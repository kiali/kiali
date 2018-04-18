package kubernetes

import (
	"fmt"
	"sync"
)

// GetIstioDetails returns Istio details for a given service,
// on this version it describes the RouterRules and destinationPolicies defined for a service.
// A service is defined by the namespace and the service name.
// It returns an error on any problem.
func (in *IstioClient) GetIstioDetails(namespace string, serviceName string) (*IstioDetails, error) {
	var routeRules, destinationPolicies, virtualServices, destinationRules []IstioObject
	var routeRulesErr, destinationPoliciesErr, virtualServicesErr, destinationRulesErr error
	var wg sync.WaitGroup
	wg.Add(4)

	go func() {
		defer wg.Done()
		routeRules, routeRulesErr = in.getRouteRules(namespace, serviceName)
	}()

	go func() {
		defer wg.Done()
		destinationPolicies, destinationPoliciesErr = in.getDestinationPolicies(namespace, serviceName)
	}()

	go func() {
		defer wg.Done()
		virtualServices, virtualServicesErr = in.getVirtualServices(namespace, serviceName)
	}()

	go func() {
		defer wg.Done()
		destinationRules, destinationRulesErr = in.getDestinationRules(namespace, serviceName)
	}()

	wg.Wait()

	var istioDetails = IstioDetails{}

	istioDetails.RouteRules = routeRules
	if routeRulesErr != nil {
		return nil, routeRulesErr
	}

	istioDetails.DestinationPolicies = destinationPolicies
	if destinationPoliciesErr != nil {
		return nil, destinationPoliciesErr
	}

	istioDetails.VirtualServices = virtualServices
	if virtualServicesErr != nil {
		return nil, virtualServicesErr
	}

	istioDetails.DestinationRules = destinationRules
	if destinationRulesErr != nil {
		return nil, destinationRulesErr
	}

	return &istioDetails, nil
}

func (in *IstioClient) getRouteRules(namespace string, serviceName string) ([]IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(routeRules).Do().Get()
	if err != nil {
		return nil, err
	}
	rulesList, ok := result.(*RouteRuleList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a RouteRule list", namespace, serviceName)
	}
	// RouterRules have its own names non related to the service which are defined.
	// So, to fetch the rules per a specific service we need to filter by destination.
	// Probably in future iterations we might change this if it's not enough.
	routerRules := make([]IstioObject, 0)
	for _, rule := range rulesList.GetItems() {
		if destination, ok := rule.GetSpec()["destination"]; ok {
			dest := destination.(map[string]interface{})
			if dest["name"] == serviceName {
				routerRules = append(routerRules, rule.DeepCopyIstioObject())
			}
		}
	}
	return routerRules, nil
}

func (in *IstioClient) getDestinationPolicies(namespace string, serviceName string) ([]IstioObject, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(destinationPolicies).Do().Get()
	if err != nil {
		return nil, err
	}
	destinationPolicyList, ok := result.(*DestinationPolicyList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a DestinationPolicy list", namespace, serviceName)
	}
	// destinationPolicies have its own names non related to the service which are defined.
	// So, to fetch the rules per a specific service we need to filter by destination.
	// Probably in future iterations we might change this if it's not enough.
	destinationPolicies := make([]IstioObject, 0)
	for _, policy := range destinationPolicyList.Items {
		if destination, ok := policy.Spec["destination"]; ok {
			dest := destination.(map[string]interface{})
			if dest["name"] == serviceName {
				destinationPolicies = append(destinationPolicies, policy.DeepCopyIstioObject())
			}
		}
	}
	return destinationPolicies, nil
}

func (in *IstioClient) getVirtualServices(namespace string, serviceName string) ([]IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(virtualServices).Do().Get()
	if err != nil {
		return nil, err
	}
	virtualServiceList, ok := result.(*VirtualServiceList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a VirtualService list", namespace, serviceName)
	}
	// VirtualServices have its own names non related to the service which are defined.
	// So, to fetch the rules per a specific service we need to filter by hosts.
	// Probably in future iterations we might change this if it's not enough.
	virtualServices := make([]IstioObject, 0)
	for _, virtualService := range virtualServiceList.GetItems() {
		if hosts, ok := virtualService.GetSpec()["hosts"]; ok {
			if hostsArray, ok := hosts.([]interface{}); ok {
				for _, host := range hostsArray {
					if host == serviceName {
						virtualServices = append(virtualServices, virtualService.DeepCopyIstioObject())
						break
					}
				}
			}
		}
	}
	return virtualServices, nil
}

func (in *IstioClient) getDestinationRules(namespace string, serviceName string) ([]IstioObject, error) {
	result, err := in.istioNetworkingApi.Get().Namespace(namespace).Resource(destinationRules).Do().Get()
	if err != nil {
		return nil, err
	}
	destinationRuleList, ok := result.(*DestinationRuleList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a DestinationRule list", namespace, serviceName)
	}
	// DestinationRules have its own names non related to the service which are defined.
	// So, to fetch the rules per a specific service we need to filter by name.
	// Probably in future iterations we might change this if it's not enough.
	destinationRules := make([]IstioObject, 0)
	for _, destinationRule := range destinationRuleList.Items {
		if name, ok := destinationRule.Spec["name"]; ok {
			if name == serviceName {
				destinationRules = append(destinationRules, destinationRule.DeepCopyIstioObject())
			}
		}
	}
	return destinationRules, nil
}
