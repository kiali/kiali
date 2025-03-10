package common

import (
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/models"
)

type GenericNoWorkloadFoundChecker struct {
	ObjectGVK             schema.GroupVersionKind
	SelectorLabels        map[string]string
	WorkloadsPerNamespace map[string]models.Workloads
	Path                  string
}

func SelectorNoWorkloadFoundChecker(objectGVK schema.GroupVersionKind, selectorLabels map[string]string, workloadsPerNamespace map[string]models.Workloads) GenericNoWorkloadFoundChecker {
	return GenericNoWorkloadFoundChecker{
		ObjectGVK:             objectGVK,
		SelectorLabels:        selectorLabels,
		WorkloadsPerNamespace: workloadsPerNamespace,
		Path:                  "spec/selector/matchLabels",
	}
}

func WorkloadSelectorNoWorkloadFoundChecker(objectGVK schema.GroupVersionKind, selectorLabels map[string]string, workloadsPerNamespace map[string]models.Workloads) GenericNoWorkloadFoundChecker {
	return GenericNoWorkloadFoundChecker{
		ObjectGVK:             objectGVK,
		SelectorLabels:        selectorLabels,
		WorkloadsPerNamespace: workloadsPerNamespace,
		Path:                  "spec/workloadSelector/labels",
	}
}

func (wsc GenericNoWorkloadFoundChecker) Check() ([]*models.IstioCheck, bool) {
	checks := make([]*models.IstioCheck, 0)

	if len(wsc.SelectorLabels) > 0 {
		if !wsc.hasMatchingWorkload(wsc.SelectorLabels) {
			check := models.Build("generic.selector.workloadnotfound", wsc.Path)
			checks = append(checks, &check)
		}
	}
	return checks, true
}

func (wsc GenericNoWorkloadFoundChecker) hasMatchingWorkload(labelSelector map[string]string) bool {
	selector := labels.SelectorFromSet(labelSelector)

	for _, workloads := range wsc.WorkloadsPerNamespace {
		for _, wl := range workloads {
			wlLabelSet := labels.Set(wl.Labels)
			if selector.Matches(wlLabelSet) {
				return true
			}
		}
	}
	return false
}
