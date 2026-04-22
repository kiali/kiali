package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/business/checkers/destinationrules"
	"github.com/kiali/kiali/business/checkers/virtualservices"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoServiceChecker struct {
	AuthorizationDetails  *kubernetes.RBACDetails
	Cluster               string
	Conf                  *config.Config
	IdentityDomain        string
	IstioConfigList       *models.IstioConfigList
	KubeServiceHosts      kubernetes.KubeServiceHosts
	Namespaces            models.Namespaces
	PolicyAllowAny        bool
	Services              []core_v1.Service
	WorkloadsPerNamespace map[string]models.Workloads
}

func (in NoServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	serviceHosts := kubernetes.ServiceEntryHostnames(in.IstioConfigList.ServiceEntries)
	gatewayNames := kubernetes.GatewayNames(in.IstioConfigList.Gateways, in.IdentityDomain)

	for _, virtualService := range in.IstioConfigList.VirtualServices {
		validations.MergeValidations(runVirtualServiceCheck(virtualService, serviceHosts, in.Namespaces, in.KubeServiceHosts, in.PolicyAllowAny, in.Cluster, in.IdentityDomain))

		validations.MergeValidations(runGatewayCheck(virtualService, gatewayNames, in.Cluster, in.IdentityDomain))
	}
	for _, destinationRule := range in.IstioConfigList.DestinationRules {
		validations.MergeValidations(runDestinationRuleCheck(destinationRule, in.WorkloadsPerNamespace, in.IstioConfigList.ServiceEntries, in.Namespaces, in.KubeServiceHosts, in.Services, in.IstioConfigList.VirtualServices, in.PolicyAllowAny, in.Cluster, in.Conf, in.IdentityDomain))
	}
	return validations
}

func runVirtualServiceCheck(virtualService *networking_v1.VirtualService, serviceHosts map[string][]string, clusterNamespaces models.Namespaces, kubeServiceHosts kubernetes.KubeServiceHosts, policyAllowAny bool, cluster string, identityDomain string) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.Name, virtualService.Namespace, kubernetes.VirtualServices, cluster)

	result, valid := virtualservices.NoHostChecker{
		IdentityDomain:    identityDomain,
		Namespaces:        clusterNamespaces.GetNames(),
		VirtualService:    virtualService,
		ServiceEntryHosts: serviceHosts,
		KubeServiceHosts:  kubeServiceHosts,
		PolicyAllowAny:    policyAllowAny,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runGatewayCheck(virtualService *networking_v1.VirtualService, gatewayNames map[string]struct{}, cluster string, identityDomain string) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.Name, virtualService.Namespace, kubernetes.VirtualServices, cluster)

	result, valid := virtualservices.NoGatewayChecker{
		GatewayNames:   gatewayNames,
		IdentityDomain: identityDomain,
		VirtualService: virtualService,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}

func runDestinationRuleCheck(destinationRule *networking_v1.DestinationRule, workloads map[string]models.Workloads,
	serviceEntries []*networking_v1.ServiceEntry, clusterNamespaces models.Namespaces, kubeServiceHosts kubernetes.KubeServiceHosts, services []core_v1.Service, virtualServices []*networking_v1.VirtualService,
	policyAllowAny bool, cluster string, conf *config.Config, identityDomain string) models.IstioValidations {
	key, validations := EmptyValidValidation(destinationRule.Name, destinationRule.Namespace, kubernetes.DestinationRules, cluster)

	result, valid := destinationrules.NoDestinationChecker{
		Conf:                  conf,
		IdentityDomain:        identityDomain,
		Namespaces:            clusterNamespaces.GetNames(),
		WorkloadsPerNamespace: workloads,
		DestinationRule:       destinationRule,
		VirtualServices:       virtualServices,
		ServiceEntries:        serviceEntries,
		KubeServiceHosts:      kubeServiceHosts,
		Services:              services,
		PolicyAllowAny:        policyAllowAny,
	}.Check()

	validations.Valid = valid
	validations.Checks = result

	return models.IstioValidations{key: validations}
}
