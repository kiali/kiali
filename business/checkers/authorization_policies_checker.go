package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/business/checkers/authorization"
	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type AuthorizationPolicyChecker struct {
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
	Cluster               string
	Conf                  *config.Config
	IdentityDomain        string
	KubeServiceHosts      kubernetes.KubeServiceHosts
	MtlsDetails           kubernetes.MTLSDetails
	Namespaces            []string
	PolicyAllowAny        bool
	ServiceAccounts       map[string][]string
	ServiceEntries        []*networking_v1.ServiceEntry
	Services              []core_v1.Service
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
		IdentityDomain:        a.IdentityDomain,
		MtlsDetails:           a.MtlsDetails,
		Services:              a.Services,
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
		authorization.NoHostChecker{AuthorizationPolicy: authPolicy, IdentityDomain: a.IdentityDomain, KubeServiceHosts: a.KubeServiceHosts,
			Namespaces: a.Namespaces, PolicyAllowAny: a.PolicyAllowAny, ServiceEntries: serviceHosts, VirtualServices: a.VirtualServices},
		authorization.PrincipalsChecker{AuthorizationPolicy: authPolicy, Cluster: a.Cluster, ServiceAccounts: a.ServiceAccounts},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
