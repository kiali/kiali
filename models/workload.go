package models

import (
	"strconv"
	"time"

	osapps_v1 "github.com/openshift/api/apps/v1"
	apps_v1 "k8s.io/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

type ClusterWorkloads struct {
	// Cluster where the apps live in
	// required: true
	// example: east
	Cluster string `json:"cluster"`

	// Workloads list for namespaces of a single cluster
	// required: true
	Workloads []WorkloadListItem `json:"workloads"`

	Validations IstioValidations `json:"validations"`
}

type WorkloadList struct {
	// Namespace where the workloads live in
	// required: true
	// example: bookinfo
	Namespace string `json:"namespace"`

	// Workloads for a given namespace
	// required: true
	Workloads []WorkloadListItem `json:"workloads"`

	Validations IstioValidations `json:"validations"`
}

type LogType string

const (
	LogTypeApp      LogType = "app"
	LogTypeProxy    LogType = "proxy"
	LogTypeWaypoint LogType = "waypoint"
	LogTypeZtunnel  LogType = "ztunnel"
)

type WaypointStore struct {
	LastUpdate time.Time
	Waypoints  Workloads
}

// WorkloadListItem has the necessary information to display the console workload list
type WorkloadListItem struct {
	// Name of the workload
	// required: true
	// example: reviews-v1
	Name string `json:"name"`

	// Namespace of the workload
	Namespace string `json:"namespace"`

	// If is part of the Ambient infrastructure
	// required: false
	// example: waypoint/ztunnel
	Ambient string `json:"ambient"`

	// The kube cluster where this workload is located.
	Cluster string `json:"cluster"`

	// Group Version Kind of the workload
	// required: true
	// example: 'apps/v1, Kind=Deployment'
	WorkloadGVK schema.GroupVersionKind `json:"gvk"`

	// Creation timestamp (in RFC3339 format)
	// required: true
	// example: 2018-07-31T12:24:17Z
	CreatedAt string `json:"createdAt"`

	// Kubernetes ResourceVersion
	// required: true
	// example: 192892127
	ResourceVersion string `json:"resourceVersion"`

	// Define if Workload has an explicit Istio policy annotation
	// Istio supports this as a label as well - this will be defined if the label is set, too.
	// If both annotation and label are set, if any is false, injection is disabled.
	// It's mapped as a pointer to show three values nil, true, false
	IstioInjectionAnnotation *bool `json:"istioInjectionAnnotation,omitempty"`

	// Define if Pods related to this Workload has an IstioSidecar deployed
	// required: true
	// example: true
	IstioSidecar bool `json:"istioSidecar"`

	// Define if Pods related to this Workload has an IsAmbient deployed
	// required: true
	// example: true
	IsAmbient bool `json:"isAmbient"`

	// Define if Labels related to this Workload contains any Gateway label
	// required: true
	// example: true
	IsGateway bool `json:"isGateway"`

	// Additional item sample, such as type of api being served (graphql, grpc, rest)
	// example: rest
	// required: false
	AdditionalDetailSample *AdditionalItem `json:"additionalDetailSample"`

	// Workload labels
	Labels map[string]string `json:"labels"`

	// Define if Pods related to this Workload has the label App
	// required: true
	// example: true
	AppLabel bool `json:"appLabel"`

	// Define if Pods related to this Workload has the label Version
	// required: true
	// example: true
	VersionLabel bool `json:"versionLabel"`

	// Number of current workload pods
	// required: true
	// example: 1
	PodCount int `json:"podCount"`

	// Annotations of Deployment
	// required: false
	Annotations map[string]string `json:"annotations"`

	// HealthAnnotations
	// required: false
	HealthAnnotations map[string]string `json:"healthAnnotations"`

	// Istio References
	IstioReferences []*IstioValidationKey `json:"istioReferences"`

	// Dashboard annotations
	// required: false
	DashboardAnnotations map[string]string `json:"dashboardAnnotations"`

	// Names of the workload service accounts
	ServiceAccountNames []string `json:"serviceAccountNames"`

	// TemplateAnnotations are the annotations on the pod template if the workload
	// has a pod template.
	TemplateAnnotations map[string]string `json:"templateAnnotations,omitempty"`

	// TemplateLabels are the labels on the pod template if the workload
	// has a pod template.
	TemplateLabels map[string]string `json:"templateLabels,omitempty"`

	// Health
	Health WorkloadHealth `json:"health,omitempty"`

	// Names of the waypoint proxy workloads, if any
	WaypointWorkloads []string `json:"waypointWorkloads"`
}

type WorkloadOverviews []*WorkloadListItem

// Workload has the details of a workload
type Workload struct {
	WorkloadListItem

	// Number of desired replicas defined by the user in the controller Spec
	// required: true
	// example: 2
	DesiredReplicas int32 `json:"desiredReplicas"`

	// Number of current replicas pods that matches controller selector labels
	// required: true
	// example: 2
	CurrentReplicas int32 `json:"currentReplicas"`

	// Number of available replicas
	// required: true
	// example: 1
	AvailableReplicas int32 `json:"availableReplicas"`

	// Pods bound to the workload
	Pods Pods `json:"pods"`

	// Services that match workload selector
	Services []ServiceOverview `json:"services"`

	// Runtimes and associated dashboards
	Runtimes []Runtime `json:"runtimes"`

	// Additional details to display, such as configured annotations
	AdditionalDetails []AdditionalItem `json:"additionalDetails"`

	Validations IstioValidations `json:"validations"`

	// Ambient waypoint workloads
	WaypointWorkloads []Workload `json:"waypointWorkloads"`

	// Health
	Health WorkloadHealth `json:"health"`
}

type Workloads []*Workload

func (workload *WorkloadListItem) ParseWorkload(w *Workload) {
	conf := config.Get()
	workload.Name = w.Name
	workload.Namespace = w.Namespace
	workload.WorkloadGVK = w.WorkloadGVK
	workload.CreatedAt = w.CreatedAt
	workload.ResourceVersion = w.ResourceVersion
	workload.IstioSidecar = w.HasIstioSidecar()
	workload.IsGateway = w.IsGateway()
	workload.IsAmbient = w.HasIstioAmbient()
	workload.Labels = w.Labels
	workload.PodCount = len(w.Pods)
	workload.ServiceAccountNames = w.Pods.ServiceAccounts()
	workload.AdditionalDetailSample = w.AdditionalDetailSample
	if len(w.Annotations) > 0 {
		workload.Annotations = w.Annotations
	} else {
		workload.Annotations = map[string]string{}
	}
	workload.HealthAnnotations = w.HealthAnnotations
	workload.IstioReferences = []*IstioValidationKey{}

	/** Check the labels app and version required by Istio in template Pods*/
	_, workload.AppLabel = w.Labels[conf.IstioLabels.AppLabelName]
	_, workload.VersionLabel = w.Labels[conf.IstioLabels.VersionLabelName]
}

func (workload *Workload) parseObjectMeta(meta *meta_v1.ObjectMeta, tplMeta *meta_v1.ObjectMeta) {
	conf := config.Get()
	workload.Name = meta.Name
	if tplMeta != nil && tplMeta.Labels != nil {
		workload.TemplateLabels = tplMeta.Labels
		// TODO: This is not right since the template labels won't match the workload's labels.
		workload.Labels = tplMeta.Labels
		/** Check the labels app and version required by Istio in template Pods*/
		_, workload.AppLabel = tplMeta.Labels[conf.IstioLabels.AppLabelName]
		_, workload.VersionLabel = tplMeta.Labels[conf.IstioLabels.VersionLabelName]
	} else {
		workload.Labels = map[string]string{}
	}
	annotations := meta.Annotations
	// TODO: This is not right since the template labels won't match the workload's labels.
	if tplMeta.Annotations != nil {
		workload.TemplateAnnotations = tplMeta.Annotations
		annotations = tplMeta.Annotations
	}

	// Check for automatic sidecar injection config at the workload level. This can be defined via label or annotation.
	// This code ignores any namespace injection label - this determines auto-injection config as defined by workload-only label or annotation.
	// If both are defined, label always overrides annotation (see https://github.com/kiali/kiali/issues/5713)
	// If none are defined, assume injection is disabled (again, we ignore the possibility of a namespace label enabling injection)
	labelExplicitlySet := false // true means the label is defined
	label, exist := workload.Labels[conf.ExternalServices.Istio.IstioInjectionAnnotation]
	if exist {
		if value, err := strconv.ParseBool(label); err == nil {
			workload.IstioInjectionAnnotation = &value
			labelExplicitlySet = true
		}
	}

	// do not bother to check the annotation if the label is explicitly set - label always overrides the annotation
	if !labelExplicitlySet {
		annotation, exist := annotations[conf.ExternalServices.Istio.IstioInjectionAnnotation]
		if exist {
			if value, err := strconv.ParseBool(annotation); err == nil {
				if !value {
					workload.IstioInjectionAnnotation = &value
				}
			}
		}
	}

	workload.CreatedAt = formatTime(meta.CreationTimestamp.Time)
	workload.ResourceVersion = meta.ResourceVersion
	workload.AdditionalDetails = GetAdditionalDetails(conf, annotations)
	workload.AdditionalDetailSample = GetFirstAdditionalIcon(conf, annotations)
	workload.DashboardAnnotations = GetDashboardAnnotation(annotations)
	workload.HealthAnnotations = GetHealthAnnotation(annotations, GetHealthConfigAnnotation())
}

func (workload *Workload) ParseDeployment(d *apps_v1.Deployment) {
	workload.WorkloadGVK = kubernetes.Deployments
	workload.parseObjectMeta(&d.ObjectMeta, &d.Spec.Template.ObjectMeta)
	if d.Spec.Replicas != nil {
		workload.DesiredReplicas = *d.Spec.Replicas
	}
	if len(d.Annotations) > 0 {
		workload.Annotations = d.Annotations
	} else {
		workload.Annotations = map[string]string{}
	}
	workload.CurrentReplicas = d.Status.Replicas
	workload.AvailableReplicas = d.Status.AvailableReplicas
}

func (workload *Workload) ParseReplicaSet(r *apps_v1.ReplicaSet) {
	workload.WorkloadGVK = kubernetes.ReplicaSets
	workload.parseObjectMeta(&r.ObjectMeta, &r.Spec.Template.ObjectMeta)
	if r.Spec.Replicas != nil {
		workload.DesiredReplicas = *r.Spec.Replicas
	}
	workload.CurrentReplicas = r.Status.Replicas
	workload.AvailableReplicas = r.Status.AvailableReplicas
}

func (workload *Workload) ParseReplicaSetParent(r *apps_v1.ReplicaSet, workloadName string, workloadGVK schema.GroupVersionKind) {
	// Some properties are taken from the ReplicaSet
	workload.parseObjectMeta(&r.ObjectMeta, &r.Spec.Template.ObjectMeta)
	// But name and type are coming from the parent
	// Custom properties from parent controller are not processed by Kiali
	workload.WorkloadGVK = workloadGVK
	workload.Name = workloadName
	if r.Spec.Replicas != nil {
		workload.DesiredReplicas = *r.Spec.Replicas
	}
	workload.CurrentReplicas = r.Status.Replicas
	workload.AvailableReplicas = r.Status.AvailableReplicas
}

func (workload *Workload) ParseReplicationController(r *core_v1.ReplicationController) {
	workload.WorkloadGVK = kubernetes.ReplicationControllers
	workload.parseObjectMeta(&r.ObjectMeta, &r.Spec.Template.ObjectMeta)
	if r.Spec.Replicas != nil {
		workload.DesiredReplicas = *r.Spec.Replicas
	}
	workload.CurrentReplicas = r.Status.Replicas
	workload.AvailableReplicas = r.Status.AvailableReplicas
}

func (workload *Workload) ParseDeploymentConfig(dc *osapps_v1.DeploymentConfig) {
	workload.WorkloadGVK = kubernetes.DeploymentConfigs
	workload.parseObjectMeta(&dc.ObjectMeta, &dc.Spec.Template.ObjectMeta)
	workload.DesiredReplicas = dc.Spec.Replicas
	workload.CurrentReplicas = dc.Status.Replicas
	workload.AvailableReplicas = dc.Status.AvailableReplicas
}

func (workload *Workload) ParseStatefulSet(s *apps_v1.StatefulSet) {
	workload.WorkloadGVK = kubernetes.StatefulSets
	workload.parseObjectMeta(&s.ObjectMeta, &s.Spec.Template.ObjectMeta)
	if s.Spec.Replicas != nil {
		workload.DesiredReplicas = *s.Spec.Replicas
	}
	workload.CurrentReplicas = s.Status.Replicas
	workload.AvailableReplicas = s.Status.ReadyReplicas
}

func (workload *Workload) ParsePod(pod *core_v1.Pod) {
	workload.WorkloadGVK = kubernetes.Pods
	workload.parseObjectMeta(&pod.ObjectMeta, &pod.ObjectMeta)

	var podReplicas, podAvailableReplicas int32
	podReplicas = 1
	podAvailableReplicas = 1

	// When a Workload is a single pod we don't have access to any controller replicas
	// On this case we differentiate when pod is terminated with success versus not running
	// Probably it might be more cases to refine here
	if pod.Status.Phase == "Succeed" {
		podReplicas = 0
		podAvailableReplicas = 0
	} else if pod.Status.Phase != "Running" {
		podAvailableReplicas = 0
	}

	workload.DesiredReplicas = podReplicas
	// Pod has not concept of replica
	workload.CurrentReplicas = workload.DesiredReplicas
	workload.AvailableReplicas = podAvailableReplicas
}

func (workload *Workload) ParseJob(job *batch_v1.Job) {
	workload.WorkloadGVK = kubernetes.Jobs
	workload.parseObjectMeta(&job.ObjectMeta, &job.ObjectMeta)
	// Job controller does not use replica parameters as other controllers
	// this is a workaround to use same values from Workload perspective
	workload.DesiredReplicas = job.Status.Active + job.Status.Succeeded + job.Status.Failed
	workload.CurrentReplicas = workload.DesiredReplicas
	workload.AvailableReplicas = job.Status.Active + job.Status.Succeeded
}

func (workload *Workload) ParseCronJob(cnjb *batch_v1.CronJob) {
	workload.WorkloadGVK = kubernetes.CronJobs
	workload.parseObjectMeta(&cnjb.ObjectMeta, &cnjb.ObjectMeta)

	// We don't have the information of this controller
	// We will infer the number of replicas as the number of pods without succeed state
	// We will infer the number of available as the number of pods with running state
	// If this is not enough, we should try to fetch the controller, it is not doing now to not overload kiali fetching all types of controllers
	var podReplicas, podAvailableReplicas int32
	podReplicas = 0
	podAvailableReplicas = 0
	for _, pod := range workload.Pods {
		if pod.Status != "Succeeded" {
			podReplicas++
		}
		if pod.Status == "Running" {
			podAvailableReplicas++
		}
	}
	workload.DesiredReplicas = podReplicas
	workload.DesiredReplicas = workload.CurrentReplicas
	workload.AvailableReplicas = podAvailableReplicas
	workload.HealthAnnotations = GetHealthAnnotation(cnjb.Annotations, GetHealthConfigAnnotation())
}

func (workload *Workload) ParseDaemonSet(ds *apps_v1.DaemonSet) {
	workload.WorkloadGVK = kubernetes.DaemonSets
	workload.parseObjectMeta(&ds.ObjectMeta, &ds.Spec.Template.ObjectMeta)
	// This is a cornercase for DaemonSet controllers
	// Desired is the number of desired nodes in a cluster that are running a DaemonSet Pod
	// We are not going to change that terminology in the backend model yet, but probably add a note in the UI in the future
	workload.DesiredReplicas = ds.Status.DesiredNumberScheduled
	workload.CurrentReplicas = ds.Status.CurrentNumberScheduled
	workload.AvailableReplicas = ds.Status.NumberAvailable
	workload.HealthAnnotations = GetHealthAnnotation(ds.Annotations, GetHealthConfigAnnotation())
}

func (workload *Workload) ParsePods(controllerName string, controllerGVK schema.GroupVersionKind, pods []core_v1.Pod) {
	conf := config.Get()
	workload.Name = controllerName
	workload.WorkloadGVK = controllerGVK
	// We don't have the information of this controller
	// We will infer the number of replicas as the number of pods without succeed state
	// We will infer the number of available as the number of pods with running state
	// If this is not enough, we should try to fetch the controller, it is not doing now to not overload kiali fetching all types of controllers
	var podReplicas, podAvailableReplicas int32
	podReplicas = 0
	podAvailableReplicas = 0
	for _, pod := range pods {
		if pod.Status.Phase != "Succeeded" {
			podReplicas++
		}
		if pod.Status.Phase == "Running" {
			podAvailableReplicas++
		}
	}
	workload.DesiredReplicas = podReplicas
	workload.CurrentReplicas = workload.DesiredReplicas
	workload.AvailableReplicas = podAvailableReplicas
	// We fetch one pod as template for labels
	// There could be corner cases not correct, then we should support more controllers
	workload.Labels = map[string]string{}
	if len(pods) > 0 {
		if pods[0].Labels != nil {
			workload.Labels = pods[0].Labels
		}
		workload.CreatedAt = formatTime(pods[0].CreationTimestamp.Time)
		workload.ResourceVersion = pods[0].ResourceVersion
	}

	/** Check the labels app and version required by Istio in template Pods*/
	_, workload.AppLabel = workload.Labels[conf.IstioLabels.AppLabelName]
	_, workload.VersionLabel = workload.Labels[conf.IstioLabels.VersionLabelName]
}

func (workload *Workload) SetPods(pods []core_v1.Pod) {
	workload.Pods.Parse(pods)
	workload.IstioSidecar = workload.HasIstioSidecar()
	workload.IsAmbient = workload.HasIstioAmbient()
}

func (workload *Workload) AddPodsProtocol(ztunnelConfig kubernetes.ZtunnelConfigDump) {

	for _, pod := range workload.Pods {
		for _, wk := range ztunnelConfig.Workloads {
			if wk.Name == pod.Name {
				pod.Protocol = wk.Protocol
				break
			}
		}
	}
}

func (workload *Workload) SetServices(svcs *ServiceList) {
	workload.Services = svcs.Services
}

// HasIstioSidecar return true if there is at least one pod and all pods have sidecars
func (workload *Workload) HasIstioSidecar() bool {
	// if no pods we can't prove there is no sidecar, so return true
	if len(workload.Pods) == 0 {
		return true
	}
	// All pods in a deployment should be the same
	if workload.WorkloadGVK == kubernetes.Deployments {
		return workload.Pods[0].HasIstioSidecar()
	}
	// Need to check each pod
	return workload.Pods.HasIstioSidecar()
}

// IsGateway return true if the workload is Ingress, Egress or K8s Gateway
func (workload *Workload) IsGateway() bool {
	// There's not consistent labeling for gateways.
	// In case of using istioctl, you get:
	// istio: ingressgateway
	// or
	// istio: egressgateway
	//
	// In case of using helm, you get:
	// istio: <gateway-name>
	//
	// In case of gateway injection you get:
	// istio: <gateway-name>
	//
	// In case of gateway-api you get:
	// istio.io/gateway-name: gateway
	//
	// In case of east/west gateways you get:
	// istio: eastwestgateway
	//
	// We're going to do different checks for all the ways you can label/deploy gateways

	// istioctl
	if labelValue, ok := workload.Labels["operator.istio.io/component"]; ok && (labelValue == "IngressGateways" || labelValue == "EgressGateways") {
		return true
	}

	// There's a lot of unit tests that look specifically for istio: ingressgateway and istio: egressgateway.
	// These should be covered by istioctl and gateway injection cases but adding checks for these just in case.
	if labelValue, ok := workload.Labels["istio"]; ok && (labelValue == "ingressgateway" || labelValue == "egressgateway") {
		return true
	}

	// Gateway injection. Includes helm because the helm template uses gateway injection.
	// If the pod injection template is a gateway then it's a gateway.
	if workload.TemplateAnnotations != nil && workload.TemplateAnnotations["inject.istio.io/templates"] == "gateway" {
		return true
	}

	// gateway-api
	// This is the old gateway-api label that was removed in 1.24.
	// If this label exists then it's a gateway
	if _, ok := workload.Labels["istio.io/gateway-name"]; ok {
		return true
	}

	// This is the new gateway-api label that was added in 1.24
	// The value distinguishes gateways from waypoints.
	if workload.Labels["gateway.istio.io/managed"] == "istio.io-gateway-controller" {
		return true
	}

	return false
}

// IsWaypoint return true if the workload is a waypoint proxy (Based in labels)
func (workload *Workload) IsWaypoint() bool {

	return workload.Labels["gateway.istio.io/managed"] == "istio.io-mesh-controller"
}

// IsWaypoint return true if the workload is a ztunnel (Based in labels)
func (workload *Workload) IsZtunnel() bool {
	for _, pod := range workload.Pods {
		if pod.Labels["app"] == "ztunnel" {
			return true
		}
	}
	return false
}

// HasIstioAmbient returns true if the workload has any pod with Ambient mesh annotations
func (workload *Workload) HasIstioAmbient() bool {
	// if no pods we can't prove that ambient is enabled, so return false (Default)
	if len(workload.Pods) == 0 {
		return false
	}
	// All pods in a deployment should be the same
	if workload.WorkloadGVK == kubernetes.Deployments {
		return workload.Pods[0].AmbientEnabled()
	}
	// Need to check each pod
	return workload.Pods.HasAnyAmbient()
}

// HasIstioSidecar returns true if there is at least one workload which has a sidecar
func (workloads WorkloadOverviews) HasIstioSidecar() bool {
	if len(workloads) > 0 {
		for _, w := range workloads {
			if w.IstioSidecar {
				return true
			}
		}
	}
	return false
}

func (wl WorkloadList) GetLabels() []labels.Set {
	wLabels := make([]labels.Set, 0, len(wl.Workloads))
	for _, w := range wl.Workloads {
		wLabels = append(wLabels, labels.Set(w.Labels))
	}
	return wLabels
}
