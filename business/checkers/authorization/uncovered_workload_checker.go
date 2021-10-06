package authorization

import (
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type UncoveredWorkloadChecker struct {
	AuthorizationPolicies []kubernetes.IstioObject
	WorkloadList          models.WorkloadList
}

func (ucw UncoveredWorkloadChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	// iterates on the workloads, for each workload check if it is covered by at least one authorization policy
	// if no policies covering the workload, adds a warning on it
	for _, wl := range ucw.WorkloadList.Workloads {

		checks := make([]*models.IstioCheck, 0)
		key := models.BuildKey(wl.Type, wl.Name, ucw.WorkloadList.Namespace.Name)

		if !ucw.hasCoveringAuthPolicy(wl) {
			check := models.Build("authorizationpolicy.workload.needstobecovered", "workload")
			checks = append(checks, &check)
			validations.MergeValidations(models.IstioValidations{key: &models.IstioValidation{
				Name:       wl.Name,
				ObjectType: wl.Type,
				Valid:      false,
				Checks:     checks,
			}})
		}
	}

	return validations
}

func (ucw UncoveredWorkloadChecker) hasCoveringAuthPolicy(wl models.WorkloadListItem) bool {

	wlSelector := labels.Set(wl.Labels)
	wlNamespace := ucw.WorkloadList.Namespace.Name

	// for each authorization policy, if the authorization policy namespace is wide mesh (istio root ns) then check for selector restrictions
	// if it has a specific namespace , check for same namespace, then check for selector restrictions
	// else workload not covered (false)
	for _, ap := range ucw.AuthorizationPolicies {
		apNamespace := ap.GetObjectMeta().Namespace
		apLabels := common.GetSelectorLabels(ap)
		var apSelector labels.Selector
		if len(apLabels) > 0 {
			apSelector = labels.SelectorFromSet(apLabels)
		}

		if apNamespace == "istio-system" || apNamespace == wlNamespace { //wide mesh namespace is "istio-system" or config.Get().IstioNamespace
			if apSelector == nil || apSelector.Matches(wlSelector) {
				return true
			}
		}
	}
	return false
}
