package checkers

import (
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/business/checkers/k8shttproutes"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const K8sHTTPRouteCheckerType = "k8shttproute"

type K8sHTTPRouteChecker struct {
	Cluster            string
	K8sGateways        []*k8s_networking_v1.Gateway
	K8sHTTPRoutes      []*k8s_networking_v1.HTTPRoute
	K8sReferenceGrants []*k8s_networking_v1beta1.ReferenceGrant
	Namespaces         models.Namespaces
	RegistryServices   []*kubernetes.RegistryService
}

// Check runs checks for the all namespaces actions as well as for the single namespace validations
func (in K8sHTTPRouteChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(in.runIndividualChecks())

	return validations
}

// Runs individual checks for each HTTP Route
func (in K8sHTTPRouteChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	gatewayNames := kubernetes.K8sGatewayNames(in.K8sGateways)

	for _, rt := range in.K8sHTTPRoutes {
		validations.MergeValidations(in.runChecks(rt, gatewayNames))
	}

	return validations
}

func (in K8sHTTPRouteChecker) runChecks(rt *k8s_networking_v1.HTTPRoute, gatewayNames map[string]k8s_networking_v1.Gateway) models.IstioValidations {
	key, validations := EmptyValidValidation(rt.Name, rt.Namespace, K8sHTTPRouteCheckerType, in.Cluster)

	enabledCheckers := []Checker{
		k8shttproutes.NoK8sGatewayChecker{
			Cluster:      in.Cluster,
			K8sHTTPRoute: rt,
			GatewayNames: gatewayNames,
			Namespaces:   in.Namespaces,
		},
		k8shttproutes.NoHostChecker{
			Namespaces:         in.Namespaces,
			K8sHTTPRoute:       rt,
			K8sReferenceGrants: in.K8sReferenceGrants,
			RegistryServices:   in.RegistryServices,
		},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
