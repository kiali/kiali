package kubernetes

import (
	"fmt"
)

type routeRuleResponse struct {
	routeRules []*RouteRule
	err        error
}

type destinationPolicyResponse struct {
	destinationPolicies []*DestinationPolicy
	err                 error
}

// GetIstioDetails returns Istio details for a given service,
// on this version it describes the RouterRules and DestinationPolicies defined for a service.
// A service is defined by the namespace and the service name.
// It returns an error on any problem.
func (in *IstioClient) GetIstioDetails(namespace string, serviceName string) (*IstioDetails, error) {
	routerRulesChan, destinationPoliciesChan := make(chan routeRuleResponse), make(chan destinationPolicyResponse)

	go func() {
		routerRules, err := in.getRouteRules(namespace, serviceName)
		routerRulesChan <- routeRuleResponse{routeRules: routerRules, err: err}
	}()

	go func() {
		destinationPolicies, err := in.getDestinationPolicies(namespace, serviceName)
		destinationPoliciesChan <- destinationPolicyResponse{destinationPolicies: destinationPolicies, err: err}
	}()

	var istioDetails = IstioDetails{}

	routeRuleResponse := <-routerRulesChan
	if routeRuleResponse.err != nil {
		return nil, routeRuleResponse.err
	}
	istioDetails.RouteRules = routeRuleResponse.routeRules

	destinationPoliciesResponse := <-destinationPoliciesChan
	if destinationPoliciesResponse.err != nil {
		return nil, destinationPoliciesResponse.err
	}
	istioDetails.DestinationPolicies = destinationPoliciesResponse.destinationPolicies

	return &istioDetails, nil
}

func (in *IstioClient) getRouteRules(namespace string, serviceName string) ([]*RouteRule, error) {
	result, err := in.istio.Get().Namespace(namespace).Resource(RouteRules).Do().Get()
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
	routerRules := make([]*RouteRule, 0)
	for _, rule := range rulesList.Items {
		if destination, ok := rule.Spec["destination"]; ok {
			dest := destination.(map[string]interface{})
			if dest["name"] == serviceName {
				routerRules = append(routerRules, rule.DeepCopy())
			}
		}
	}
	return routerRules, nil
}

func (in *IstioClient) getDestinationPolicies(namespace string, serviceName string) ([]*DestinationPolicy, error) {
	result, err := in.istio.Get().Namespace(namespace).Resource(DestinationPolicies).Do().Get()
	if err != nil {
		return nil, err
	}
	destinationPolicyList, ok := result.(*DestinationPolicyList)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a DestinationPolicy list", namespace, serviceName)
	}
	// DestinationPolicies have its own names non related to the service which are defined.
	// So, to fetch the rules per a specific service we need to filter by destination.
	// Probably in future iterations we might change this if it's not enough.
	destinationPolicies := make([]*DestinationPolicy, 0)
	for _, policy := range destinationPolicyList.Items {
		if destination, ok := policy.Spec["destination"]; ok {
			dest := destination.(map[string]interface{})
			if dest["name"] == serviceName {
				destinationPolicies = append(destinationPolicies, policy.DeepCopy())
			}
		}
	}
	return destinationPolicies, nil
}
