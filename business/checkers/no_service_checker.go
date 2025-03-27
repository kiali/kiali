package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/destinationrules"
	"github.com/kiali/kiali/business/checkers/virtualservices"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoServiceChecker struct {
	Conf                  *config.Config
	Namespaces            models.Namespaces
	IstioConfigList       *models.IstioConfigList
	WorkloadsPerNamespace map[string]models.Workloads
	AuthorizationDetails  *kubernetes.RBACDetails
	RegistryServices      []*kubernetes.RegistryService
	PolicyAllowAny        bool
	Cluster               string
}

func (in NoServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	if len(in.RegistryServices) == 0 {
		return validations
	}

	serviceHosts := kubernetes.ServiceEntryHostnames(in.IstioConfigList.ServiceEntries)
	gatewayNames := kubernetes.GatewayNames(in.IstioConfigList.Gateways, in.Conf)

	for _, virtualService := range in.IstioConfigList.VirtualServices {
		validations.MergeValidations(runVirtualServiceCheck(virtualService, serviceHosts, in.Namespaces, in.RegistryServices, in.PolicyAllowAny, in.Cluster, in.Conf))

		validations.MergeValidations(runGatewayCheck(virtualService, gatewayNames, in.Cluster, in.Conf))
	}
	for _, destinationRule := range in.IstioConfigList.DestinationRules {
		validations.MergeValidations(runDestinationRuleCheck(destinationRule, in.WorkloadsPerNamespace, in.IstioConfigList.ServiceEntries, in.Namespaces, in.RegistryServices, in.IstioConfigList.VirtualServices, in.PolicyAllowAny, in.Cluster, in.Conf))
	}
	return validations
}

func runVirtualServiceCheck(virtualService *networking_v1.VirtualService, serviceHosts map[string][]string, clusterNamespaces models.Namespaces, registryStatus []*kubernetes.RegistryService, policyAllowAny bool, cluster string, conf *config.Config) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.Name, virtualService.Namespace, kubernetes.VirtualServices, cluster)

	result, valid := virtualservices.NoHostChecker{
		Conf:              conf,
		Namespaces:        clusterNamespaces.GetNames(),
		VirtualService:    virtualService,
		ServiceEntryHosts: serviceHosts,
		RegistryServices:  registryStatus,
		PolicyAllowAny:    policyAllowAny,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runGatewayCheck(virtualService *networking_v1.VirtualService, gatewayNames map[string]struct{}, cluster string, conf *config.Config) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.Name, virtualService.Namespace, kubernetes.VirtualServices, cluster)

	result, valid := virtualservices.NoGatewayChecker{
		Conf:           conf,
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runDestinationRuleCheck(destinationRule *networking_v1.DestinationRule, workloads map[string]models.Workloads,
	serviceEntries []*networking_v1.ServiceEntry, clusterNamespaces models.Namespaces, registryStatus []*kubernetes.RegistryService, virtualServices []*networking_v1.VirtualService,
	policyAllowAny bool, cluster string, conf *config.Config) models.IstioValidations {
	key, validations := EmptyValidValidation(destinationRule.Name, destinationRule.Namespace, kubernetes.DestinationRules, cluster)

	result, valid := destinationrules.NoDestinationChecker{
		Conf:                  conf,
		Namespaces:            clusterNamespaces.GetNames(),
		WorkloadsPerNamespace: workloads,
		DestinationRule:       destinationRule,
		VirtualServices:       virtualServices,
		ServiceEntries:        serviceEntries,
		RegistryServices:      registryStatus,
		PolicyAllowAny:        policyAllowAny,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}
