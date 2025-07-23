package workloads

import (
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/models"
)

type AmbientWorkloadChecker struct {
	Workload              *models.Workload
	Namespace             string
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
}

func (awc AmbientWorkloadChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	if awc.hasBothSidecarAndAmbientAnnotation() {
		check := models.Build("workload.ambient.sidecarandannotation", "workload")
		checks = append(checks, &check)
	}
	if awc.isWaypointAndNotAmbient() {
		check := models.Build("workload.ambient.waypointandnotambient", "workload")
		checks = append(checks, &check)
	}

	return checks, valid
}

func (awc AmbientWorkloadChecker) hasBothSidecarAndAmbientAnnotation() bool {
	return awc.Workload.IsAmbient && awc.Workload.IstioSidecar
}

func (awc AmbientWorkloadChecker) isWaypointAndNotAmbient() bool {
	return awc.Workload.IsWaypoint() && !awc.Workload.IsAmbient
}
