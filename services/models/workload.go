package models

import (
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
)

const DEPLOYMENT string = "Deployment"

type WorkloadList struct {
	// Namespace where the workloads live in
	// required: true
	// example: bookinfo
	Namespace Namespace `json:"namespace"`

	// Workloads for a given namespace
	// required: true
	Workloads []WorkloadListItem `json:"workloads"`
}

// WorkloadListItem has the necessary information to display the console workload list
type WorkloadListItem struct {
	// Name of the workload
	// required: true
	// example: reviews-v1
	Name string `json:"name"`

	// Type of the workload
	// required: true
	// example: deployment
	Type string `json:"type"`

	// Define if Pods related to this Workload has an IstioSidecar deployed
	// required: true
	// example: true
	IstioSidecar bool `json:"istioSidecar"`
	// Define if Pods related to this Workload has the label App
	// required: true
	// example: true
	AppLabel bool `json:"appLabel"`
	// Define if Pods related to this Workload has the label Version
	// required: true
	// example: true
	VersionLabel bool `json:"versionLabel"`
}

type WorkloadOverviews []*WorkloadOverview

// WorkloadOverview has the summary information of a workload.
// Useful to display a link to the workload details page.
type WorkloadOverview struct {
	// Name of the workload
	// required: true
	// example: reviews-v1
	Name string `json:"name"`

	// Type of the workload
	// required: true
	// example: deployment
	Type string `json:"type"`

	// Creation timestamp (in RFC3339 format)
	// required: true
	// example: 2018-07-31T12:24:17Z
	CreatedAt string `json:"createdAt"`

	// Kubernetes ResourceVersion
	// required: true
	// example: 192892127
	ResourceVersion string `json:"resourceVersion"`

	// Kubernetes labels
	// required: true
	Labels map[string]string `json:"labels"`
}

// Workload has the details of a workload
type Workload struct {
	// Workload name
	// required: true
	// example: reviews
	Name string `json:"name"`

	// Type of the workload
	// required: true
	// example: deployment
	Type string `json:"type"`

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
		cast := WorkloadListItem{}
		cast.Parse(deployment)
		(*workloadList).Workloads = append((*workloadList).Workloads, cast)
	}
}

func (workload *WorkloadListItem) Parse(d v1beta1.Deployment) {
	conf := config.Get()
	workload.Name = d.Name
	workload.Type = DEPLOYMENT

	/** Check the labels app and version required by Istio in template Pods*/
	_, workload.AppLabel = d.Spec.Template.Labels[conf.IstioLabels.AppLabelName]
	_, workload.VersionLabel = d.Spec.Template.Labels[conf.IstioLabels.VersionLabelName]
}

func (workloadList *WorkloadOverviews) Parse(ds []v1beta1.Deployment) {
	if ds == nil {
		return
	}

	for _, deployment := range ds {
		cast := &WorkloadOverview{}
		cast.Parse(deployment)
		*workloadList = append(*workloadList, cast)
	}
}

func (workload *WorkloadOverview) Parse(d v1beta1.Deployment) {
	workload.Name = d.Name
	workload.Labels = d.Labels
	workload.CreatedAt = formatTime(d.CreationTimestamp.Time)
	workload.ResourceVersion = d.ResourceVersion
	workload.Type = "Deployment"
}

func (workload *Workload) Parse(d *v1beta1.Deployment) {
	workload.Name = d.Name
	workload.Type = DEPLOYMENT
	workload.TemplateAnnotations = d.Spec.Template.Annotations
	workload.Labels = d.Labels
	workload.CreatedAt = formatTime(d.CreationTimestamp.Time)
	workload.ResourceVersion = d.ResourceVersion
	workload.Replicas = d.Status.Replicas
	workload.AvailableReplicas = d.Status.AvailableReplicas
	workload.UnavailableReplicas = d.Status.UnavailableReplicas
}

func (workload *Workload) SetPods(pods []v1.Pod) {
	workload.Pods.Parse(pods)
}

func (workload *Workload) SetServices(svcs []v1.Service) {
	workload.Services.Parse(svcs)
}
