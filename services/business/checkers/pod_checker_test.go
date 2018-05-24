package checkers

import (
	"github.com/kiali/kiali/services/business/checkers/pods"
	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"testing"
)

// With and empty list of pods, results should be empty
func TestSidecarsCheckNoPods(t *testing.T) {
	checker := PodChecker{Pods: []v1.Pod{}}
	result := checker.Check()

	assert.Equal(t, 0, len(*result))
}

// Pod with sidecar, check should be OK
func TestSidecarsCheckOneValidPod(t *testing.T) {
	fakePodList := []v1.Pod{
		buildPodWithSidecar(),
	}

	checker := PodChecker{Pods: fakePodList}
	typeValidations := checker.Check()

	assert.Equal(t, 1, len(*typeValidations))

	nameValidations := (*typeValidations)["pod"]

	assert.Equal(t, 1, len(*nameValidations))
	assert.True(t, (*nameValidations)["myPodWithSidecar"].Valid)
	assert.Equal(t, 0, len((*nameValidations)["myPodWithSidecar"].Checks))
}

// Pod with no sidecar, check should be Warning
func TestSidecarsCheckOneInvalidPod(t *testing.T) {
	fakePodList := []v1.Pod{
		buildPodWithoutSidecar(),
	}

	checker := PodChecker{Pods: fakePodList}
	typeValidations := checker.Check()

	assert.Equal(t, 1, len(*typeValidations))

	nameValidations := (*typeValidations)["pod"]

	assert.Equal(t, 1, len(*nameValidations))
	assert.False(t, (*nameValidations)["myPodWithNoSidecar"].Valid)
	assert.Equal(t, 1, len((*nameValidations)["myPodWithNoSidecar"].Checks))
	assert.Equal(t, "warning", (*nameValidations)["myPodWithNoSidecar"].Checks[0].Severity)
	assert.NotEqual(t, "Ok", (*nameValidations)["myPodWithNoSidecar"].Checks[0].Message)
}

func buildPodWithSidecar() v1.Pod {
	return v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:   "myPodWithSidecar",
			Labels: map[string]string{"app": "srv"},
		},
		Spec: v1.PodSpec{
			Containers: []v1.Container{
				{Name: "myContainer", Image: pods.SidecarContainerImage + ":1.5.0"},
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
