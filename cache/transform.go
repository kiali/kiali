package cache

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TransformPod(pod any) (any, error) {
	obj, ok := pod.(*corev1.Pod)
	if !ok {
		return nil, fmt.Errorf("%T is not of type 'Pod'", obj)
	}

	trimmedPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:            obj.Name,
			Namespace:       obj.Namespace,
			Labels:          obj.Labels,
			Annotations:     obj.Annotations,
			OwnerReferences: obj.OwnerReferences,
		},
		Spec: corev1.PodSpec{
			Containers:         obj.Spec.Containers,
			InitContainers:     obj.Spec.InitContainers,
			ServiceAccountName: obj.Spec.ServiceAccountName,
			Hostname:           obj.Spec.Hostname,
		},
		Status: corev1.PodStatus{
			ContainerStatuses:     obj.Status.ContainerStatuses,
			InitContainerStatuses: obj.Status.InitContainerStatuses,
			Message:               obj.Status.Message,
			Phase:                 obj.Status.Phase,
			PodIP:                 obj.Status.PodIP,
			Reason:                obj.Status.Reason,
		},
	}

	return trimmedPod, nil
}

func TransformService(svc any) (any, error) {
	obj, ok := svc.(*corev1.Service)
	if !ok {
		return nil, fmt.Errorf("%T is not of type 'Service'", obj)
	}

	trimmedService := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:            obj.Name,
			Namespace:       obj.Namespace,
			Labels:          obj.Labels,
			Annotations:     obj.Annotations,
			ResourceVersion: obj.ResourceVersion,
			OwnerReferences: obj.OwnerReferences,
		},
		Spec: corev1.ServiceSpec{
			Selector:     obj.Spec.Selector,
			Ports:        obj.Spec.Ports,
			Type:         obj.Spec.Type,
			ExternalName: obj.Spec.ExternalName,
			ClusterIP:    obj.Spec.ClusterIP,
			ClusterIPs:   obj.Spec.ClusterIPs,
			IPFamilies:   obj.Spec.IPFamilies,
		},
	}
	return trimmedService, nil
}
