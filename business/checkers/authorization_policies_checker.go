package checkers

import (
	"fmt"
	"strings"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/business/checkers/authorization"
	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const AuthorizationPolicyCheckerType = "authorizationpolicy"

type AuthorizationPolicyChecker struct {
	AuthorizationPolicies []*security_v1beta.AuthorizationPolicy
	Namespaces            models.Namespaces
	ServiceEntries        []*networking_v1beta1.ServiceEntry
	WorkloadsPerNamespace map[string]models.WorkloadList
	MtlsDetails           kubernetes.MTLSDetails
	VirtualServices       []*networking_v1beta1.VirtualService
	RegistryServices      []*kubernetes.RegistryService
	PolicyAllowAny        bool
	Cluster               string
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
		MtlsDetails:           a.MtlsDetails,
		RegistryServices:      a.RegistryServices,
	}.Check())

	return validations
}

// runChecks runs all the individual checks for a single mesh policy and appends the result into validations.
func (a AuthorizationPolicyChecker) runChecks(authPolicy *security_v1beta.AuthorizationPolicy) models.IstioValidations {
	policyName := authPolicy.Name
	key, rrValidation := EmptyValidValidation(policyName, authPolicy.Namespace, AuthorizationPolicyCheckerType, a.Cluster)
	serviceHosts := kubernetes.ServiceEntryHostnames(a.ServiceEntries)
	matchLabels := make(map[string]string)
	if authPolicy.Spec.Selector != nil {
		matchLabels = authPolicy.Spec.Selector.MatchLabels
	}
	enabledCheckers := []Checker{
		common.SelectorNoWorkloadFoundChecker(AuthorizationPolicyCheckerType, matchLabels, a.WorkloadsPerNamespace),
		authorization.NamespaceMethodChecker{AuthorizationPolicy: authPolicy, Namespaces: a.Namespaces.GetNames()},
		authorization.NoHostChecker{AuthorizationPolicy: authPolicy, Namespaces: a.Namespaces,
			ServiceEntries: serviceHosts, VirtualServices: a.VirtualServices, RegistryServices: a.RegistryServices, PolicyAllowAny: a.PolicyAllowAny},
		authorization.PrincipalsChecker{AuthorizationPolicy: authPolicy, ServiceAccounts: a.ServiceAccountNames(strings.Replace(config.Get().ExternalServices.Istio.IstioIdentityDomain, "svc.", "", 1))},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	result := make(models.IstioValidations)
	result[key] = rrValidation
	return result
}

// ServiceAccountNames returns a list of names of the ServiceAccounts retrieved from Registry Services.
func (a AuthorizationPolicyChecker) ServiceAccountNames(clusterName string) []string {
	names := make([]string, 0)

	for _, wpn := range a.WorkloadsPerNamespace {
		for _, wl := range wpn.Workloads {
			for _, sAccountName := range wl.ServiceAccountNames {
				saFullName := fmt.Sprintf("%s/ns/%s/sa/%s", clusterName, wpn.Namespace.Name, sAccountName)
				found := false
				for _, name := range names {
					if name == saFullName {
						found = true
						break
					}
				}
				if !found {
					names = append(names, saFullName)
				}
			}
		}
	}
	return names
}
