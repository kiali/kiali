package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/business/checkers/authorization"
	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type AuthorizationPolicyChecker struct {
	Cluster               string
	Conf                  *config.Config
	MtlsDetails           kubernetes.MTLSDetails
	Namespaces            []string
	PolicyAllowAny        bool
	RegistryServices      []*kubernetes.RegistryService
	ServiceAccounts       map[string][]string
	ServiceEntries        []*networking_v1.ServiceEntry
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
	VirtualServices       []*networking_v1.VirtualService
	WorkloadsPerNamespace map[string]models.Workloads
}

func (a AuthorizationPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// Individual validations
	for _, authPolicy := range a.AuthorizationPolicies {
		validations.MergeValidations(a.runChecks(authPolicy))
	}

	// Group Validations
	validations.MergeValidations(authorization.MtlsEnabledChecker{
		AuthorizationPolicies: a.AuthorizationPolicies,
		Cluster:               a.Cluster,
		Conf:                  a.Conf,
		MtlsDetails:           a.MtlsDetails,
		RegistryServices:      a.RegistryServices,
	}.Check())

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (a AuthorizationPolicyChecker) runChecks(authPolicy *security_v1.AuthorizationPolicy) models.IstioValidations {
	policyName := authPolicy.Name
	key, rrValidation := EmptyValidValidation(policyName, authPolicy.Namespace, kubernetes.AuthorizationPolicies, a.Cluster)
	serviceHosts := kubernetes.ServiceEntryHostnames(a.ServiceEntries)
	matchLabels := make(map[string]string)
	if authPolicy.Spec.Selector != nil {
		matchLabels = authPolicy.Spec.Selector.MatchLabels
	}

	enabledCheckers := []Checker{
		common.SelectorNoWorkloadFoundChecker(kubernetes.AuthorizationPolicies, matchLabels, a.WorkloadsPerNamespace),
		authorization.NamespaceMethodChecker{AuthorizationPolicy: authPolicy, Namespaces: a.Namespaces},
		authorization.NoHostChecker{Conf: a.Conf, AuthorizationPolicy: authPolicy, Namespaces: a.Namespaces,
			ServiceEntries: serviceHosts, VirtualServices: a.VirtualServices, RegistryServices: a.RegistryServices, PolicyAllowAny: a.PolicyAllowAny},
		authorization.PrincipalsChecker{Cluster: a.Cluster, AuthorizationPolicy: authPolicy, ServiceAccounts: a.ServiceAccounts},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
