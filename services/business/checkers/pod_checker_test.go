package checkers

import (
	"github.com/kiali/kiali/services/models"
	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"testing"
)

// With and empty list of pods, results should be empty
func TestSidecarsCheckNoPods(t *testing.T) {
	checker := PodChecker{Pods: []v1.Pod{}}
	result := checker.Check()

	assert.Equal(t, 0, len(result))
}

// Pod with sidecar, check should be OK
func TestSidecarsCheckOneValidPod(t *testing.T) {
	fakePodList := []v1.Pod{
		buildPodWithSidecar(),
	}

	checker := PodChecker{Pods: fakePodList}
	validations := checker.Check()

	assert.Equal(t, 1, len(validations))

	validation, ok := validations[models.IstioValidationKey{"pod", "myPodWithSidecar"}]
	assert.True(t, ok)
	assert.True(t, validation.Valid)
	assert.Equal(t, 0, len(validation.Checks))
}

// Pod with no sidecar, check should be Warning
func TestSidecarsCheckOneInvalidPod(t *testing.T) {
	fakePodList := []v1.Pod{
		buildPodWithoutSidecar(),
	}

	checker := PodChecker{Pods: fakePodList}
	validations := checker.Check()

	assert.Equal(t, 1, len(validations))

	validation, ok := validations[models.IstioValidationKey{"pod", "myPodWithNoSidecar"}]
	assert.True(t, ok)
	assert.False(t, validation.Valid)
	assert.Equal(t, 1, len(validation.Checks))
	assert.Equal(t, "warning", validation.Checks[0].Severity)
	assert.NotEqual(t, "Ok", validation.Checks[0].Message)
}

func buildPodWithSidecar() v1.Pod {
	return v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "myPodWithSidecar",
			Labels:      map[string]string{"app": "srv"},
			Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"},
		},
		Spec: v1.PodSpec{
			Containers: []v1.Container{
				v1.Container{Name: "details", Image: "whatever"},
				v1.Container{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
			},
			InitContainers: []v1.Container{
				v1.Container{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
				v1.Container{Name: "enable-core-dump", Image: "alpine"},
			},
		},
	}
}

func buildPodWithoutSidecar() v1.Pod {
	return v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:   "myPodWithNoSidecar",
			Labels: map[string]string{"app": "srv"},
		},
		Spec: v1.PodSpec{
			Containers: []v1.Container{},
		},
	}
}
