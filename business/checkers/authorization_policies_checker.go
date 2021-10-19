package checkers

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/business/checkers/authorization"
	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const AuthorizationPolicyCheckerType = "authorizationpolicy"

type AuthorizationPolicyChecker struct {
	AuthorizationPolicies   []security_v1beta.AuthorizationPolicy
	Namespace               string
	Namespaces              models.Namespaces
	ServiceEntries          []networking_v1alpha3.ServiceEntry
	ExportedServiceEntries  []networking_v1alpha3.ServiceEntry
	Services                []core_v1.Service
	WorkloadList            models.WorkloadList
	MtlsDetails             kubernetes.MTLSDetails
	VirtualServices         []networking_v1alpha3.VirtualService
	ExportedVirtualServices []networking_v1alpha3.VirtualService
	RegistryStatus          []*kubernetes.RegistryStatus
}

func (a AuthorizationPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// Individual validations
	for _, authPolicy := range a.AuthorizationPolicies {
		validations.MergeValidations(a.runChecks(authPolicy))
	}

	// Group Validations
	validations.MergeValidations(authorization.MtlsEnabledChecker{
		Namespace:             a.Namespace,
		AuthorizationPolicies: a.AuthorizationPolicies,
		MtlsDetails:           a.MtlsDetails,
	}.Check())

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (a AuthorizationPolicyChecker) runChecks(authPolicy security_v1beta.AuthorizationPolicy) models.IstioValidations {
	policyName := authPolicy.Name
	key, rrValidation := EmptyValidValidation(policyName, authPolicy.Namespace, AuthorizationPolicyCheckerType)
	serviceHosts := kubernetes.ServiceEntryHostnames(append(a.ServiceEntries, a.ExportedServiceEntries...))
	matchLabels := make(map[string]string)
	if authPolicy.Spec.Selector != nil {
		matchLabels = authPolicy.Spec.Selector.MatchLabels
	}
	enabledCheckers := []Checker{
		common.SelectorNoWorkloadFoundChecker(AuthorizationPolicyCheckerType, matchLabels, a.WorkloadList),
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
