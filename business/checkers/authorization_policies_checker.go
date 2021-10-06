package checkers

import (
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/business/checkers/authorization"
	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const AuthorizationPolicyCheckerType = "authorizationpolicy"

type AuthorizationPolicyChecker struct {
	AuthorizationPolicies []kubernetes.IstioObject
	Namespace             string
	Namespaces            models.Namespaces
	ServiceEntries        []kubernetes.IstioObject
	Services              []core_v1.Service
	WorkloadList          models.WorkloadList
	MtlsDetails           kubernetes.MTLSDetails
	VirtualServices       []kubernetes.IstioObject
	RegistryStatus        []*kubernetes.RegistryStatus
}

func (a AuthorizationPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// Individual validations
	for _, authPolicy := range a.AuthorizationPolicies {
		validations.MergeValidations(a.runChecks(authPolicy))
	}

	validations = validations.MergeValidations(a.runGroupChecks())

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (a AuthorizationPolicyChecker) runChecks(authPolicy kubernetes.IstioObject) models.IstioValidations {
	policyName := authPolicy.GetObjectMeta().Name
	key, rrValidation := EmptyValidValidation(policyName, authPolicy.GetObjectMeta().Namespace, AuthorizationPolicyCheckerType)
	serviceHosts := kubernetes.ServiceEntryHostnames(a.ServiceEntries)

	enabledCheckers := []Checker{
		common.SelectorNoWorkloadFoundChecker(AuthorizationPolicyCheckerType, authPolicy, a.WorkloadList),
		authorization.NamespaceMethodChecker{AuthorizationPolicy: authPolicy, Namespaces: a.Namespaces.GetNames()},
		authorization.NoHostChecker{AuthorizationPolicy: authPolicy, Namespace: a.Namespace, Namespaces: a.Namespaces,
			ServiceEntries: serviceHosts, Services: a.Services, VirtualServices: a.VirtualServices, RegistryStatus: a.RegistryStatus},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}

func (a AuthorizationPolicyChecker) runGroupChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	enabledDRCheckers := []GroupChecker{
		authorization.MtlsEnabledChecker{Namespace: a.Namespace, AuthorizationPolicies: a.AuthorizationPolicies, MtlsDetails: a.MtlsDetails},
		authorization.UncoveredWorkloadChecker{AuthorizationPolicies: a.AuthorizationPolicies, WorkloadList: a.WorkloadList},
	}

	for _, checker := range enabledDRCheckers {
		validations = validations.MergeValidations(checker.Check())
	}

	return validations
}
