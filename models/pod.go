package models

import "k8s.io/api/core/v1"

type Pods []Pod
type Pod struct {
	Name   string
	Labels map[string]string `json:"labels"`
}

func (pods *Pods) Parse(ps []*v1.Pod) {
	if ps == nil {
		return
	}

	for _, pod := range ps {
		casted := Pod{}
		casted.Parse(pod)
		*pods = append(*pods, casted)
	}
}

func (pod *Pod) Parse(p *v1.Pod) {
	pod.Name = p.Name
	pod.Labels = p.Labels
}
