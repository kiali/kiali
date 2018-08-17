package pods

import (
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/services/models"
)

type LabelPresenceChecker struct {
	Pod *v1.Pod
}

// A Checker checks individual objects and builds an IstioCheck whenever the check fails.
// SidecarPresenceChecker checks if the current Pod has an Istio Sidecar installed.
func (checker LabelPresenceChecker) Check() ([]*models.IstioCheck, bool) {
	pod := models.Pod{}
	pod.Parse(checker.Pod)
	validations := make([]*models.IstioCheck, 0)
	valid := true
	if _, appLabel := pod.Labels[config.Get().IstioLabels.AppLabelName]; !appLabel {
		check := models.BuildCheck("Pod has no app label", "warning", "")
		valid = false
		validations = append(validations, &check)
	}

	if _, versionLabel := pod.Labels[config.Get().IstioLabels.VersionLabelName]; !versionLabel {
		check := models.BuildCheck("Pod has no version label", "warning", "")
		valid = false
		validations = append(validations, &check)
	}

	return validations, valid
}
