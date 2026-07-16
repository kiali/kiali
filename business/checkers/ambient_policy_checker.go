package checkers

import (
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

// AmbientPolicyChecker validates L7 Istio configs in Ambient namespaces when the target is not
// enrolled to use a waypoint (istio.io/use-waypoint). Classification logic is shared with the
// MCP analyze_ambient_policies tool.
//
// Two levels of checks:
//  1. Namespace-scoped L7 configs: warn when the Ambient namespace is not enrolled.
//  2. Host-scoped L7 configs (VirtualService/DestinationRule): warn when resolved services
//     are not enrolled (even if the namespace has a waypoint or is enrolled, e.g. use-waypoint: none).
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

	servicesByNS := make(map[string][]core_v1.Service)
	for _, svc := range c.Services {
		servicesByNS[svc.Namespace] = append(servicesByNS[svc.Namespace], svc)
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
		matchLabels := map[string]string{}
		if ap.Spec.Selector != nil {
			matchLabels = ap.Spec.Selector.MatchLabels
		}
		if c.selectorNeedsWarning(matchLabels, ap.Namespace, nsByName[ap.Namespace], nsStatus) {
			validations.MergeValidations(c.buildCheck(ap.Name, ap.Namespace, kubernetes.AuthorizationPolicies, "authorizationpolicy.ambient.l7nowaypoint"))
		}
	}

	for _, ra := range c.RequestAuthentications {
		nsStatus, ok := nsStatusByName[ra.Namespace]
		if !ok || !nsStatus.IsAmbient {
			continue
		}
		matchLabels := map[string]string{}
		if ra.Spec.Selector != nil {
			matchLabels = ra.Spec.Selector.MatchLabels
		}
		if c.selectorNeedsWarning(matchLabels, ra.Namespace, nsByName[ra.Namespace], nsStatus) {
			validations.MergeValidations(c.buildCheck(ra.Name, ra.Namespace, kubernetes.RequestAuthentications, "requestauthentication.ambient.l7nowaypoint"))
		}
	}

	for _, vs := range c.VirtualServices {
		nsStatus, ok := nsStatusByName[vs.Namespace]
		if !ok || !nsStatus.IsAmbient {
			continue
		}
		classification := ambient.ClassifyVirtualService(&vs.Spec)
		if !classification.RequiresWaypoint {
			continue
		}
		uncaptured, resolved := c.uncapturedHosts(vs.Spec.Hosts, vs.Namespace, nsNames, servicesByNS)
		if len(uncaptured) > 0 {
			validations.MergeValidations(c.buildCheck(vs.Name, vs.Namespace, kubernetes.VirtualServices, "virtualservice.ambient.servicenotcaptured"))
		} else if !resolved && ambient.NeedsWaypointWarning(nsStatus, true) {
			validations.MergeValidations(c.buildCheck(vs.Name, vs.Namespace, kubernetes.VirtualServices, "virtualservice.ambient.l7nowaypoint"))
		}
	}

	for _, dr := range c.DestinationRules {
		nsStatus, ok := nsStatusByName[dr.Namespace]
		if !ok || !nsStatus.IsAmbient {
			continue
		}
		isL7, _ := ambient.IsL7DestinationRule(&dr.Spec)
		if !isL7 {
			continue
		}
		uncaptured, resolved := c.uncapturedHosts([]string{dr.Spec.Host}, dr.Namespace, nsNames, servicesByNS)
		if len(uncaptured) > 0 {
			validations.MergeValidations(c.buildCheck(dr.Name, dr.Namespace, kubernetes.DestinationRules, "destinationrule.ambient.servicenotcaptured"))
		} else if !resolved && ambient.NeedsWaypointWarning(nsStatus, true) {
			validations.MergeValidations(c.buildCheck(dr.Name, dr.Namespace, kubernetes.DestinationRules, "destinationrule.ambient.l7nowaypoint"))
		}
	}

	for _, wp := range c.WasmPlugins {
		nsStatus, ok := nsStatusByName[wp.Namespace]
		if !ok || !nsStatus.IsAmbient {
			continue
		}
		matchLabels := map[string]string{}
		if wp.Spec.Selector != nil {
			matchLabels = wp.Spec.Selector.MatchLabels
		}
		if c.selectorNeedsWarning(matchLabels, wp.Namespace, nsByName[wp.Namespace], nsStatus) {
			validations.MergeValidations(c.buildCheck(wp.Name, wp.Namespace, kubernetes.WasmPlugins, "wasmplugin.ambient.l7nowaypoint"))
		}
	}

	for _, tel := range c.Telemetries {
		nsStatus, ok := nsStatusByName[tel.Namespace]
		if !ok || !nsStatus.IsAmbient {
			continue
		}
		isL7, _ := ambient.IsL7Telemetry(&tel.Spec)
		if !isL7 {
			continue
		}
		matchLabels := map[string]string{}
		if tel.Spec.Selector != nil {
			matchLabels = tel.Spec.Selector.MatchLabels
		}
		if c.selectorNeedsWarning(matchLabels, tel.Namespace, nsByName[tel.Namespace], nsStatus) {
			validations.MergeValidations(c.buildCheck(tel.Name, tel.Namespace, kubernetes.Telemetries, "telemetry.ambient.l7nowaypoint"))
		}
	}

	return validations
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

// uncapturedHosts resolves hosts to Kubernetes services and returns those not enrolled for a waypoint.
// resolved is true when at least one host mapped to a known service.
func (c AmbientPolicyChecker) uncapturedHosts(hosts []string, objectNamespace string, nsNames []string, servicesByNS map[string][]core_v1.Service) (uncaptured []string, resolved bool) {
	seen := map[string]bool{}
	for _, host := range hosts {
		if host == "" || host == "*" {
			continue
		}
		parsed := kubernetes.GetHost(host, objectNamespace, nsNames, c.IdentityDomain)
		if !parsed.CompleteInput {
			continue
		}
		for _, svc := range servicesByNS[parsed.Namespace] {
			if svc.Name != parsed.Service {
				continue
			}
			resolved = true
			key := parsed.Namespace + "/" + svc.Name
			if seen[key] {
				continue
			}
			seen[key] = true

			var svcNsLabels map[string]string
			if svcNs := c.Namespaces.GetNamespace(parsed.Namespace, c.Cluster); svcNs != nil {
				svcNsLabels = svcNs.Labels
			}
			if !ambient.IsEnrolledForWaypoint(svc.Labels, svcNsLabels) {
				uncaptured = append(uncaptured, svc.Name)
			}
		}
	}
	return uncaptured, resolved
}

func (c AmbientPolicyChecker) buildCheck(name, namespace string, gvk schema.GroupVersionKind, checkID string) models.IstioValidations {
	key, validation := EmptyValidValidation(name, namespace, gvk, c.Cluster)
	check := models.Build(checkID, "")
	validation.Checks = append(validation.Checks, &check)
	validation.Valid = false
	return models.IstioValidations{key: validation}
}
