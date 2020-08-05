package common

import (
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type GenericNoWorkloadFoundChecker struct {
	SubjectType       string
	Subject           kubernetes.IstioObject
	WorkloadList      models.WorkloadList
	GetSelectorLabels func(s kubernetes.IstioObject) map[string]string
	Path              string
}

func SelectorNoWorkloadFoundChecker(subjectType string, subject kubernetes.IstioObject, workloadList models.WorkloadList) GenericNoWorkloadFoundChecker {
	return GenericNoWorkloadFoundChecker{
		SubjectType:       subjectType,
		Subject:           subject,
		WorkloadList:      workloadList,
		GetSelectorLabels: GetSelectorLabels,
		Path:              "spec/selector/matchLabels",
	}
}

func WorkloadSelectorNoWorkloadFoundChecker(subjectType string, subject kubernetes.IstioObject, workloadList models.WorkloadList) GenericNoWorkloadFoundChecker {
	return GenericNoWorkloadFoundChecker{
		SubjectType:       subjectType,
		Subject:           subject,
		WorkloadList:      workloadList,
		GetSelectorLabels: GetWorkloadSelectorLabels,
		Path:              "spec/workloadSelector/labels",
	}
}

func (wsc GenericNoWorkloadFoundChecker) Check() ([]*models.IstioCheck, bool) {
	checks := make([]*models.IstioCheck, 0)

	labels := wsc.GetSelectorLabels(wsc.Subject)
	if len(labels) > 0 {
		if !wsc.hasMatchingWorkload(labels) {
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
