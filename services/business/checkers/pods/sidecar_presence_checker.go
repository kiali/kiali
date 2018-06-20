package pods

import (
	"github.com/kiali/kiali/services/models"
	"k8s.io/api/core/v1"
)

type SidecarPresenceChecker struct {
	Pod *v1.Pod
}

// A Checker checks individual objects and builds an IstioCheck whenever the check fails.
// SidecarPresenceChecker checks if the current Pod has an Istio Sidecar installed.
func (checker SidecarPresenceChecker) Check() ([]*models.IstioCheck, bool) {
	pod := models.Pod{}
	pod.Parse(checker.Pod)
	if len(pod.IstioContainers) > 0 {
		return []*models.IstioCheck{}, true
	}

	check := models.BuildCheck("Pod has no Istio sidecar", "warning", "")
	return []*models.IstioCheck{&check}, false
}
