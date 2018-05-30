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

	if in.IstioDetails == nil || in.ServiceList == nil {
		return validations
	}

	tempVal := makeTempValidations(4)
	serviceNames := getServiceNames(in.ServiceList)

	var wg sync.WaitGroup
	wg.Add(4)

	go runRouteRulesCheck(in.IstioDetails.RouteRules, in.Namespace, serviceNames, &tempVal[0], &wg)
	go runDestinationPoliciesCheck(in.IstioDetails.DestinationPolicies, in.Namespace, serviceNames, &tempVal[1], &wg)
	go runVirtualServicesCheck(in.IstioDetails.VirtualServices, in.Namespace, serviceNames, &tempVal[2], &wg)
	go runDestinationRulesCheck(in.IstioDetails.DestinationRules, in.Namespace, serviceNames, &tempVal[3], &wg)

	wg.Wait()
	mergeTempValidations(tempVal, &validations)

	return validations
}

func makeTempValidations(len int) []models.IstioValidations {
	tempVal := make([]models.IstioValidations, len)
	for i := range tempVal {
		tempVal[i] = make(models.IstioValidations)
	}
	return tempVal
}

func mergeTempValidations(tempVal []models.IstioValidations, result *models.IstioValidations) {
	for i := range tempVal {
		(*result).MergeValidations(tempVal[i])
	}
}

func runRouteRulesCheck(routeRules []kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	var rrWg sync.WaitGroup
	rrWg.Add(len(routeRules))
	tempVal := makeTempValidations(len(routeRules))

	for i, routeRule := range routeRules {
		go runRouteRuleCheck(routeRule, namespace, serviceNames, &tempVal[i], &rrWg)
	}

	rrWg.Wait()
	mergeTempValidations(tempVal, validations)
}

func runRouteRuleCheck(routeRule kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()

	result, valid := route_rules.NoDestinationChecker{
		Namespace:    namespace,
		ServiceNames: serviceNames,
		RouteRule:    routeRule,
	}.Check()

	istioObjectName := routeRule.GetObjectMeta().Name
	key := models.IstioValidationKey{ObjectType: "routerule", Name: istioObjectName}
	(*validations)[key] = &models.IstioValidation{
		Name:       istioObjectName,
		ObjectType: "routerule",
		Checks:     result,
		Valid:      valid,
	}
}

func runDestinationPoliciesCheck(destinationPolicies []kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	var dpWg sync.WaitGroup
	dpWg.Add(len(destinationPolicies))
	tempVal := makeTempValidations(len(destinationPolicies))

	for i, destinationPolicy := range destinationPolicies {
		go runDestinationPolicyCheck(destinationPolicy, namespace, serviceNames, &tempVal[i], &dpWg)
	}

	dpWg.Wait()
	mergeTempValidations(tempVal, validations)
}

func runDestinationPolicyCheck(destinationPolicy kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	result, valid := destination_policies.NoDestinationChecker{
		Namespace:         namespace,
		ServiceNames:      serviceNames,
		DestinationPolicy: destinationPolicy,
	}.Check()

	istioObjectName := destinationPolicy.GetObjectMeta().Name
	key := models.IstioValidationKey{ObjectType: "destinationpolicy", Name: istioObjectName}
	(*validations)[key] = &models.IstioValidation{
		Name:       istioObjectName,
		ObjectType: "destinationpolicy",
		Checks:     result,
		Valid:      valid,
	}
}

func runVirtualServicesCheck(virtualServices []kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	var dpWg sync.WaitGroup
	dpWg.Add(len(virtualServices))
	tempVal := makeTempValidations(len(virtualServices))

	for i, virtualService := range virtualServices {
		go runVirtualServiceCheck(virtualService, namespace, serviceNames, &tempVal[i], &dpWg)
	}

	dpWg.Wait()
	mergeTempValidations(tempVal, validations)
}

func runVirtualServiceCheck(virtualService kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()

	result, valid := virtual_services.NoHostChecker{
		Namespace:      namespace,
		ServiceNames:   serviceNames,
		VirtualService: virtualService,
	}.Check()

	istioObjectName := virtualService.GetObjectMeta().Name
	key := models.IstioValidationKey{ObjectType: "virtualservice", Name: istioObjectName}
	(*validations)[key] = &models.IstioValidation{
		Name:       istioObjectName,
		ObjectType: "virtualservice",
		Checks:     result,
		Valid:      valid,
	}
}

func runDestinationRulesCheck(destinationRules []kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()
	var dpWg sync.WaitGroup
	dpWg.Add(len(destinationRules))
	tempVal := makeTempValidations(len(destinationRules))

	for i, destinationRule := range destinationRules {
		go runDestinationRuleCheck(destinationRule, namespace, serviceNames, &tempVal[i], &dpWg)
	}

	dpWg.Wait()
	mergeTempValidations(tempVal, validations)
}

func runDestinationRuleCheck(destinationRule kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioValidations, wg *sync.WaitGroup) {
	defer wg.Done()

	result, valid := destination_rules.NoNameChecker{
		Namespace:       namespace,
		ServiceNames:    serviceNames,
		DestinationRule: destinationRule,
	}.Check()

	istioObjectName := destinationRule.GetObjectMeta().Name
	key := models.IstioValidationKey{ObjectType: "destinationrule", Name: istioObjectName}
	(*validations)[key] = &models.IstioValidation{
		Name:       istioObjectName,
		ObjectType: "destinationrule",
		Checks:     result,
		Valid:      valid,
	}
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
