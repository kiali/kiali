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

	if awc.hasBothSidecarAndAmbientLabels() {
		check := models.Build("workload.ambient.sidecarandlabel", "workload")
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
	if awc.hasPodWithSidecarLabelAndAmbientRedirection() {
		check := models.Build("workload.ambient.podsidecarlabelandambientredirection", "workload")
		checks = append(checks, &check)
		valid = false
	}
	if awc.hasPodWithSidecarInjectAndAmbientLabel() {
		check := models.Build("workload.ambient.podsidecarinjectandambientlabel", "workload")
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

func (awc AmbientWorkloadChecker) hasBothSidecarAndAmbientLabels() bool {
	return awc.hasAmbientLabel() && awc.hasSidecarLabel()
}

func (awc AmbientWorkloadChecker) isWaypointAndNotAmbient() bool {
	return awc.hasWaypointLabel() && !awc.Workload.IsAmbient
}

func (awc AmbientWorkloadChecker) referencesNonExistentWaypoint() bool {
	// If there is a reference but no resolved waypoint workload, it's missing or misconfigured
	return awc.hasWaypointLabel() && len(awc.Workload.WaypointWorkloads) == 0
}

func (awc AmbientWorkloadChecker) hasPodWithSidecarLabelAndAmbientRedirection() bool {
	if !awc.hasSidecarLabel() {
		return false
	}
	for _, pod := range awc.Workload.Pods {
		if pod.AmbientEnabled() {
			return true
		}
	}
	return false
}

func (awc AmbientWorkloadChecker) hasPodWithSidecarInjectAndAmbientLabel() bool {
	if !awc.hasAmbientLabel() {
		return false
	}
	for _, pod := range awc.Workload.Pods {
		if pod.HasIstioSidecar() || pod.HasNativeSidecar() {
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

// hasAmbientLabel Check if the namespace or the workload has Ambient enabled
// See https://istio.io/latest/docs/ambient/usage/add-workloads/#ambient-labels
func (awc AmbientWorkloadChecker) hasAmbientLabel() bool {
	ns := awc.Namespaces.GetNamespace(awc.Workload.Namespace, awc.Cluster)
	return (ns.Labels[awc.Conf.IstioLabels.AmbientNamespaceLabel] == awc.Conf.IstioLabels.AmbientNamespaceLabelValue &&
		awc.Workload.Labels[awc.Conf.IstioLabels.AmbientNamespaceLabel] != "none") ||
		awc.Workload.Labels[awc.Conf.IstioLabels.AmbientNamespaceLabel] == awc.Conf.IstioLabels.AmbientNamespaceLabelValue
}

// hasSidecarLabel Check if the namespace or the workload has Sidecars enabled
// See https://istio.io/latest/docs/setup/additional-setup/sidecar-injection/
func (awc AmbientWorkloadChecker) hasSidecarLabel() bool {
	ns := awc.Namespaces.GetNamespace(awc.Workload.Namespace, awc.Cluster)
	return (ns.Labels[awc.Conf.IstioLabels.InjectionLabelName] == "enabled" ||
		ns.Labels[awc.Conf.IstioLabels.InjectionLabelRev] != "" ||
		awc.Workload.Labels[awc.Conf.ExternalServices.Istio.IstioInjectionAnnotation] == "enabled") && (ns.Labels[awc.Conf.IstioLabels.InjectionLabelName] != "disabled" &&
		awc.Workload.Labels[awc.Conf.ExternalServices.Istio.IstioInjectionAnnotation] != "none")
}

// hasWaypointLabel Check if the namespace or the workload has Waypoint labels
// See https://istio.io/latest/docs/ambient/usage/waypoint/#configure-a-pod-to-use-a-specific-waypoint
func (awc AmbientWorkloadChecker) hasWaypointLabel() bool {
	ns := awc.Namespaces.GetNamespace(awc.Workload.Namespace, awc.Cluster)
	return (ns.Labels[awc.Conf.IstioLabels.AmbientWaypointUseLabel] != "" &&
		ns.Labels[awc.Conf.IstioLabels.AmbientWaypointUseLabel] != config.WaypointNone) ||
		(awc.Workload.Labels[awc.Conf.IstioLabels.AmbientWaypointUseLabel] != "" &&
			awc.Workload.Labels[awc.Conf.IstioLabels.AmbientWaypointUseLabel] != config.WaypointNone)
}
