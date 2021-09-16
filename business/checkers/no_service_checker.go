package checkers

import (
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/business/checkers/destinationrules"
	"github.com/kiali/kiali/business/checkers/virtualservices"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const ServiceRoleCheckerType = "servicerole"

type NoServiceChecker struct {
	Namespace            string
	Namespaces           models.Namespaces
	IstioDetails         *kubernetes.IstioDetails
	ExportedResources    *kubernetes.ExportedResources
	Services             []core_v1.Service
	WorkloadList         models.WorkloadList
	GatewaysPerNamespace [][]kubernetes.IstioObject
	AuthorizationDetails *kubernetes.RBACDetails
	RegistryStatus       []*kubernetes.RegistryStatus
}

func (in NoServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	if in.IstioDetails == nil || in.Services == nil {
		return validations
	}

	serviceNames := getServiceNames(in.Services)
	serviceHosts := kubernetes.ServiceEntryHostnames(append(in.IstioDetails.ServiceEntries, in.ExportedResources.ServiceEntries...))
	gatewayNames := kubernetes.GatewayNames(in.GatewaysPerNamespace)

	for _, virtualService := range in.IstioDetails.VirtualServices {
		validations.MergeValidations(runVirtualServiceCheck(virtualService, in.Namespace, serviceNames, serviceHosts, in.Namespaces, in.RegistryStatus))
		validations.MergeValidations(runGatewayCheck(virtualService, gatewayNames))
	}
	for _, destinationRule := range in.IstioDetails.DestinationRules {
		validations.MergeValidations(runDestinationRuleCheck(destinationRule, in.Namespace, in.WorkloadList, in.Services, serviceHosts, in.Namespaces, in.RegistryStatus, in.IstioDetails.VirtualServices))
	}
	return validations
}

func runVirtualServiceCheck(virtualService kubernetes.IstioObject, namespace string, serviceNames []string, serviceHosts map[string][]string, clusterNamespaces models.Namespaces, registryStatus []*kubernetes.RegistryStatus) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.GetObjectMeta().Name, virtualService.GetObjectMeta().Namespace, VirtualCheckerType)

	result, valid := virtualservices.NoHostChecker{
		Namespace:         namespace,
		Namespaces:        clusterNamespaces,
		ServiceNames:      serviceNames,
		VirtualService:    virtualService,
		ServiceEntryHosts: serviceHosts,
		RegistryStatus:    registryStatus,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runGatewayCheck(virtualService kubernetes.IstioObject, gatewayNames map[string]struct{}) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.GetObjectMeta().Name, virtualService.GetObjectMeta().Namespace, VirtualCheckerType)

	result, valid := virtualservices.NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runDestinationRuleCheck(destinationRule kubernetes.IstioObject, namespace string, workloads models.WorkloadList,
	services []core_v1.Service, serviceHosts map[string][]string, clusterNamespaces models.Namespaces, registryStatus []*kubernetes.RegistryStatus, virtualServices []kubernetes.IstioObject) models.IstioValidations {
	key, validations := EmptyValidValidation(destinationRule.GetObjectMeta().Name, destinationRule.GetObjectMeta().Namespace, DestinationRuleCheckerType)

	result, valid := destinationrules.NoDestinationChecker{
		Namespace:       namespace,
		Namespaces:      clusterNamespaces,
		WorkloadList:    workloads,
		DestinationRule: destinationRule,
		VirtualServices: virtualServices,
		Services:        services,
		ServiceEntries:  serviceHosts,
		RegistryStatus:  registryStatus,
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
