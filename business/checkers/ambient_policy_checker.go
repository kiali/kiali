package checkers

import (
	"fmt"

	extensions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	telemetry_v1 "istio.io/client-go/pkg/apis/telemetry/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business/checkers/ambient"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

// AmbientPolicyChecker validates L7 Istio configs against Ambient waypoint enrollment.
// Classification logic is shared with the MCP analyze_ambient_policies tool.
//
// Rules:
//   - AuthorizationPolicy / RequestAuthentication: require targetRefs (Service/Gateway) in Ambient;
//     selector-based attachment is ignored by waypoints. Also warn when the namespace (or selected
//     workloads) are not enrolled.
//   - WasmPlugin / Telemetry: only validated when the CR namespace is Ambient (otherwise N/A).
//     Always emit a validation entry in Ambient; warn when that namespace (or selected workloads)
//     are not enrolled. L4-only Telemetry is marked Valid (no waypoint warning).
//   - VirtualService / DestinationRule: keyed off the *destination* Service. If the destination
//     namespace is Ambient, warn when the service is not enrolled and/or when the CR is not in the
//     service namespace (cross-namespace L7 configs do not take effect for Ambient waypoints).
type AmbientPolicyChecker struct {
	AuthorizationPolicies  []*security_v1.AuthorizationPolicy
	Cluster                string
	DestinationRules       []*networking_v1.DestinationRule
	IdentityDomain         string
	Namespaces             models.Namespaces
	RequestAuthentications []*security_v1.RequestAuthentication
	Services               []core_v1.Service
	Telemetries            []*telemetry_v1.Telemetry
	VirtualServices        []*networking_v1.VirtualService
	WasmPlugins            []*extensions_v1alpha1.WasmPlugin
	WorkloadsPerNamespace  map[string]models.Workloads
}

func (c AmbientPolicyChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	nsByName := make(map[string]*models.Namespace, len(c.Namespaces))
	nsStatusByName := make(map[string]ambient.NamespaceAmbientStatus, len(c.Namespaces))
	for i := range c.Namespaces {
		ns := &c.Namespaces[i]
		if ns.Cluster != "" && ns.Cluster != c.Cluster {
			continue
		}
		nsByName[ns.Name] = ns
		workloads := c.WorkloadsPerNamespace[ns.Name]
		nsStatusByName[ns.Name] = ambient.NewNamespaceAmbientStatus(ns, c.Cluster, workloads)
	}

	servicesByNS := make(map[string]map[string]core_v1.Service)
	for _, svc := range c.Services {
		byName, ok := servicesByNS[svc.Namespace]
		if !ok {
			byName = make(map[string]core_v1.Service)
			servicesByNS[svc.Namespace] = byName
		}
		byName[svc.Name] = svc
	}

	nsNames := c.Namespaces.GetNames()

	for _, ap := range c.AuthorizationPolicies {
		nsStatus, ok := nsStatusByName[ap.Namespace]
		if !ok || !nsStatus.IsAmbient {
			continue
		}
		isL7, _ := ambient.IsL7AuthorizationPolicy(&ap.Spec)
		if !isL7 {
			continue
		}
		// Waypoints ignore selector-based policies; L7 AuthPolicies must use targetRefs.
		if !ambient.AuthorizationPolicyHasTargetRefs(&ap.Spec) {
			validations.MergeValidations(c.buildCheck(ap.Name, ap.Namespace, kubernetes.AuthorizationPolicies, "authorizationpolicy.ambient.l7notargetrefs", ""))
		}
		matchLabels := map[string]string{}
		if ap.Spec.Selector != nil {
			matchLabels = ap.Spec.Selector.MatchLabels
		}
		if c.selectorNeedsWarning(matchLabels, ap.Namespace, nsByName[ap.Namespace], nsStatus) {
			validations.MergeValidations(c.buildCheck(ap.Name, ap.Namespace, kubernetes.AuthorizationPolicies, "authorizationpolicy.ambient.l7nowaypoint", ""))
		}
	}

	for _, ra := range c.RequestAuthentications {
		nsStatus, ok := nsStatusByName[ra.Namespace]
		if !ok || !nsStatus.IsAmbient {
			continue
		}
		// Waypoints ignore selector-based policies; RequestAuthentication must use targetRefs.
		if !ambient.RequestAuthenticationHasTargetRefs(&ra.Spec) {
			validations.MergeValidations(c.buildCheck(ra.Name, ra.Namespace, kubernetes.RequestAuthentications, "requestauthentication.ambient.l7notargetrefs", ""))
		}
		matchLabels := map[string]string{}
		if ra.Spec.Selector != nil {
			matchLabels = ra.Spec.Selector.MatchLabels
		}
		if c.selectorNeedsWarning(matchLabels, ra.Namespace, nsByName[ra.Namespace], nsStatus) {
			validations.MergeValidations(c.buildCheck(ra.Name, ra.Namespace, kubernetes.RequestAuthentications, "requestauthentication.ambient.l7nowaypoint", ""))
		}
	}

	for _, vs := range c.VirtualServices {
		classification := ambient.ClassifyVirtualService(&vs.Spec)
		if !classification.RequiresWaypoint {
			continue
		}
		validations.MergeValidations(c.checkHostBasedConfig(
			vs.Name, vs.Namespace, kubernetes.VirtualServices, vs.Spec.Hosts, nsNames, nsStatusByName, servicesByNS,
			"virtualservice.ambient.servicenotcaptured",
			"virtualservice.ambient.notinservicenamespace",
			"virtualservice.ambient.l7nowaypoint",
		))
	}

	for _, dr := range c.DestinationRules {
		isL7, _ := ambient.IsL7DestinationRule(&dr.Spec)
		if !isL7 {
			continue
		}
		validations.MergeValidations(c.checkHostBasedConfig(
			dr.Name, dr.Namespace, kubernetes.DestinationRules, []string{dr.Spec.Host}, nsNames, nsStatusByName, servicesByNS,
			"destinationrule.ambient.servicenotcaptured",
			"destinationrule.ambient.notinservicenamespace",
			"destinationrule.ambient.l7nowaypoint",
		))
	}

	for _, wp := range c.WasmPlugins {
		nsStatus, ok := nsStatusByName[wp.Namespace]
		if !ok || !nsStatus.IsAmbient {
			// Non-Ambient namespaces keep N/A (no validation entry).
			continue
		}
		key, validation := EmptyValidValidation(wp.Name, wp.Namespace, kubernetes.WasmPlugins, c.Cluster)
		matchLabels := map[string]string{}
		if wp.Spec.Selector != nil {
			matchLabels = wp.Spec.Selector.MatchLabels
		}
		if c.selectorNeedsWarning(matchLabels, wp.Namespace, nsByName[wp.Namespace], nsStatus) {
			check := models.Build("wasmplugin.ambient.l7nowaypoint", "")
			validation.Checks = append(validation.Checks, &check)
			validation.Valid = false
		}
		validations.MergeValidations(models.IstioValidations{key: validation})
	}

	for _, tel := range c.Telemetries {
		nsStatus, ok := nsStatusByName[tel.Namespace]
		if !ok || !nsStatus.IsAmbient {
			// Non-Ambient namespaces keep N/A (no validation entry).
			continue
		}
		key, validation := EmptyValidValidation(tel.Name, tel.Namespace, kubernetes.Telemetries, c.Cluster)
		isL7, _ := ambient.IsL7Telemetry(&tel.Spec)
		if isL7 {
			matchLabels := map[string]string{}
			if tel.Spec.Selector != nil {
				matchLabels = tel.Spec.Selector.MatchLabels
			}
			if c.selectorNeedsWarning(matchLabels, tel.Namespace, nsByName[tel.Namespace], nsStatus) {
				check := models.Build("telemetry.ambient.l7nowaypoint", "")
				validation.Checks = append(validation.Checks, &check)
				validation.Valid = false
			}
		}
		validations.MergeValidations(models.IstioValidations{key: validation})
	}

	return validations
}

// checkHostBasedConfig validates L7 VS/DR against Ambient destination services.
// Warnings are based on the destination Service namespace (Ambient + enrollment), not only the CR namespace.
func (c AmbientPolicyChecker) checkHostBasedConfig(
	name, objectNamespace string,
	gvk schema.GroupVersionKind,
	hosts []string,
	nsNames []string,
	nsStatusByName map[string]ambient.NamespaceAmbientStatus,
	servicesByNS map[string]map[string]core_v1.Service,
	notCapturedID, notInServiceNsID, fallbackNoEnrollmentID string,
) models.IstioValidations {
	validations := models.IstioValidations{}
	destinations, resolved := c.resolveAmbientDestinations(hosts, objectNamespace, nsNames, servicesByNS, nsStatusByName)

	for _, dest := range destinations {
		path := ambientHostPath(gvk, dest.HostIndex)
		if objectNamespace != dest.ServiceNamespace {
			validations.MergeValidations(c.buildCheck(name, objectNamespace, gvk, notInServiceNsID, path))
		}
		if !dest.Enrolled {
			validations.MergeValidations(c.buildCheck(name, objectNamespace, gvk, notCapturedID, path))
		}
	}

	// No Ambient destinations resolved: fall back to CR-namespace enrollment when the CR itself is Ambient.
	if !resolved {
		if nsStatus, ok := nsStatusByName[objectNamespace]; ok && ambient.NeedsWaypointWarning(nsStatus, true) {
			validations.MergeValidations(c.buildCheck(name, objectNamespace, gvk, fallbackNoEnrollmentID, ambientHostPath(gvk, 0)))
		}
	}

	return validations
}

type ambientDestination struct {
	Enrolled         bool
	HostIndex        int
	ServiceName      string
	ServiceNamespace string
}

// resolveAmbientDestinations maps hosts to Ambient destination services.
func (c AmbientPolicyChecker) resolveAmbientDestinations(
	hosts []string,
	objectNamespace string,
	nsNames []string,
	servicesByNS map[string]map[string]core_v1.Service,
	nsStatusByName map[string]ambient.NamespaceAmbientStatus,
) (destinations []ambientDestination, resolved bool) {
	seen := map[string]bool{}
	for hostIdx, host := range hosts {
		if host == "" || host == "*" {
			continue
		}
		parsed := kubernetes.GetHost(host, objectNamespace, nsNames, c.IdentityDomain)
		if !parsed.CompleteInput {
			continue
		}
		svcNsStatus, ok := nsStatusByName[parsed.Namespace]
		if !ok || !svcNsStatus.IsAmbient {
			continue
		}
		svc, ok := servicesByNS[parsed.Namespace][parsed.Service]
		if !ok {
			continue
		}
		var svcNsLabels map[string]string
		if svcNs := c.Namespaces.GetNamespace(parsed.Namespace, c.Cluster); svcNs != nil {
			svcNsLabels = svcNs.Labels
		}
		resolved = true
		key := parsed.Namespace + "/" + svc.Name
		if seen[key] {
			continue
		}
		seen[key] = true
		destinations = append(destinations, ambientDestination{
			Enrolled:         ambient.IsEnrolledForWaypoint(svc.Labels, svcNsLabels),
			HostIndex:        hostIdx,
			ServiceName:      svc.Name,
			ServiceNamespace: parsed.Namespace,
		})
	}
	return destinations, resolved
}

// ambientHostPath returns the YAML path for the host field that triggered the Ambient warning.
func ambientHostPath(gvk schema.GroupVersionKind, hostIdx int) string {
	if gvk == kubernetes.DestinationRules {
		return "spec/host"
	}
	return fmt.Sprintf("spec/hosts[%d]", hostIdx)
}

// selectorNeedsWarning returns true when L7 config targets workloads/namespace that are not enrolled.
// Namespace-wide (empty selector): warn if namespace is not enrolled.
// With selector: warn if any matched workload is not enrolled (workload label, else namespace).
func (c AmbientPolicyChecker) selectorNeedsWarning(matchLabels map[string]string, namespace string, ns *models.Namespace, nsStatus ambient.NamespaceAmbientStatus) bool {
	var nsLabels map[string]string
	if ns != nil {
		nsLabels = ns.Labels
	}

	if len(matchLabels) == 0 {
		return ambient.NeedsWaypointWarning(nsStatus, true)
	}

	selector := labels.Set(matchLabels).AsSelector()
	workloads := c.WorkloadsPerNamespace[namespace]
	matched := false
	for _, wl := range workloads {
		if wl == nil || wl.IsWaypoint() {
			continue
		}
		if selector.Matches(labels.Set(wl.Labels)) {
			matched = true
			if !ambient.IsEnrolledForWaypoint(wl.Labels, nsLabels) {
				return true
			}
		}
	}
	if !matched {
		return ambient.NeedsWaypointWarning(nsStatus, true)
	}
	return false
}

func (c AmbientPolicyChecker) buildCheck(name, namespace string, gvk schema.GroupVersionKind, checkID, path string) models.IstioValidations {
	key, validation := EmptyValidValidation(name, namespace, gvk, c.Cluster)
	check := models.Build(checkID, path)
	validation.Checks = append(validation.Checks, &check)
	validation.Valid = false
	return models.IstioValidations{key: validation}
}
