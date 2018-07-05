package checkers

import (
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

	if in.IstioDetails == nil || in.ServiceList == nil {
		return validations
	}

	nbValidations := len(in.IstioDetails.VirtualServices) + len(in.IstioDetails.DestinationRules)
	validationsc := make(chan models.IstioValidations, nbValidations)
	serviceNames := getServiceNames(in.ServiceList)

	for _, virtualService := range in.IstioDetails.VirtualServices {
		go runVirtualServiceCheck(virtualService, in.Namespace, serviceNames, validationsc)
	}
	for _, destinationRule := range in.IstioDetails.DestinationRules {
		go runDestinationRuleCheck(destinationRule, in.Namespace, serviceNames, validationsc)
	}

	for i := 0; i < nbValidations; i++ {
		validations.MergeValidations(<-validationsc)
	}
	return validations
}

func runVirtualServiceCheck(virtualService kubernetes.IstioObject, namespace string, serviceNames []string, validationsc chan models.IstioValidations) {
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

func runDestinationRuleCheck(destinationRule kubernetes.IstioObject, namespace string, serviceNames []string, drvalidationsc chan models.IstioValidations) {
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
