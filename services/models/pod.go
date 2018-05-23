package models

import (
	"k8s.io/api/core/v1"
)

// Pods alias for list of Pod structs
type Pods []*Pod

// Pod holds a subset of v1.Pod data that is meaningful in Kiali
type Pod struct {
	Name        string            `json:"name"`
	Annotations map[string]string `json:"annotations"`
	Labels      map[string]string `json:"labels"`
	CreatedAt   string            `json:"created_at"`
}

// Parse extracts desired information from k8s PodList info
func (pods *Pods) Parse(list *v1.PodList) {
	if list == nil {
		return
	}

	for _, pod := range list.Items {
		casted := Pod{}
		casted.Parse(&pod)
		*pods = append(*pods, &casted)
	}
}

// Parse extracts desired information from k8s Pod info
func (pod *Pod) Parse(p *v1.Pod) {
	pod.Name = p.Name
	pod.Annotations = p.Annotations
	pod.Labels = p.Labels
	pod.CreatedAt = formatTime(p.CreationTimestamp.Time)
}
