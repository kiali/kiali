package checkers

import (
	"sync"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers/destination_policies"
	"github.com/kiali/kiali/services/business/checkers/destination_rules"
	"github.com/kiali/kiali/services/business/checkers/route_rules"
	"github.com/kiali/kiali/services/business/checkers/virtual_services"
	"github.com/kiali/kiali/services/models"
)

type NoServiceChecker struct {
	Namespace    string
	IstioDetails *kubernetes.IstioDetails
	ServiceList  *kubernetes.ServiceList
}

func (in NoServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}
	validationsc := make(chan models.IstioValidations)

	if in.IstioDetails == nil || in.ServiceList == nil {
		return validations
	}

	serviceNames := getServiceNames(in.ServiceList)

	var wg sync.WaitGroup
	wg.Add(4)

	go runRouteRulesCheck(in.IstioDetails.RouteRules, in.Namespace, serviceNames, validationsc, &wg)
	go runDestinationPoliciesCheck(in.IstioDetails.DestinationPolicies, in.Namespace, serviceNames, validationsc, &wg)
	go runVirtualServicesCheck(in.IstioDetails.VirtualServices, in.Namespace, serviceNames, validationsc, &wg)
	go runDestinationRulesCheck(in.IstioDetails.DestinationRules, in.Namespace, serviceNames, validationsc, &wg)

	go func() {
		wg.Wait()
		// Closing the channel stop the range loop below
		close(validationsc)
	}()

	for v := range validationsc {
		validations.MergeValidations(v)
	}
	return validations
}

func runRouteRulesCheck(routeRules []kubernetes.IstioObject, namespace string, serviceNames []string, validationsc chan models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	var rrWg sync.WaitGroup
	rrWg.Add(len(routeRules))

	for _, routeRule := range routeRules {
		go runRouteRuleCheck(routeRule, namespace, serviceNames, validationsc, &rrWg)
	}

	rrWg.Wait()
}

func runRouteRuleCheck(routeRule kubernetes.IstioObject, namespace string, serviceNames []string, validationsc chan models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()

	result, valid := route_rules.NoDestinationChecker{
		Namespace:    namespace,
		ServiceNames: serviceNames,
		RouteRule:    routeRule,
	}.Check()

	istioObjectName := routeRule.GetObjectMeta().Name
	key := models.IstioValidationKey{ObjectType: "routerule", Name: istioObjectName}
	rrvalidations := models.IstioValidations{}
	rrvalidations[key] = &models.IstioValidation{
		Name:       istioObjectName,
		ObjectType: "routerule",
		Checks:     result,
		Valid:      valid,
	}
	validationsc <- rrvalidations
}

func runDestinationPoliciesCheck(destinationPolicies []kubernetes.IstioObject, namespace string, serviceNames []string, validationsc chan models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	var dpWg sync.WaitGroup
	dpWg.Add(len(destinationPolicies))

	for _, destinationPolicy := range destinationPolicies {
		go runDestinationPolicyCheck(destinationPolicy, namespace, serviceNames, validationsc, &dpWg)
	}

	dpWg.Wait()
}

func runDestinationPolicyCheck(destinationPolicy kubernetes.IstioObject, namespace string, serviceNames []string, validationsc chan models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	result, valid := destination_policies.NoDestinationChecker{
		Namespace:         namespace,
		ServiceNames:      serviceNames,
		DestinationPolicy: destinationPolicy,
	}.Check()

	istioObjectName := destinationPolicy.GetObjectMeta().Name
	key := models.IstioValidationKey{ObjectType: "destinationpolicy", Name: istioObjectName}
	dpvalidations := models.IstioValidations{}
	dpvalidations[key] = &models.IstioValidation{
		Name:       istioObjectName,
		ObjectType: "destinationpolicy",
		Checks:     result,
		Valid:      valid,
	}
	validationsc <- dpvalidations
}

func runVirtualServicesCheck(virtualServices []kubernetes.IstioObject, namespace string, serviceNames []string, validationsc chan models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	var dpWg sync.WaitGroup
	dpWg.Add(len(virtualServices))

	for _, virtualService := range virtualServices {
		go runVirtualServiceCheck(virtualService, namespace, serviceNames, validationsc, &dpWg)
	}

	dpWg.Wait()
}

func runVirtualServiceCheck(virtualService kubernetes.IstioObject, namespace string, serviceNames []string, validationsc chan models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()

	result, valid := virtual_services.NoHostChecker{
		Namespace:      namespace,
		ServiceNames:   serviceNames,
		VirtualService: virtualService,
	}.Check()

	istioObjectName := virtualService.GetObjectMeta().Name
	key := models.IstioValidationKey{ObjectType: "virtualservice", Name: istioObjectName}
	vsvalidations := models.IstioValidations{}
	vsvalidations[key] = &models.IstioValidation{
		Name:       istioObjectName,
		ObjectType: "virtualservice",
		Checks:     result,
		Valid:      valid,
	}
	validationsc <- vsvalidations
}

func runDestinationRulesCheck(destinationRules []kubernetes.IstioObject, namespace string, serviceNames []string, validationsc chan models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	var drWg sync.WaitGroup
	drWg.Add(len(destinationRules))

	for _, destinationRule := range destinationRules {
		go runDestinationRuleCheck(destinationRule, namespace, serviceNames, validationsc, &drWg)
	}

	drWg.Wait()
}

func runDestinationRuleCheck(destinationRule kubernetes.IstioObject, namespace string, serviceNames []string, drvalidationsc chan models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()

	result, valid := destination_rules.NoNameChecker{
		Namespace:       namespace,
		ServiceNames:    serviceNames,
		DestinationRule: destinationRule,
	}.Check()

	istioObjectName := destinationRule.GetObjectMeta().Name
	key := models.IstioValidationKey{ObjectType: "destinationrule", Name: istioObjectName}
	drvalidations := models.IstioValidations{}
	drvalidations[key] = &models.IstioValidation{
		Name:       istioObjectName,
		ObjectType: "destinationrule",
		Checks:     result,
		Valid:      valid,
	}
	drvalidationsc <- drvalidations
}

func getServiceNames(serviceList *kubernetes.ServiceList) []string {
	serviceNames := make([]string, 0)
	if serviceList != nil && serviceList.Services != nil {
		for _, item := range serviceList.Services.Items {
			serviceNames = append(serviceNames, item.Name)
		}
	}
	return serviceNames
}
