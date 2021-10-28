package checkers

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

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
	IstioConfigList      models.IstioConfigList
	ExportedResources    *kubernetes.ExportedResources
	Services             []core_v1.Service
	WorkloadList         models.WorkloadList
	GatewaysPerNamespace [][]networking_v1alpha3.Gateway
	AuthorizationDetails *kubernetes.RBACDetails
	RegistryStatus       []*kubernetes.RegistryStatus
}

func (in NoServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	if in.Services == nil {
		return validations
	}

	serviceNames := getServiceNames(in.Services)
	serviceHosts := kubernetes.ServiceEntryHostnames(append(in.IstioConfigList.ServiceEntries, in.ExportedResources.ServiceEntries...))
	gatewayNames := kubernetes.GatewayNames(in.GatewaysPerNamespace)

	for _, virtualService := range in.IstioConfigList.VirtualServices {
		validations.MergeValidations(runVirtualServiceCheck(virtualService, in.Namespace, serviceNames, serviceHosts, in.Namespaces, in.RegistryStatus))
		validations.MergeValidations(runGatewayCheck(virtualService, gatewayNames))
	}
	for _, destinationRule := range in.IstioConfigList.DestinationRules {
		validations.MergeValidations(runDestinationRuleCheck(destinationRule, in.Namespace, in.WorkloadList, in.Services, serviceHosts, in.Namespaces, in.RegistryStatus, in.IstioConfigList.VirtualServices))
	}
	return validations
}

func runVirtualServiceCheck(virtualService networking_v1alpha3.VirtualService, namespace string, serviceNames []string, serviceHosts map[string][]string, clusterNamespaces models.Namespaces, registryStatus []*kubernetes.RegistryStatus) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.Name, virtualService.Namespace, VirtualCheckerType)

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

func runGatewayCheck(virtualService networking_v1alpha3.VirtualService, gatewayNames map[string]struct{}) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.Name, virtualService.Namespace, VirtualCheckerType)

	result, valid := virtualservices.NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runDestinationRuleCheck(destinationRule networking_v1alpha3.DestinationRule, namespace string, workloads models.WorkloadList,
	services []core_v1.Service, serviceHosts map[string][]string, clusterNamespaces models.Namespaces, registryStatus []*kubernetes.RegistryStatus, virtualServices []networking_v1alpha3.VirtualService) models.IstioValidations {
	key, validations := EmptyValidValidation(destinationRule.Name, destinationRule.Namespace, DestinationRuleCheckerType)

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
