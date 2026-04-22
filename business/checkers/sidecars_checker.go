package checkers

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/business/checkers/sidecars"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type SidecarChecker struct {
	Cluster               string
	Conf                  *config.Config
	IdentityDomain        string
	KubeServiceHosts      kubernetes.KubeServiceHosts
	Namespaces            models.Namespaces
	RootNamespaces        map[string]string
	ServiceEntries        []*networking_v1.ServiceEntry
	Sidecars              []*networking_v1.Sidecar
	WorkloadsPerNamespace map[string]models.Workloads
}

// NewSidecarChecker creates a new SidecarChecker with all required fields.
// rootNamespaces maps each namespace to its control plane's root namespace.
func NewSidecarChecker(
	cluster string,
	conf *config.Config,
	identityDomain string,
	rootNamespaces map[string]string,
	namespaces models.Namespaces,
	kubeServiceHosts kubernetes.KubeServiceHosts,
	serviceEntries []*networking_v1.ServiceEntry,
	sidecars []*networking_v1.Sidecar,
	workloadsPerNamespace map[string]models.Workloads,
) SidecarChecker {
	return SidecarChecker{
		Cluster:               cluster,
		Conf:                  conf,
		IdentityDomain:        identityDomain,
		KubeServiceHosts:      kubeServiceHosts,
		Namespaces:            namespaces,
		RootNamespaces:        rootNamespaces,
		ServiceEntries:        serviceEntries,
		Sidecars:              sidecars,
		WorkloadsPerNamespace: workloadsPerNamespace,
	}
}

func (s SidecarChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(s.runIndividualChecks())
	validations = validations.MergeValidations(s.runGroupChecks())

	return validations
}

func (s SidecarChecker) runGroupChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	enabledDRCheckers := []GroupChecker{
		common.SidecarSelectorMultiMatchChecker(s.Cluster, kubernetes.Sidecars, s.Sidecars, s.WorkloadsPerNamespace),
	}

	for _, checker := range enabledDRCheckers {
		validations = validations.MergeValidations(checker.Check())
	}

	return validations
}

func (s SidecarChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, sidecar := range s.Sidecars {
		validations.MergeValidations(s.runChecks(sidecar))
	}

	return validations
}

func (s SidecarChecker) runChecks(sidecar *networking_v1.Sidecar) models.IstioValidations {
	policyName := sidecar.Name
	key, rrValidation := EmptyValidValidation(policyName, sidecar.Namespace, kubernetes.Sidecars, s.Cluster)
	serviceHosts := kubernetes.ServiceEntryHostnames(s.ServiceEntries)
	selectorLabels := make(map[string]string)
	if sidecar.Spec.WorkloadSelector != nil {
		selectorLabels = sidecar.Spec.WorkloadSelector.Labels
	}

	enabledCheckers := []Checker{
		common.WorkloadSelectorNoWorkloadFoundChecker(kubernetes.Sidecars, selectorLabels, s.WorkloadsPerNamespace),
		sidecars.EgressHostChecker{IdentityDomain: s.IdentityDomain, KubeServiceHosts: s.KubeServiceHosts, ServiceEntries: serviceHosts, Sidecar: sidecar},
		sidecars.NewGlobalChecker(s.RootNamespaces[sidecar.Namespace], sidecar),
		sidecars.OutboundTrafficPolicyModeChecker{Sidecar: sidecar},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
