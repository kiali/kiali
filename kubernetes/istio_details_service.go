package kubernetes

import (
	"fmt"
)

// GetIstioDetails returns Istio details for a given service,
// on this version it describes the RouterRules and destinationPolicies defined for a service.
// A service is defined by the namespace and the service name.
// It returns an error on any problem.
func (in *IstioClient) GetIstioDetails(namespace string, serviceName string) (*IstioDetails, error) {
	routerRulesChan, destinationPoliciesChan := make(chan istioResponse), make(chan istioResponse)

	go func() {
		routerRules, err := in.getRouteRules(namespace, serviceName)
		routerRulesChan <- istioResponse{results: routerRules, err: err}
	}()

	go func() {
		destinationPolicies, err := in.getDestinationPolicies(namespace, serviceName)
		destinationPoliciesChan <- istioResponse{results: destinationPolicies, err: err}
	}()

	var istioDetails = IstioDetails{}

	routeRuleResponse := <-routerRulesChan
	if routeRuleResponse.err != nil {
		return nil, routeRuleResponse.err
	}
	istioDetails.RouteRules = routeRuleResponse.results

	destinationPoliciesResponse := <-destinationPoliciesChan
	if destinationPoliciesResponse.err != nil {
		return nil, destinationPoliciesResponse.err
	}
	istioDetails.DestinationPolicies = destinationPoliciesResponse.results

	return &istioDetails, nil
}

func (in *IstioClient) getRouteRules(namespace string, serviceName string) ([]IstioObject, error) {
	result, err := in.istio.Get().Namespace(namespace).Resource(routeRules).Do().Get()
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
	result, err := in.istio.Get().Namespace(namespace).Resource(destinationPolicies).Do().Get()
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
