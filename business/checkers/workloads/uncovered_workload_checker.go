package workloads

import (
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

type UncoveredWorkloadChecker struct {
	Workload              *models.Workload
	Namespace             string
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
}

func (ucw UncoveredWorkloadChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	wlSelector := labels.Set(ucw.Workload.Labels)

	if !ucw.hasCoveringAuthPolicy(wlSelector) {
		check := models.Build("workload.authorizationpolicy.needstobecovered", "workload")
		checks = append(checks, &check)
	}

	return checks, valid
}

func (ucw UncoveredWorkloadChecker) hasCoveringAuthPolicy(wlSelector labels.Labels) bool {

	// for each authorization policy, if the authorization policy namespace is wide mesh (istio root ns) then check for selector restrictions
	// if it has a specific namespace , check for same namespace, then check for selector restrictions
	// else workload not covered (false)
	for _, ap := range ucw.AuthorizationPolicies {
		apNamespace := ap.Namespace
		apLabels := map[string]string{}
		if ap.Spec.Selector != nil {
			apLabels = ap.Spec.Selector.MatchLabels
		}
		var apSelector labels.Selector
		if len(apLabels) > 0 {
			apSelector = labels.SelectorFromSet(apLabels)
		}

		if config.IsRootNamespace(apNamespace) || apNamespace == ucw.Namespace {
			if apSelector == nil || apSelector.Matches(wlSelector) {
				return true
			}
		}
	}
	return false
}
