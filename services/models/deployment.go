package models

import (
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/autoscaling/v1"
)

type DeploymentList struct {
	// Namespace where the deployments live in
	// required: true
	// example: bookinfo
	Namespace Namespace `json:"namespace"`

	// Deployments for a given namespace
	// required: true
	Deployments []DeploymentOverview `json:"deployments"`
}

type DeploymentOverview struct {
	// Name of the deployment
	// required: true
	// example: reviews-v1
	Name string `json:"name"`
}

type Deployments []*Deployment
type Deployment struct {
	// Deployment name
	// required: true
	// example: reviews
	Name string `json:"name"`

	// Kubernetes annotations
	// required: true
	TemplateAnnotations map[string]string `json:"templateAnnotations"`

	// Kubernetes labels
	// required: true
	Labels map[string]string `json:"labels"`

	// Creation timestamp (in RFC3339 format)
	// required: true
	// example: 2018-07-31T12:24:17Z
	CreatedAt string `json:"createdAt"`

	// Kubernetes ResourceVersion
	// required: true
	// example: 192892127
	ResourceVersion string `json:"resourceVersion"`

	// Number of desired replicas
	// required: true
	// example: 2
	Replicas int32 `json:"replicas"`

	// Number of available replicas
	// required: true
	// example: 1
	AvailableReplicas int32 `json:"availableReplicas"`

	// Number of unavailable replicas
	// required: true
	// example: 1
	UnavailableReplicas int32 `json:"unavailableReplicas"`

	// Autoscaler bound to the deployment
	Autoscaler Autoscaler `json:"autoscaler"`
}

func (deployments *Deployments) Parse(ds *v1beta1.DeploymentList) {
	if ds == nil {
		return
	}

	for _, deployment := range ds.Items {
		casted := Deployment{}
		casted.Parse(&deployment)
		*deployments = append(*deployments, &casted)
	}
}

func (deployment *Deployment) Parse(d *v1beta1.Deployment) {
	deployment.Name = d.Name
	deployment.TemplateAnnotations = d.Spec.Template.Annotations
	deployment.Labels = d.Labels
	deployment.CreatedAt = formatTime(d.CreationTimestamp.Time)
	deployment.ResourceVersion = d.ResourceVersion
	deployment.Replicas = d.Status.Replicas
	deployment.AvailableReplicas = d.Status.AvailableReplicas
	deployment.UnavailableReplicas = d.Status.UnavailableReplicas
}

func (deploymentList *DeploymentList) Parse(namespace string, ds *v1beta1.DeploymentList) {
	if ds == nil {
		return
	}

	deploymentList.Namespace.Name = namespace

	for _, deployment := range ds.Items {
		casted := DeploymentOverview{}
		casted.Parse(deployment)
		(*deploymentList).Deployments = append((*deploymentList).Deployments, casted)
	}
}

func (deployment *DeploymentOverview) Parse(d v1beta1.Deployment) {
	deployment.Name = d.Name
}

func (deployments *Deployments) AddAutoscalers(as *v1.HorizontalPodAutoscalerList) {
	if as == nil {
		return
	}

	for _, deployment := range *deployments {
		for _, autoscaler := range as.Items {
			if deployment.Name == autoscaler.Spec.ScaleTargetRef.Name {
				deployment.Autoscaler.Parse(&autoscaler)
			}
		}
	}
}
