package sidecars

import (
	"context"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/models"
)

type GlobalChecker struct {
	Cluster   string
	Discovery istio.MeshDiscovery
	Sidecar   *networking_v1.Sidecar
}

// NewGlobalChecker creates a new GlobalChecker with all required fields
func NewGlobalChecker(cluster string, discovery istio.MeshDiscovery, sidecar *networking_v1.Sidecar) GlobalChecker {
	return GlobalChecker{
		Cluster:   cluster,
		Discovery: discovery,
		Sidecar:   sidecar,
	}
}

func (gc GlobalChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	rootNamespace := gc.Discovery.GetRootNamespace(context.TODO(), gc.Cluster, gc.Sidecar.Namespace)
	if rootNamespace != gc.Sidecar.Namespace {
		return checks, valid
	}

	if gc.Sidecar.Spec.WorkloadSelector != nil && len(gc.Sidecar.Spec.WorkloadSelector.Labels) > 0 {
		check := models.Build("sidecar.global.selector", "spec/workloadSelector")
		checks = append(checks, &check)
	}
	return checks, valid
}
