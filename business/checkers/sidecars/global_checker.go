package sidecars

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type GlobalChecker struct {
	Sidecar kubernetes.IstioObject
}

func (gc GlobalChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	if !config.IsIstioNamespace(gc.Sidecar.GetObjectMeta().Namespace) {
		return checks, valid
	}

	if gc.Sidecar.HasWorkloadSelectorLabels() {
		check := models.Build("sidecar.global.selector", "spec/workloadSelector")
		checks = append(checks, &check)
	}

	return checks, valid
}
