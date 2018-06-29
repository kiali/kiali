package checkers

import (
	"sync"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/business/checkers/destination_rules"
	"github.com/kiali/kiali/services/business/checkers/virtual_services"
	"github.com/kiali/kiali/services/models"
	"k8s.io/api/core/v1"
)

type NoServiceChecker struct {
	Namespace    string
	IstioDetails *kubernetes.IstioDetails
	ServiceList  *v1.ServiceList
}

func (in NoServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}
	validationsc := make(chan models.IstioValidations)

	if in.IstioDetails == nil || in.ServiceList == nil {
		return validations
	}

	serviceNames := getServiceNames(in.ServiceList)

	var wg sync.WaitGroup
	wg.Add(2)

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

	result, valid := destination_rules.NoHostChecker{
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

func getServiceNames(serviceList *v1.ServiceList) []string {
	serviceNames := make([]string, 0)
	if serviceList != nil {
		for _, item := range serviceList.Items {
			serviceNames = append(serviceNames, item.Name)
		}
	}
	return serviceNames
}
