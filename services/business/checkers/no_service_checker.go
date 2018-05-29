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

func (in NoServiceChecker) Check() *models.IstioTypeValidations {
	typeValidations := models.IstioTypeValidations{}
	tempVal := make([]models.IstioTypeValidations, 4)
	for i := 0; i < 4; i++ {
		tempVal[i] = models.IstioTypeValidations{}
	}

	if in.IstioDetails == nil || in.ServiceList == nil {
		return &typeValidations
	}

	serviceNames := getServiceNames(in.ServiceList)

	var wg sync.WaitGroup
	wg.Add(4)

	go runRouteRulesCheck(in.IstioDetails.RouteRules, in.Namespace, serviceNames, &tempVal[0], &wg)
	go runDestinationPoliciesCheck(in.IstioDetails.DestinationPolicies, in.Namespace, serviceNames, &tempVal[1], &wg)
	go runVirtualServicesCheck(in.IstioDetails.VirtualServices, in.Namespace, serviceNames, &tempVal[2], &wg)
	go runDestinationRulesCheck(in.IstioDetails.DestinationRules, in.Namespace, serviceNames, &tempVal[3], &wg)

	wg.Wait()

	for i := 0; i < 4; i++ {
		typeValidations.MergeValidations(&tempVal[i])
	}
	return &typeValidations
}

func runRouteRulesCheck(routeRules []kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioTypeValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	var rrWg sync.WaitGroup
	rrWg.Add(len(routeRules))

	nameValidations := models.IstioNameValidations{}
	(*validations)["routerule"] = &nameValidations

	for _, routeRule := range routeRules {
		go runRouteRuleCheck(routeRule, namespace, serviceNames, &nameValidations, &rrWg)
	}
	rrWg.Wait()
}

func runRouteRuleCheck(routeRule kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioNameValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	istioObjectName := routeRule.GetObjectMeta().Name
	validation := &models.IstioValidation{Name: istioObjectName, ObjectType: "routerule", Valid: true}
	(*validations)[istioObjectName] = validation

	result, valid := route_rules.NoDestinationChecker{
		Namespace:    namespace,
		ServiceNames: serviceNames,
		RouteRule:    routeRule,
	}.Check()

	validation.Checks = append(validation.Checks, result...)
	validation.Valid = valid
}

func runDestinationPoliciesCheck(destinationPolicies []kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioTypeValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	var dpWg sync.WaitGroup
	dpWg.Add(len(destinationPolicies))

	nameValidations := models.IstioNameValidations{}
	(*validations)["destinationpolicy"] = &nameValidations

	for _, destinationPolicy := range destinationPolicies {
		go runDestinationPolicyCheck(destinationPolicy, namespace, serviceNames, &nameValidations, &dpWg)
	}
	dpWg.Wait()
}

func runDestinationPolicyCheck(destinationPolicy kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioNameValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	istioObjectName := destinationPolicy.GetObjectMeta().Name
	validation := &models.IstioValidation{Name: istioObjectName, ObjectType: "destinationpolicy", Valid: true}
	(*validations)[istioObjectName] = validation

	result, valid := destination_policies.NoDestinationChecker{
		Namespace:         namespace,
		ServiceNames:      serviceNames,
		DestinationPolicy: destinationPolicy,
	}.Check()

	validation.Checks = append(validation.Checks, result...)
	validation.Valid = valid
}

func runVirtualServicesCheck(virtualServices []kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioTypeValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	var dpWg sync.WaitGroup
	dpWg.Add(len(virtualServices))

	nameValidations := models.IstioNameValidations{}
	(*validations)["virtualservice"] = &nameValidations

	for _, virtualService := range virtualServices {
		go runVirtualServiceCheck(virtualService, namespace, serviceNames, &nameValidations, &dpWg)
	}
	dpWg.Wait()
}

func runVirtualServiceCheck(virtualService kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioNameValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	istioObjectName := virtualService.GetObjectMeta().Name
	validation := &models.IstioValidation{Name: istioObjectName, ObjectType: "virtualservice", Valid: true}
	(*validations)[istioObjectName] = validation

	result, valid := virtual_services.NoHostChecker{
		Namespace:      namespace,
		ServiceNames:   serviceNames,
		VirtualService: virtualService,
	}.Check()

	validation.Checks = append(validation.Checks, result...)
	validation.Valid = valid
}

func runDestinationRulesCheck(destinationRules []kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioTypeValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	var dpWg sync.WaitGroup
	dpWg.Add(len(destinationRules))

	nameValidations := models.IstioNameValidations{}
	(*validations)["destinationrule"] = &nameValidations

	for _, destinationRule := range destinationRules {
		go runDestinationRuleCheck(destinationRule, namespace, serviceNames, &nameValidations, &dpWg)
	}
	dpWg.Wait()
}

func runDestinationRuleCheck(destinationRule kubernetes.IstioObject, namespace string, serviceNames []string, validations *models.IstioNameValidations, wg *sync.WaitGroup) {
	defer (*wg).Done()
	istioObjectName := destinationRule.GetObjectMeta().Name
	validation := &models.IstioValidation{Name: istioObjectName, ObjectType: "destinationrule", Valid: true}
	(*validations)[istioObjectName] = validation

	result, valid := destination_rules.NoNameChecker{
		Namespace:       namespace,
		ServiceNames:    serviceNames,
		DestinationRule: destinationRule,
	}.Check()

	validation.Checks = append(validation.Checks, result...)
	validation.Valid = valid
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
