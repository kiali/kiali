package cache_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
)

func TestGetPodTrimmed(t *testing.T) {
	require := require.New(t)
	obj := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "foo",
			Namespace:   "test",
			Labels:      map[string]string{"a": "b"},
			Annotations: map[string]string{"c": "d"},
			OwnerReferences: []metav1.OwnerReference{
				{
					Name: "o",
				},
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name: "test",
				},
			},
			InitContainers: []corev1.Container{
				{
					Name: "test",
				},
			},
			ServiceAccountName: "testsa",
			Hostname:           "host.com",
		},
		Status: corev1.PodStatus{
			Phase:   "testphase",
			Message: "testmessage",
			Reason:  "reason",
			InitContainerStatuses: []corev1.ContainerStatus{
				{
					Name: "initstatus",
				},
			},
			ContainerStatuses: []corev1.ContainerStatus{
				{
					Name: "status",
				},
			},
		},
	}
	want := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "foo",
			Namespace:   "test",
			Labels:      map[string]string{"a": "b"},
			Annotations: map[string]string{"c": "d"},
			OwnerReferences: []metav1.OwnerReference{
				{
					Name: "o",
				},
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name: "test",
				},
			},
			InitContainers: []corev1.Container{
				{
					Name: "test",
				},
			},
			ServiceAccountName: "testsa",
			Hostname:           "host.com",
		},
		Status: corev1.PodStatus{
			Phase:   "testphase",
			Message: "testmessage",
			Reason:  "reason",
			InitContainerStatuses: []corev1.ContainerStatus{
				{
					Name: "initstatus",
				},
			},
			ContainerStatuses: []corev1.ContainerStatus{
				{
					Name: "status",
				},
			},
		},
	}

	got, err := cache.TransformPod(obj)
	require.NoError(err)

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatal(diff)
	}
}

func TestGetServiceTrimmed(t *testing.T) {
	require := require.New(t)
	obj := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:            "foo",
			Namespace:       "test",
			Labels:          map[string]string{"a": "b"},
			Annotations:     map[string]string{"c": "d"},
			ResourceVersion: "v1",
			OwnerReferences: []metav1.OwnerReference{
				{
					Name: "o",
				},
			},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{"a": "b"},
			Ports: []corev1.ServicePort{
				{
					Name: "test",
					Port: 8080,
				},
			},
			Type:         kubernetes.ServiceType,
			ExternalName: "test",
			ClusterIP:    "127.0.0.1",
		},
	}
	want := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:            "foo",
			Namespace:       "test",
			Labels:          map[string]string{"a": "b"},
			Annotations:     map[string]string{"c": "d"},
			ResourceVersion: "v1",
			OwnerReferences: []metav1.OwnerReference{
				{
					Name: "o",
				},
			},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{"a": "b"},
			Ports: []corev1.ServicePort{
				{
					Name: "test",
					Port: 8080,
				},
			},
			Type:         kubernetes.ServiceType,
			ExternalName: "test",
			ClusterIP:    "127.0.0.1",
		},
	}

	got, err := cache.TransformService(obj)
	require.NoError(err)

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatal(diff)
	}
}
