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

// Below types are used for unmarshalling json
type createdBy struct {
	Reference Reference `json:"reference"`
}
type sideCarStatus struct {
	Containers     []string `json:"containers"`
	InitContainers []string `json:"initContainers"`
}

// Parse extracts desired information from k8s Pod info
func (pod *Pod) Parse(p *v1.Pod) {
	pod.Name = p.Name
	pod.Labels = p.Labels
	pod.CreatedAt = formatTime(p.CreationTimestamp.Time)
	// Parse some annotations
	if jSon, ok := p.Annotations["kubernetes.io/created-by"]; ok {
		var cby createdBy
		err := json.Unmarshal([]byte(jSon), &cby)
		if err == nil {
			pod.CreatedBy = Reference{
				Name: cby.Reference.Name,
				Kind: cby.Reference.Kind}
		}
	}
	if jSon, ok := p.Annotations["sidecar.istio.io/status"]; ok {
		var scs sideCarStatus
		err := json.Unmarshal([]byte(jSon), &scs)
		if err == nil {
			for _, name := range scs.InitContainers {
				container := ContainerInfo{
					Name:  name,
					Image: lookupImage(name, p.Spec.InitContainers)}
				pod.IstioInitContainers = append(pod.IstioInitContainers, &container)
			}
			for _, name := range scs.Containers {
				container := ContainerInfo{
					Name:  name,
					Image: lookupImage(name, p.Spec.Containers)}
				pod.IstioContainers = append(pod.IstioContainers, &container)
			}
		}
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
