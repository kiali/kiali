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

// Pod with sidecar and Labels, check should be OK
func TestSidecarsAndLabelsCheckOneValidPod(t *testing.T) {
	fakePodList := []v1.Pod{
		buildPodWith("myPodWithSidecar", true, true, true),
	}

	checker := PodChecker{Pods: fakePodList}
	validations := checker.Check()

	assert.Equal(t, 1, len(validations))
	validation, ok := validations[models.IstioValidationKey{"pod", "myPodWithSidecar"}]
	assert.True(t, ok)
	assert.True(t, validation.Valid)
	assert.Equal(t, 0, len(validation.Checks))
}

/**
  Invalid Tests
*/

func launchTestsForInvalidPod(t *testing.T, mPod string, pod v1.Pod, expectedValidation int) {
	checker := PodChecker{Pods: []v1.Pod{pod}}
	validations := checker.Check()

	assert.Equal(t, 1, len(validations))

	validation, ok := validations[models.IstioValidationKey{"pod", mPod}]
	assert.True(t, ok)
	assert.False(t, validation.Valid)
	assert.Equal(t, expectedValidation, len(validation.Checks))

	for i := 0; i < expectedValidation; i++ {
		assert.Equal(t, "warning", validation.Checks[i].Severity)
		assert.NotEqual(t, "Ok", validation.Checks[i].Message)
	}
}

func TestSidecarsAndLabelsCheckOneInvalidPod(t *testing.T) {
	/** Pod should be Warning
	No IstioSidecar
	No App Label
	No Version Label
	*/
	namePod := "myInvalidPod"
	launchTestsForInvalidPod(t, namePod, buildPodWith(namePod, false, false, false), 3)

	/** Pod should be Warning
	Yes IstioSidecar
	No App Label
	No Version Label
	*/
	launchTestsForInvalidPod(t, namePod, buildPodWith(namePod, true, false, false), 2)

	/** Pod should be Warning
	No IstioSidecar
	Yes App Label
	No Version Label
	*/
	launchTestsForInvalidPod(t, namePod, buildPodWith(namePod, false, true, false), 2)

	/** Pod should be Warning
	No IstioSidecar
	No App Label
	Yes Version Label
	*/
	launchTestsForInvalidPod(t, namePod, buildPodWith(namePod, false, false, true), 2)

	/** Pod should be Warning
	Yes IstioSidecar
	Yes App Label
	No Version Label
	*/
	launchTestsForInvalidPod(t, namePod, buildPodWith(namePod, true, true, false), 1)

	/** Pod should be Warning
	Yes IstioSidecar
	No App Label
	Yes Version Label
	*/
	launchTestsForInvalidPod(t, namePod, buildPodWith(namePod, true, false, true), 1)

	/** Pod should be Warning
	No IstioSidecar
	Yes App Label
	Yes Version Label
	*/
	launchTestsForInvalidPod(t, namePod, buildPodWith(namePod, false, true, true), 1)
}

func buildPodWith(namePod string, istioSidecar bool, appLabel bool, versionLabel bool) v1.Pod {
	labels := map[string]string{}
	if appLabel {
		labels["app"] = "srv"
	}
	if versionLabel {
		labels["version"] = "v1"
	}

	if istioSidecar {
		return v1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:        namePod,
				Labels:      labels,
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
	return v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:   namePod,
			Labels: labels,
		},
		Spec: v1.PodSpec{
			Containers: []v1.Container{},
		},
	}
}
