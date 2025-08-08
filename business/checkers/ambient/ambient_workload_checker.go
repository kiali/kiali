package ambient

import (
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func NewAmbientWorkloadChecker(
	cluster string,
	conf *config.Config,
	workload *models.Workload,
	namespace string,
	namespaces models.Namespaces,
	authorizationPolicies []*security_v1.AuthorizationPolicy,
) AmbientWorkloadChecker {
	return AmbientWorkloadChecker{
		cluster:               cluster,
		conf:                  conf,
		workload:              workload,
		namespace:             namespace,
		namespaces:            namespaces,
		authorizationPolicies: authorizationPolicies,
	}
}

type AmbientWorkloadChecker struct {
	cluster               string
	conf                  *config.Config
	workload              *models.Workload
	namespace             string
	namespaces            models.Namespaces
	authorizationPolicies []*security_v1.AuthorizationPolicy
}

func (awc AmbientWorkloadChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	if awc.hasBothSidecarAndAmbientLabels() {
		check := models.Build("workload.ambient.sidecarandlabel", "workload")
		checks = append(checks, &check)
		valid = false
	}
	if awc.isWaypointAndNotAmbient() {
		check := models.Build("workload.ambient.waypointandnotambient", "workload")
		checks = append(checks, &check)
		valid = false
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
	return awc.hasWaypointLabel() && !awc.workload.IsAmbient
}

func (awc AmbientWorkloadChecker) referencesNonExistentWaypoint() bool {
	// If there is a reference but no resolved waypoint workload, it's missing or misconfigured
	return awc.hasWaypointLabel() && len(awc.workload.WaypointWorkloads) == 0
}

func (awc AmbientWorkloadChecker) hasPodWithSidecarLabelAndAmbientRedirection() bool {
	if !awc.hasSidecarLabel() {
		return false
	}
	for _, pod := range awc.workload.Pods {
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
	for _, pod := range awc.workload.Pods {
		if pod.HasIstioSidecar() {
			return true
		}
	}
	return false
}

func (awc AmbientWorkloadChecker) hasSidecarInAmbientNamespace() bool {
	// If the workload has a sidecar and the namespace is ambient-enabled
	if !awc.workload.IstioSidecar {
		return false
	}

	return awc.namespaces.IsNamespaceAmbient(awc.workload.Namespace, awc.cluster)
}

func (awc AmbientWorkloadChecker) hasAuthPolicyAndNoWaypoint() bool {
	for _, ap := range awc.authorizationPolicies {
		if ap.Namespace == awc.workload.Namespace && len(awc.workload.WaypointWorkloads) == 0 {
			return true
		}
	}
	return false
}

// hasAmbientLabel Check if the namespace or the workload has Ambient enabled
// See https://istio.io/latest/docs/ambient/usage/add-workloads/#ambient-labels
func (awc AmbientWorkloadChecker) hasAmbientLabel() bool {
	ambientLabelKey := awc.conf.IstioLabels.AmbientNamespaceLabel
	ambientLabelValue := awc.conf.IstioLabels.AmbientNamespaceLabelValue

	// Get the label values from both the workload and its namespace.
	ns := awc.namespaces.GetNamespace(awc.workload.Namespace, awc.cluster)
	workloadLabelVal := awc.workload.Labels[ambientLabelKey]
	namespaceLabelVal := ns.Labels[ambientLabelKey]

	workloadIsEnabled := workloadLabelVal == ambientLabelValue
	workloadIsDisabled := workloadLabelVal == "none"
	namespaceIsEnabled := namespaceLabelVal == ambientLabelValue

	// The workload is in ambient mode if The workload itself is explicitly labeled with the ambient value.
	// OR
	// The namespace is labeled with the ambient value AND the workload is NOT explicitly labeled "none".
	return workloadIsEnabled || (namespaceIsEnabled && !workloadIsDisabled)
}

// hasSidecarLabel Check if the namespace or the workload has Sidecars enabled
// See https://istio.io/latest/docs/setup/additional-setup/sidecar-injection/
func (awc AmbientWorkloadChecker) hasSidecarLabel() bool {
	ns := awc.namespaces.GetNamespace(awc.workload.Namespace, awc.cluster)

	// Check for enablement at the namespace level.
	namespaceIsEnabled := ns.Labels[awc.conf.IstioLabels.InjectionLabelName] == "enabled" ||
		ns.Labels[awc.conf.IstioLabels.InjectionLabelRev] != ""

	// Check for enablement at the workload level.
	workloadIsEnabled := awc.workload.Labels[config.IstioInjectionAnnotation] == "enabled"

	// Check for explicit disablement at the namespace level.
	namespaceIsDisabled := ns.Labels[awc.conf.IstioLabels.InjectionLabelName] == "disabled"

	// Check for explicit disablement at the workload level.
	workloadIsDisabled := awc.workload.Labels[config.IstioInjectionAnnotation] == "none"

	// A sidecar is enabled if either the namespace OR the workload enables it,
	// AND neither the namespace NOR the workload explicitly disables it.
	isEnabled := namespaceIsEnabled || workloadIsEnabled
	isDisabled := namespaceIsDisabled || workloadIsDisabled

	return isEnabled && !isDisabled
}

// hasWaypointLabel Check if the namespace or the workload has Waypoint labels
// See https://istio.io/latest/docs/ambient/usage/waypoint/#configure-a-pod-to-use-a-specific-waypoint
func (awc AmbientWorkloadChecker) hasWaypointLabel() bool {
	// Skip if it is not part of Ambient
	if awc.workload.Labels[awc.conf.IstioLabels.AmbientNamespaceLabel] == config.WaypointNone {
		return false
	}

	waypointLabel := awc.conf.IstioLabels.AmbientWaypointUseLabel

	// Check the workload label first
	if val, ok := awc.workload.Labels[waypointLabel]; ok {
		// The label is present on the workload.
		return val != "" && val != config.WaypointNone
	}

	// The workload label is not set. Fall back to the namespace label.
	ns := awc.namespaces.GetNamespace(awc.workload.Namespace, awc.cluster)
	if val, ok := ns.Labels[waypointLabel]; ok {
		// The label is present on the namespace.
		return val != "" && val != config.WaypointNone
	}

	// No waypoint label was found on either the workload or its namespace.
	return false
}
