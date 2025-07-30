package models

import (
	"encoding/json"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/stretchr/testify/require"
)

func TestGetEndpointsFromPods(t *testing.T) {
	cases := []struct {
		name      string
		inputPods []corev1.Pod
		expected  *Endpoints
	}{
		{
			name:      "Nil input slice",
			inputPods: nil,
			expected:  &Endpoints{},
		},
		{
			name:      "Empty input slice",
			inputPods: []corev1.Pod{},
			expected:  &Endpoints{},
		},
		{
			name: "Single pod with IP",
			inputPods: []corev1.Pod{
				{
					TypeMeta: metav1.TypeMeta{
						Kind:       "Pod",
						APIVersion: "",
					},
					ObjectMeta: metav1.ObjectMeta{Name: "pod1"},
					Spec:       corev1.PodSpec{},
					Status:     corev1.PodStatus{PodIP: "10.0.0.1"},
				},
			},
			expected: &Endpoints{
				{
					Addresses: Addresses{{Kind: "Pod", Name: "pod1", IP: "10.0.0.1"}},
					Ports:     make(Ports, 0),
				},
			},
		},
		{
			name: "Multiple pods, some with IPs, some without",
			inputPods: []corev1.Pod{
				{
					TypeMeta: metav1.TypeMeta{
						Kind:       "Pod",
						APIVersion: "",
					},
					ObjectMeta: metav1.ObjectMeta{Name: "podA"},
					Spec:       corev1.PodSpec{},
					Status:     corev1.PodStatus{PodIP: "192.168.1.10"},
				},
				{
					TypeMeta: metav1.TypeMeta{
						Kind:       "Pod",
						APIVersion: "",
					},
					ObjectMeta: metav1.ObjectMeta{Name: "podB"},
					Spec:       corev1.PodSpec{},
					Status:     corev1.PodStatus{PodIP: ""},
				},
				{
					TypeMeta: metav1.TypeMeta{
						Kind:       "Pod",
						APIVersion: "",
					},
					ObjectMeta: metav1.ObjectMeta{Name: "podC"},
					Spec:       corev1.PodSpec{},
					Status:     corev1.PodStatus{PodIP: "192.168.1.12"},
				},
			},
			expected: &Endpoints{
				{
					Addresses: Addresses{{Kind: "Pod", Name: "podA", IP: "192.168.1.10"}},
					Ports:     make(Ports, 0),
				},
				{
					Addresses: Addresses{{Kind: "Pod", Name: "podC", IP: "192.168.1.12"}},
					Ports:     make(Ports, 0),
				},
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := GetEndpointsFromPods(tc.inputPods)
			require := require.New(t)
			a, err := json.Marshal(tc.expected)
			require.NoError(err)
			b, err := json.Marshal(result)
			require.NoError(err)

			require.Equal(string(b), string(a))
		})
	}
}
