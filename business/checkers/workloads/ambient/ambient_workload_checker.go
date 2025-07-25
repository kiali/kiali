package workloads

import (
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

type AmbientWorkloadChecker struct {
	Cluster               string
	Conf                  *config.Config
	Workload              *models.Workload
	Namespace             string
	Namespaces            models.Namespaces
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
	if awc.referencesNonExistentWaypoint() {
		check := models.Build("workload.ambient.waypointnotfound", "workload")
		checks = append(checks, &check)
		valid = false
	}
	if awc.hasPodWithSidecarAndAmbientRedirection() {
		check := models.Build("workload.ambient.podsidecarandambientredirection", "workload")
		checks = append(checks, &check)
		valid = false
	}
	if awc.hasPodWithSidecarInjectAndAmbientRedirection() {
		check := models.Build("workload.ambient.podsidecarinjectandambientredirection", "workload")
		checks = append(checks, &check)
		valid = false
	}
	if awc.hasSidecarInAmbientNamespace() {
		check := models.Build("workload.ambient.sidecarinambientnamespace", "workload")
		checks = append(checks, &check)
		valid = false
	}
	if awc.hasAuthPolicyAndNoWaypoint() {
		check := models.Build("workload.ambient.authpolicybutnowaypoint", "workload")
		checks = append(checks, &check)
		valid = false
	}

	return checks, valid
}

func (awc AmbientWorkloadChecker) hasBothSidecarAndAmbientAnnotation() bool {
	return awc.Workload.IsAmbient && awc.Workload.IstioSidecar
}

func (awc AmbientWorkloadChecker) isWaypointAndNotAmbient() bool {
	return awc.Workload.IsWaypoint() && !awc.Workload.IsAmbient
}

func (awc AmbientWorkloadChecker) referencesNonExistentWaypoint() bool {
	// Check if the workload has a waypoint reference label/annotation
	waypointName, hasWaypoint := awc.Workload.TemplateLabels[config.WaypointUseLabel]
	if !hasWaypoint {
		waypointName, hasWaypoint = awc.Workload.Labels[config.WaypointUseLabel]
	}
	if !hasWaypoint || waypointName == config.WaypointNone {
		return false
	}
	// If there is a reference but no resolved waypoint workload, it's missing or misconfigured
	return len(awc.Workload.WaypointWorkloads) == 0
}

func (awc AmbientWorkloadChecker) hasPodWithSidecarAndAmbientRedirection() bool {
	for _, pod := range awc.Workload.Pods {
		if pod.HasIstioSidecar() && pod.AmbientEnabled() {
			return true
		}
	}
	return false
}

func (awc AmbientWorkloadChecker) hasPodWithSidecarInjectAndAmbientRedirection() bool {
	label, exist := awc.Workload.Labels[awc.Conf.ExternalServices.Istio.IstioInjectionAnnotation]
	if !exist || label != "true" {
		return false
	}
	for _, pod := range awc.Workload.Pods {
		if pod.AmbientEnabled() {
			return true
		}
	}
	return false
}

func (awc AmbientWorkloadChecker) hasSidecarInAmbientNamespace() bool {
	// If the workload has a sidecar and the namespace is ambient-enabled
	if !awc.Workload.IstioSidecar {
		return false
	}

	return awc.Namespaces.IsNamespaceAmbient(awc.Workload.Namespace, awc.Cluster)
}

func (awc AmbientWorkloadChecker) hasAuthPolicyAndNoWaypoint() bool {
	for _, ap := range awc.AuthorizationPolicies {
		if ap.Namespace == awc.Workload.Namespace && len(awc.Workload.WaypointWorkloads) == 0 {
			return true
		}
	}
	return false
}
