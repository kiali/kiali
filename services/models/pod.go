package models

import (
	"encoding/json"

	"k8s.io/api/core/v1"
)

// Pods alias for list of Pod structs
type Pods []*Pod

// Pod holds a subset of v1.Pod data that is meaningful in Kiali
type Pod struct {
	Name                string            `json:"name"`
	Labels              map[string]string `json:"labels"`
	CreatedAt           string            `json:"createdAt"`
	CreatedBy           Reference         `json:"createdBy"`
	IstioContainers     []*ContainerInfo  `json:"istioContainers"`
	IstioInitContainers []*ContainerInfo  `json:"istioInitContainers"`
}

// Reference holds some information on the pod creator
type Reference struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}

// ContainerInfo holds container name and image
type ContainerInfo struct {
	Name  string `json:"name"`
	Image string `json:"image"`
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
	pod.Labels = p.Labels
	pod.CreatedAt = formatTime(p.CreationTimestamp.Time)
	// Parse some annotations
	if createdBy, ok := p.Annotations["kubernetes.io/created-by"]; ok {
		var f interface{}
		err := json.Unmarshal([]byte(createdBy), &f)
		if err == nil {
			switch ff := f.(type) {
			case map[string]interface{}:
				if fref, ok := ff["reference"]; ok {
					switch ref := fref.(type) {
					case map[string]interface{}:
						pod.CreatedBy = Reference{
							Name: ref["name"].(string),
							Kind: ref["kind"].(string),
						}
					}
				}
			}
		}
	}
	if istio, ok := p.Annotations["sidecar.istio.io/status"]; ok {
		var f interface{}
		err := json.Unmarshal([]byte(istio), &f)
		if err == nil {
			switch ff := f.(type) {
			case map[string]interface{}:
				if fcontainers, ok := ff["initContainers"]; ok {
					switch containers := fcontainers.(type) {
					case []interface{}:
						for _, name := range containers {
							pod.IstioInitContainers = append(pod.IstioInitContainers, &ContainerInfo{Name: name.(string)})
						}
					}
				}
				if fcontainers, ok := ff["containers"]; ok {
					switch containers := fcontainers.(type) {
					case []interface{}:
						for _, name := range containers {
							pod.IstioContainers = append(pod.IstioContainers, &ContainerInfo{Name: name.(string)})
						}
					}
				}
			}
		}
	}
	// Lookup images for containers found
	for _, container := range pod.IstioInitContainers {
		container.Image = lookupImage(container.Name, p.Spec.InitContainers)
	}
	for _, container := range pod.IstioContainers {
		container.Image = lookupImage(container.Name, p.Spec.Containers)
	}
}

func lookupImage(containerName string, containers []v1.Container) string {
	for _, c := range containers {
		if c.Name == containerName {
			return c.Image
		}
	}
	return ""
}
