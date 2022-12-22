package k8sgateways

import (
	"k8s.io/apimachinery/pkg/labels"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"

	"github.com/kiali/kiali/models"
)

type SelectorChecker struct {
	WorkloadsPerNamespace map[string]models.WorkloadList
	K8sGateway            *k8s_networking_v1alpha2.Gateway
	IsGatewayToNamespace  bool
}

// Check verifies that the Gateway's selector's labels do match a known service inside the same namespace as recommended/required by the docs
func (s SelectorChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	//if !s.hasMatchingWorkload(s.K8sGateway.Spec) {
	validation := models.Build("gateways.selector", "spec/selector")
	validations = append(validations, &validation)
	//}
	return validations, len(validations) == 0
}

func (s SelectorChecker) hasMatchingWorkload(labelSelector map[string]string) bool {
	selector := labels.SelectorFromSet(labelSelector)

	for _, wls := range s.WorkloadsPerNamespace {
		if s.IsGatewayToNamespace && wls.Namespace.Name != s.K8sGateway.Namespace {
			continue
		}
		for _, wl := range wls.Workloads {
			wlLabelSet := labels.Set(wl.Labels)
			if selector.Matches(wlLabelSet) {
				return true
			}
		}
	}
	return false
}
