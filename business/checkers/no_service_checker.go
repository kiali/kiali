package checkers

import (
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/business/checkers/destinationrules"
	"github.com/kiali/kiali/business/checkers/virtual_services"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const ServiceRoleCheckerType = "servicerole"

type NoServiceChecker struct {
	Namespace            string
	Namespaces           models.Namespaces
	IstioDetails         *kubernetes.IstioDetails
	Services             []core_v1.Service
	WorkloadList         models.WorkloadList
	GatewaysPerNamespace [][]kubernetes.IstioObject
	AuthorizationDetails *kubernetes.RBACDetails
}

func (in NoServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	if in.IstioDetails == nil || in.Services == nil {
		return validations
	}

	serviceNames := getServiceNames(in.Services)
	serviceHosts := kubernetes.ServiceEntryHostnames(in.IstioDetails.ServiceEntries)
	gatewayNames := kubernetes.GatewayNames(in.GatewaysPerNamespace)

	for _, virtualService := range in.IstioDetails.VirtualServices {
		validations.MergeValidations(runVirtualServiceCheck(virtualService, in.Namespace, serviceNames, serviceHosts, in.Namespaces))
		validations.MergeValidations(runGatewayCheck(virtualService, gatewayNames))
	}
	for _, destinationRule := range in.IstioDetails.DestinationRules {
		validations.MergeValidations(runDestinationRuleCheck(destinationRule, in.Namespace, in.WorkloadList, in.Services, serviceHosts, in.Namespaces))
	}
	return validations
}

func runVirtualServiceCheck(virtualService kubernetes.IstioObject, namespace string, serviceNames []string, serviceHosts map[string][]string, clusterNamespaces models.Namespaces) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.GetObjectMeta().Name, virtualService.GetObjectMeta().Namespace, VirtualCheckerType)

	result, valid := virtual_services.NoHostChecker{
		Namespace:         namespace,
		Namespaces:        clusterNamespaces,
		ServiceNames:      serviceNames,
		VirtualService:    virtualService,
		ServiceEntryHosts: serviceHosts,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runGatewayCheck(virtualService kubernetes.IstioObject, gatewayNames map[string]struct{}) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.GetObjectMeta().Name, virtualService.GetObjectMeta().Namespace, VirtualCheckerType)

	result, valid := virtual_services.NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runDestinationRuleCheck(destinationRule kubernetes.IstioObject, namespace string, workloads models.WorkloadList,
	services []core_v1.Service, serviceHosts map[string][]string, clusterNamespaces models.Namespaces) models.IstioValidations {
	key, validations := EmptyValidValidation(destinationRule.GetObjectMeta().Name, destinationRule.GetObjectMeta().Namespace, DestinationRuleCheckerType)

	result, valid := destinationrules.NoDestinationChecker{
		Namespace:       namespace,
		Namespaces:      clusterNamespaces,
		WorkloadList:    workloads,
		DestinationRule: destinationRule,
		Services:        services,
		ServiceEntries:  serviceHosts,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func getServiceNames(services []core_v1.Service) []string {
	serviceNames := make([]string, 0)
	for _, item := range services {
		serviceNames = append(serviceNames, item.Name)
	}
	return serviceNames
}
