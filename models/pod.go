package models

import (
	"encoding/json"
	"strings"

	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
)

// Pods alias for list of Pod structs
type Pods []*Pod

const (
	AmbientAnnotation        = "ambient.istio.io/redirection"
	AmbientAnnotationEnabled = "enabled"
	IstioProxy               = "istio-proxy"
)

// Pod holds a subset of v1.Pod data that is meaningful in Kiali
type Pod struct {
	Name                string            `json:"name"`
	Labels              map[string]string `json:"labels"`
	CreatedAt           string            `json:"createdAt"`
	CreatedBy           []Reference       `json:"createdBy"`
	Containers          []*ContainerInfo  `json:"containers"`
	IstioContainers     []*ContainerInfo  `json:"istioContainers"`
	IstioInitContainers []*ContainerInfo  `json:"istioInitContainers"`
	Status              string            `json:"status"`
	StatusMessage       string            `json:"statusMessage"`
	StatusReason        string            `json:"statusReason"`
	AppLabel            bool              `json:"appLabel"`
	VersionLabel        bool              `json:"versionLabel"`
	Annotations         map[string]string `json:"annotations"`
	ProxyStatus         *ProxyStatus      `json:"proxyStatus"`
	ServiceAccountName  string            `json:"serviceAccountName"`
}

type Waypoint struct {
	Name string
	Type string
}

// Reference holds some information on the pod creator
type Reference struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}

// ContainerInfo holds container name and image
type ContainerInfo struct {
	Name      string `json:"name"`
	Image     string `json:"image"`
	IsProxy   bool   `json:"isProxy"`
	IsReady   bool   `json:"isReady"`
	IsAmbient bool   `json:"isAmbient"`
}

// Parse extracts desired information from k8s []Pod info
func (pods *Pods) Parse(list []core_v1.Pod) {
	if list == nil {
		return
	}

	for _, pod := range list {
		casted := Pod{}
		casted.Parse(&pod)
		*pods = append(*pods, &casted)
	}
}

// Below types are used for unmarshalling json
type sideCarStatus struct {
	Containers     []string `json:"containers"`
	InitContainers []string `json:"initContainers"`
}

// Parse extracts desired information from k8s Pod info
func (pod *Pod) Parse(p *core_v1.Pod) {
	pod.Name = p.Name
	pod.Labels = p.Labels
	pod.Annotations = p.Annotations
	pod.CreatedAt = formatTime(p.CreationTimestamp.Time)
	for _, ref := range p.OwnerReferences {
		pod.CreatedBy = append(pod.CreatedBy, Reference{
			Name: ref.Name,
			Kind: ref.Kind,
		})
	}
	conf := config.Get()
	// ParsePod some annotations
	istioContainerNames := map[string]bool{}
	if jSon, ok := p.Annotations[conf.ExternalServices.Istio.IstioSidecarAnnotation]; ok {
		var scs sideCarStatus
		err := json.Unmarshal([]byte(jSon), &scs)
		if err == nil {
			for _, name := range scs.InitContainers {
				container := ContainerInfo{
					Name:    name,
					Image:   lookupImage(name, p.Spec.InitContainers),
					IsProxy: true,
					IsReady: lookupReady(name, p.Status.InitContainerStatuses),
				}
				pod.IstioInitContainers = append(pod.IstioInitContainers, &container)
				istioContainerNames[name] = true
			}
			for _, name := range scs.Containers {
				container := ContainerInfo{
					Name:    name,
					Image:   lookupImage(name, p.Spec.Containers),
					IsProxy: true,
					IsReady: lookupReady(name, p.Status.ContainerStatuses),
				}
				pod.IstioContainers = append(pod.IstioContainers, &container)
				istioContainerNames[name] = true
			}
		}
	}
	for _, c := range p.Spec.Containers {
		if istioContainerNames[c.Name] {
			continue
		}
		container := ContainerInfo{
			Name:      c.Name,
			Image:     c.Image,
			IsProxy:   isIstioProxy(p, &c, conf),
			IsReady:   lookupReady(c.Name, p.Status.ContainerStatuses),
			IsAmbient: isIstioAmbient(p),
		}
		pod.Containers = append(pod.Containers, &container)
	}
	pod.Status = string(p.Status.Phase)
	pod.StatusMessage = string(p.Status.Message)
	pod.StatusReason = string(p.Status.Reason)
	_, pod.AppLabel = p.Labels[conf.IstioLabels.AppLabelName]
	_, pod.VersionLabel = p.Labels[conf.IstioLabels.VersionLabelName]
	pod.ServiceAccountName = p.Spec.ServiceAccountName
}

