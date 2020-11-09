package gateways

import (
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type SelectorChecker struct {
	WorkloadsPerNamespace map[string]models.WorkloadList
	Gateway               kubernetes.IstioObject
}

// Check verifies that the Gateway's selector's labels do match a known service inside the same namespace as recommended/required by the docs
func (s SelectorChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if selectorSpec, found := s.Gateway.GetSpec()["selector"]; found {
		if selectors, ok := selectorSpec.(map[string]interface{}); ok {
			labelSelectors := make(map[string]string, len(selectors))
			for k, v := range selectors {
				labelSelectors[k] = v.(string)
			}
			if !s.hasMatchingWorkload(labelSelectors) {
				validation := models.Build("gateways.selector", "spec/selector")
				validations = append(validations, &validation)
			}
		}
	}

	return validations, len(validations) == 0
}

func (s SelectorChecker) hasMatchingWorkload(labelSelector map[string]string) bool {
	selector := labels.SelectorFromSet(labelSelector)

	for _, wls := range s.WorkloadsPerNamespace {
		for _, wl := range wls.Workloads {
			wlLabelSet := labels.Set(wl.Labels)
			if selector.Matches(wlLabelSet) {
				return true
			}
		}
	}
	return false
}
