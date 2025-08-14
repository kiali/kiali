package checkers

import (
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	ambient "github.com/kiali/kiali/business/checkers/ambient"
	"github.com/kiali/kiali/business/checkers/workloads"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

const WorkloadCheckerType = "workload"

type WorkloadChecker struct {
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
	Cluster               string
	Conf                  *config.Config
	Namespaces            models.Namespaces
	WorkloadsPerNamespace map[string]models.Workloads
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
		workloads.UncoveredWorkloadChecker{Workload: workload, Namespace: namespace, AuthorizationPolicies: w.AuthorizationPolicies},
		ambient.NewAmbientWorkloadChecker(w.Cluster, w.Conf, workload, namespace, w.Namespaces, w.AuthorizationPolicies),
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		rrValidation.Checks = append(rrValidation.Checks, checks...)
		rrValidation.Valid = rrValidation.Valid && validChecker
	}

	return models.IstioValidations{key: rrValidation}
}