func isIstioProxy(pod *core_v1.Pod, container *core_v1.Container, conf *config.Config) bool {
	if pod.Namespace != conf.IstioNamespace {
		return false
	}
	if container.Name == IstioProxy {
		return true
	}
	for _, c := range conf.ExternalServices.Istio.ComponentStatuses.Components {
		if c.IsProxy && strings.HasPrefix(pod.Name, c.AppLabel) {
			return true
		}
	}
	return false
}

func isIstioAmbient(pod *core_v1.Pod) bool {
	return pod.ObjectMeta.Annotations[config.AmbientAnnotation] == config.AmbientAnnotationEnabled
}

func lookupImage(containerName string, containers []core_v1.Container) string {
	for _, c := range containers {
		if c.Name == containerName {
			return c.Image
		}
	}
	return ""
}

func lookupReady(containerName string, statuses []core_v1.ContainerStatus) bool {
	for _, s := range statuses {
		if s.Name == containerName {
			return s.Ready
		}
	}
	return false
}

// HasIstioSidecar returns true if there are no pods or all pods have a sidecar
func (pods Pods) HasIstioSidecar() bool {
	if len(pods) > 0 {
		for _, p := range pods {
			if !p.HasIstioSidecar() {
				return false
			}
		}
	}
	return true
}

// HasAnyIstioSidecar returns true if there are pods and any of pods have a sidecar
func (pods Pods) HasAnyIstioSidecar() bool {
	if len(pods) > 0 {
		for _, p := range pods {
			if p.HasIstioSidecar() {
				return true
			}
		}
	}
	return false
}

// HasIstioSidecar returns true if the pod has an Istio proxy sidecar in containers or in init containers
func (pod Pod) HasIstioSidecar() bool {
	return len(pod.IstioContainers) > 0 || pod.HasNativeSidecar()
}

// HasAnyAmbient check each pod individually and returns true if any of them is labeled with the Ambient annotation
func (pods Pods) HasAnyAmbient() bool {
	if len(pods) > 0 {
		for _, p := range pods {
			if p.AmbientEnabled() {
				return true
			}
		}
	}
	return false
}

// AmbientEnabled returns true if the pod is labeled as ambient-type
func (pod *Pod) AmbientEnabled() bool {
	return pod.Annotations[config.AmbientAnnotation] == config.AmbientAnnotationEnabled
}

// IsWaypoint returns true if the pod is a waypoint proxy
func (pod *Pod) IsWaypoint() bool {
	return config.IsWaypoint(pod.Labels)
}

// HasNativeSidecar returns true if the pod has istio-proxy init containers
func (pod *Pod) HasNativeSidecar() bool {
	for _, c := range pod.IstioInitContainers {
		if c.Name == IstioProxy {
			return true
		}
	}
	return false
}

// SyncedPodsCount returns the number of Pods with its proxy synced
// If none of the pods have Istio Sidecar, then return -1
func (pods Pods) SyncedPodProxiesCount() int32 {
	syncedProxies := int32(0)
	allNullProxies := true
	hasSidecar := false

	for _, pod := range pods {
		hasSidecar = hasSidecar || pod.HasIstioSidecar()
		allNullProxies = allNullProxies && pod.ProxyStatus == nil
		if pod.ProxyStatus != nil && pod.ProxyStatus.IsSynced() {
			syncedProxies++
		}
	}

	if !hasSidecar || allNullProxies {
		syncedProxies = -1
	}

	return syncedProxies
}

// ServiceAccounts returns the names of each service account of the pod list
func (pods Pods) ServiceAccounts() []string {
	san := map[string]int{}
	for _, pod := range pods {
		san[pod.ServiceAccountName]++
	}

	sans := make([]string, 0, len(pods))
	for sa := range san {
		sans = append(sans, sa)
	}
	return sans
}
