package models

import (
	"time"

	"k8s.io/api/autoscaling/v1"
)

type Autoscaler struct {
	Name      string            `json:"name"`
	Labels    map[string]string `json:"labels"`
	CreatedAt string            `json:"created_at"`
	// Spec
	MinReplicas                    int32 `json:"min_replicas"`
	MaxReplicas                    int32 `json:"max_replicas"`
	TargetCPUUtilizationPercentage int32 `json:"target_cpu_utilization_percentage"`
	// Status
	ObservedGeneration              int64  `json:"observed_generation,omitempty"`
	LastScaleTime                   string `json:"last_scale_time,omitempty"`
	CurrentReplicas                 int32  `json:"current_replicas"`
	DesiredReplicas                 int32  `json:"desired_replicas"`
	CurrentCPUUtilizationPercentage int32  `json:"current_CPU_utilization_percentage,omitempty"`
}

func (autoscaler *Autoscaler) Parse(d *v1.HorizontalPodAutoscaler) {
	autoscaler.Name = d.Name
	autoscaler.Labels = d.Labels
	autoscaler.CreatedAt = d.CreationTimestamp.Time.Format(time.RFC3339)

	// Spec
	autoscaler.MaxReplicas = d.Spec.MaxReplicas

	if d.Spec.MinReplicas != nil {
		autoscaler.MinReplicas = *d.Spec.MinReplicas
	}

	if d.Spec.TargetCPUUtilizationPercentage != nil {
		autoscaler.TargetCPUUtilizationPercentage = *d.Spec.TargetCPUUtilizationPercentage
	}

	// Status
	autoscaler.CurrentReplicas = d.Status.CurrentReplicas
	autoscaler.DesiredReplicas = d.Status.DesiredReplicas

	if d.Status.ObservedGeneration != nil {
		autoscaler.ObservedGeneration = *d.Status.ObservedGeneration
	}

	if d.Status.LastScaleTime != nil {
		autoscaler.LastScaleTime = (*d.Status.LastScaleTime).Time.Format(time.RFC3339)
	}

	if d.Status.CurrentCPUUtilizationPercentage != nil {
		autoscaler.CurrentCPUUtilizationPercentage = *d.Status.CurrentCPUUtilizationPercentage
	}
}
