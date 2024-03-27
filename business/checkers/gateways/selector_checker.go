package gateways

import (
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/models"
)

type SelectorChecker struct {
	WorkloadsPerNamespace map[string]models.WorkloadList
	Gateway               *networking_v1beta1.Gateway
	IsGatewayToNamespace  bool
}

// Check verifies that the Gateway's selector's labels do match a known service inside the same namespace as recommended/required by the docs
func (s SelectorChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	if !s.hasMatchingWorkload(s.Gateway.Spec.Selector) {
		validation := models.Build("gateways.selector", "spec/selector")
		validations = append(validations, &validation)
	}
	return validations, len(validations) == 0
}

func (s SelectorChecker) hasMatchingWorkload(labelSelector map[string]string) bool {
	selector := labels.SelectorFromSet(labelSelector)

	for _, wls := range s.WorkloadsPerNamespace {
		if s.IsGatewayToNamespace && wls.Namespace != s.Gateway.Namespace {
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
