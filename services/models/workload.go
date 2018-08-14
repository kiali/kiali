package models

import (
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/autoscaling/v1"

	"github.com/kiali/kiali/kubernetes"
)

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

	// Define if Pods related to this Service has an IstioSidecar deployed
	// required: true
	// example: true
	IstioSidecar bool `json:"istioSidecar"`
	// Define if Pods related to this Service has the label App
	// required: true
	// example: true
	AppLabel bool `json:"appLabel"`
	// Define if Pods related to this Service has the label Version
	// required: true
	// example: true
	VersionLabel bool `json:"versionLabel"`
}

type Workloads []*Workload
type Workload struct {
	// Workload name
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

	// Autoscaler bound to the workload
	Autoscaler Autoscaler `json:"autoscaler"`

	// Pods bound to the workload
	Pods Pods `json:"pods"`

	// Services that match workload selector
	Services Services `json:"services"`
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

	/** Check the labels app and version required by Istio*/
	_, workload.AppLabel = d.Labels["app"]
	_, workload.VersionLabel = d.Labels["version"]
}

func (workloads *Workloads) Parse(ds *v1beta1.DeploymentList) {
	if ds == nil {
		return
	}

	for _, deployment := range ds.Items {
		casted := Workload{}
		casted.Parse(&deployment)
		*workloads = append(*workloads, &casted)
	}
}

func (workload *Workload) Parse(d *v1beta1.Deployment) {
	workload.Name = d.Name
	workload.TemplateAnnotations = d.Spec.Template.Annotations
	workload.Labels = d.Labels
	workload.CreatedAt = formatTime(d.CreationTimestamp.Time)
	workload.ResourceVersion = d.ResourceVersion
	workload.Replicas = d.Status.Replicas
	workload.AvailableReplicas = d.Status.AvailableReplicas
	workload.UnavailableReplicas = d.Status.UnavailableReplicas
}

func (workload *Workload) SetDetails(deploymentDetails *kubernetes.DeploymentDetails) {
	workload.Pods.Parse(deploymentDetails.Pods.Items)
	workload.Services.Parse(deploymentDetails.Services)
}

func (workloads *Workloads) AddAutoscalers(as *v1.HorizontalPodAutoscalerList) {
	if as == nil {
		return
	}

	for _, deployment := range *workloads {
		for _, autoscaler := range as.Items {
			if deployment.Name == autoscaler.Spec.ScaleTargetRef.Name {
				deployment.Autoscaler.Parse(&autoscaler)
			}
		}
	}
}
