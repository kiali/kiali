package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

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
	IsGatewayToNamespace  bool
	IstioConfigList       *models.IstioConfigList
	KubeServiceHosts      kubernetes.KubeServiceHosts
	Namespaces            models.Namespaces
	PolicyAllowAny        bool
	Services              []core_v1.Service
	ValidatingNamespace   string
	WorkloadsPerNamespace map[string]models.Workloads
}

func (in NoServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	serviceHosts := kubernetes.ServiceEntryHostnames(in.IstioConfigList.ServiceEntries)
	gatewayNames := kubernetes.GatewayNames(in.IstioConfigList.Gateways, in.IdentityDomain)
	gatewayWorkloadScope := in.gatewayWorkloadScope()

	for _, virtualService := range in.IstioConfigList.VirtualServices {
		validations.MergeValidations(runVirtualServiceCheck(virtualService, serviceHosts, in.Namespaces, in.KubeServiceHosts, in.PolicyAllowAny, in.Cluster, in.IdentityDomain, in.ValidatingNamespace, gatewayWorkloadScope))

		validations.MergeValidations(runGatewayCheck(virtualService, gatewayNames, in.Cluster, in.IdentityDomain))
	}
	for _, destinationRule := range in.IstioConfigList.DestinationRules {
		validations.MergeValidations(runDestinationRuleCheck(destinationRule, in.WorkloadsPerNamespace, in.IstioConfigList.ServiceEntries, in.Namespaces, in.KubeServiceHosts, in.Services, in.IstioConfigList.VirtualServices, in.PolicyAllowAny, in.Cluster, in.Conf, in.IdentityDomain))
	}
	return validations
}

// gatewayWorkloadScope resolves only gateways referenced by gateway-only routes.
// The index and results are built lazily and reused across this namespace's
// VirtualServices, including negative results. Nothing persists across validations.
func (in NoServiceChecker) gatewayWorkloadScope() virtualservices.GatewayWorkloadScope {
	if in.ValidatingNamespace == "" || len(in.IstioConfigList.VirtualServices) == 0 || len(in.IstioConfigList.Gateways) == 0 {
		return nil
	}
	var gateways map[string]*networking_v1.Gateway
	var scope map[string]bool
	return func(host kubernetes.Host) (bool, bool) {
		key := host.String()
		if applies, cached := scope[key]; cached {
			return applies, true
		}
		if gateways == nil {
			gateways = make(map[string]*networking_v1.Gateway, len(in.IstioConfigList.Gateways))
			for _, gateway := range in.IstioConfigList.Gateways {
				gateways[kubernetes.ParseHost(gateway.Name, gateway.Namespace, in.IdentityDomain).String()] = gateway
			}
		}
		gateway, known := gateways[key]
		if !known {
			return false, false
		}
		applies := false
		workloads := in.WorkloadsPerNamespace[in.ValidatingNamespace]
		if (!in.IsGatewayToNamespace || gateway.Namespace == in.ValidatingNamespace) && len(workloads) > 0 {
			selector := labels.SelectorFromSet(gateway.Spec.Selector)
			for _, workload := range workloads {
				if selector.Matches(labels.Set(workload.Labels)) {
					applies = true
					break
				}
			}
		}
		if scope == nil {
			scope = make(map[string]bool)
		}
		scope[key] = applies
		return applies, true
	}
}

func runVirtualServiceCheck(virtualService *networking_v1.VirtualService, serviceHosts map[string][]string, clusterNamespaces models.Namespaces, kubeServiceHosts kubernetes.KubeServiceHosts, policyAllowAny bool, cluster string, identityDomain string, validatingNamespace string, gatewayWorkloadScope virtualservices.GatewayWorkloadScope) models.IstioValidations {
	key, validations := EmptyValidValidation(virtualService.Name, virtualService.Namespace, kubernetes.VirtualServices, cluster)

	result, valid := virtualservices.NoHostChecker{
		GatewayWorkloadScope: gatewayWorkloadScope,
		IdentityDomain:       identityDomain,
		KubeServiceHosts:     kubeServiceHosts,
		Namespaces:           clusterNamespaces.GetNames(),
		PolicyAllowAny:       policyAllowAny,
		ServiceEntryHosts:    serviceHosts,
		ValidatingNamespace:  validatingNamespace,
		VirtualService:       virtualService,
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
