package models

import (
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/autoscaling/v1"
)

type Deployments []*Deployment
type Deployment struct {
	Name                string            `json:"name"`
	TemplateAnnotations map[string]string `json:"template_annotations"`
	Labels              map[string]string `json:"labels"`
	CreatedAt           string            `json:"created_at"`
	ResourceVersion     string            `json:"resource_version"`
	Replicas            int32             `json:"replicas"`
	AvailableReplicas   int32             `json:"available_replicas"`
	UnavailableReplicas int32             `json:"unavailable_replicas"`
	Autoscaler          Autoscaler        `json:"autoscaler"`
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
