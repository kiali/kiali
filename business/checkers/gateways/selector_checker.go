package gateways

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"k8s.io/apimachinery/pkg/labels"
)

type SelectorChecker struct {
	WorkloadList models.WorkloadList
	Gateway      kubernetes.IstioObject
}

var (
	// IstioIngressGatewayLabels matching labels for Istio's internal ingressgateway
	IstioIngressGatewayLabels = labels.Set(map[string]string{"istio": "ingressgateway"})
	// IstioEgressGatewayLabels matching labels for Istio's internal egressgateway
	IstioEgressGatewayLabels = labels.Set(map[string]string{"istio": "egressgateway"})
)

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
	selector := labels.SelectorFromSet(labels.Set(labelSelector))

	// Special case for Istio's internal deployments which do not conform to Istio documentation/specs at this point
	if selector.Matches(IstioIngressGatewayLabels) || selector.Matches(IstioEgressGatewayLabels) {
		return true
	}

	for _, wl := range s.WorkloadList.Workloads {
		wlLabelSet := labels.Set(wl.Labels)
		if selector.Matches(wlLabelSet) {
			return true
		}
	}
	return false
}
