package models

import "k8s.io/api/apps/v1beta1"

type WorkloadList struct {
	// Namespace where the workloads live in
	// required: true
	// example: bookinfo
	Namespace Namespace `json:"namespace"`

	// Workloads for a given namespace
	// required: true
	Workloads []WorkloadOverview `json:"workloads"`
}

type WorkloadOverview struct {
	// Name of the workload
	// required: true
	// example: reviews-v1
	Name string `json:"name"`

	// Type of the workload
	// required: true
	// example: deployment
	Type string `json:"type"`
}

func (workloadList *WorkloadList) Parse(namespace string, ds *v1beta1.DeploymentList) {
	if ds == nil {
		return
	}

	workloadList.Namespace.Name = namespace

	for _, deployment := range ds.Items {
		casted := WorkloadOverview{}
		casted.Parse(deployment)
		(*workloadList).Workloads = append((*workloadList).Workloads, casted)
	}
}

func (workload *WorkloadOverview) Parse(d v1beta1.Deployment) {
	workload.Name = d.Name
	workload.Type = "Deployment"
}
