package sidecars

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/models"
)

type GlobalChecker struct {
	RootNamespace string
	Sidecar       *networking_v1.Sidecar
}

// NewGlobalChecker creates a new GlobalChecker with all required fields
func NewGlobalChecker(rootNamespace string, sidecar *networking_v1.Sidecar) GlobalChecker {
	return GlobalChecker{
		RootNamespace: rootNamespace,
		Sidecar:       sidecar,
	}
}

func (gc GlobalChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	if gc.RootNamespace != gc.Sidecar.Namespace {
		return checks, valid
	}

	if gc.Sidecar.Spec.WorkloadSelector != nil && len(gc.Sidecar.Spec.WorkloadSelector.Labels) > 0 {
		check := models.Build("sidecar.global.selector", "spec/workloadSelector")
		checks = append(checks, &check)
	}
	return checks, valid
}
