package checkers

import (
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	ambient "github.com/kiali/kiali/business/checkers/ambient"
	"github.com/kiali/kiali/business/checkers/workloads"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/models"
)

const WorkloadCheckerType = "workload"

type WorkloadChecker struct {
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
	Cluster               string
	Conf                  *config.Config
	Discovery             istio.MeshDiscovery
	Namespaces            models.Namespaces
	WorkloadsPerNamespace map[string]models.Workloads
}

// NewWorkloadChecker creates a new WorkloadChecker with all attributes
func NewWorkloadChecker(
	authorizationPolicies []*security_v1.AuthorizationPolicy,
	cluster string,
	conf *config.Config,
	discovery istio.MeshDiscovery,
	namespaces models.Namespaces,
	workloadsPerNamespace map[string]models.Workloads,
) WorkloadChecker {
	return WorkloadChecker{
		AuthorizationPolicies: authorizationPolicies,
		Cluster:               cluster,
		Conf:                  conf,
		Discovery:             discovery,
		Namespaces:            namespaces,
		WorkloadsPerNamespace: workloadsPerNamespace,
	}
}

func (w WorkloadChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for ns, workloads := range w.WorkloadsPerNamespace {
		for _, wl := range workloads {
			validations.MergeValidations(w.runChecks(wl, ns))
		}
	}

	return validations
}

// runChecks runs all the individual checks for a single workload and appends the result into validations.
func (w WorkloadChecker) runChecks(workload *models.Workload, namespace string) models.IstioValidations {
	wlName := workload.Name
	key, rrValidation := EmptyValidValidation(wlName, namespace, schema.GroupVersionKind{Group: "", Version: "", Kind: WorkloadCheckerType}, w.Cluster)

	enabledCheckers := []Checker{
		workloads.NewUncoveredWorkloadChecker(w.AuthorizationPolicies, w.Discovery, namespace, workload),
		ambient.NewAmbientWorkloadChecker(w.Cluster, w.Conf, workload, namespace, w.Namespaces, w.AuthorizationPolicies),
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
