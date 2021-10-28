package common

import (
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/models"
)

type GenericNoWorkloadFoundChecker struct {
	SubjectType    string
	SelectorLabels map[string]string
	WorkloadList   models.WorkloadList
	Path           string
}

func SelectorNoWorkloadFoundChecker(subjectType string, selectorLabels map[string]string, workloadList models.WorkloadList) GenericNoWorkloadFoundChecker {
	return GenericNoWorkloadFoundChecker{
		SubjectType:    subjectType,
		SelectorLabels: selectorLabels,
		WorkloadList:   workloadList,
		Path:           "spec/selector/matchLabels",
	}
}

func WorkloadSelectorNoWorkloadFoundChecker(subjectType string, selectorLabels map[string]string, workloadList models.WorkloadList) GenericNoWorkloadFoundChecker {
	return GenericNoWorkloadFoundChecker{
		SubjectType:    subjectType,
		SelectorLabels: selectorLabels,
		WorkloadList:   workloadList,
		Path:           "spec/workloadSelector/labels",
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

	for _, wl := range wsc.WorkloadList.Workloads {
		wlLabelSet := labels.Set(wl.Labels)
		if selector.Matches(wlLabelSet) {
			return true
		}
	}
	return false
}
