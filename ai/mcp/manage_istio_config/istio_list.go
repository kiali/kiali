package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

var istioConfigCriteria = business.IstioConfigCriteria{
	IncludeGateways:               true,
	IncludeK8sGateways:            true,
	IncludeK8sGRPCRoutes:          true,
	IncludeK8sHTTPRoutes:          true,
	IncludeK8sInferencePools:      true,
	IncludeK8sReferenceGrants:     true,
	IncludeK8sTCPRoutes:           true,
	IncludeK8sTLSRoutes:           true,
	IncludeVirtualServices:        true,
	IncludeDestinationRules:       true,
	IncludeServiceEntries:         true,
	IncludeSidecars:               true,
	IncludeAuthorizationPolicies:  true,
	IncludePeerAuthentications:    true,
	IncludeRequestAuthentications: true,
	IncludeWorkloadEntries:        true,
	IncludeWorkloadGroups:         true,
	IncludeEnvoyFilters:           true,
	IncludeWasmPlugins:            true,
	IncludeTelemetry:              true,
}

type IstioListItem struct {
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	Group      string            `json:"group"`
	Version    string            `json:"version"`
	Kind       string            `json:"kind"`
	Validation ValidationSummary `json:"validation"`
}

type ValidationSummary struct {
	Valid  bool                     `json:"valid"`
	Checks []ValidationCheckSummary `json:"checks,omitempty"`
}

type ValidationCheckSummary struct {
	Severity string `json:"severity"`
	Message  string `json:"message"`
}

func IstioList(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	// Extract parameters
	cluster, _ := args["cluster"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	kind, _ := args["kind"].(string)
	serviceName, _ := args["service_name"].(string)

	var istioConfig *models.IstioConfigList
	var err error
	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}

	criteria := istioConfigCriteria
	if kind != "" {
		criteria = criteriaForListFilter(group, kind)
	}

	if namespace == "" {
		istioConfig, err = businessLayer.IstioConfig.GetIstioConfigList(ctx, cluster, criteria)
	} else {
		istioConfig, err = businessLayer.IstioConfig.GetIstioConfigListForNamespace(ctx, cluster, namespace, criteria)
	}

	if err != nil {
		return fmt.Sprintf("Error while getting istio config: %s", err.Error()), http.StatusInternalServerError
	}

	// Extract native objects for compact output
	virtualServices := istioConfig.VirtualServices
	destinationRules := istioConfig.DestinationRules
	gateways := istioConfig.Gateways
	serviceEntries := istioConfig.ServiceEntries
	sidecars := istioConfig.Sidecars
	envoyFilters := istioConfig.EnvoyFilters
	workloadEntries := istioConfig.WorkloadEntries
	workloadGroups := istioConfig.WorkloadGroups
	wasmPlugins := istioConfig.WasmPlugins
	telemetries := istioConfig.Telemetries
	authorizationPolicies := istioConfig.AuthorizationPolicies
	peerAuthentications := istioConfig.PeerAuthentications
	requestAuthentications := istioConfig.RequestAuthentications

	k8sGateways := istioConfig.K8sGateways
	k8sHTTPRoutes := istioConfig.K8sHTTPRoutes
	k8sGRPCRoutes := istioConfig.K8sGRPCRoutes
	k8sTCPRoutes := istioConfig.K8sTCPRoutes
	k8sTLSRoutes := istioConfig.K8sTLSRoutes
	k8sReferenceGrants := istioConfig.K8sReferenceGrants
	k8sInferencePools := istioConfig.K8sInferencePools

	// Filter by service name if provided
	if serviceName != "" {
		serviceName = strings.TrimSpace(serviceName)

		// Filter VirtualServices
		filteredVS := make([]*networking_v1.VirtualService, 0)
		for _, vs := range virtualServices {
			if vs == nil {
				continue
			}
			match := false

			// Check spec.hosts
			for _, host := range vs.Spec.Hosts {
				if matchesServiceHost(host, serviceName) {
					match = true
					break
				}
			}

			// Check route destinations in http, tls, and tcp routes
			if !match && vs.Spec.Http != nil {
				for _, httpRoute := range vs.Spec.Http {
					if httpRoute.Route != nil {
						for _, dest := range httpRoute.Route {
							if dest.Destination != nil && matchesServiceHost(dest.Destination.Host, serviceName) {
								match = true
								break
							}
						}
					}
					if match {
						break
					}
				}
			}

			if !match && vs.Spec.Tls != nil {
				for _, tlsRoute := range vs.Spec.Tls {
					if tlsRoute.Route != nil {
						for _, dest := range tlsRoute.Route {
							if dest.Destination != nil && matchesServiceHost(dest.Destination.Host, serviceName) {
								match = true
								break
							}
						}
					}
					if match {
						break
					}
				}
			}

			if !match && vs.Spec.Tcp != nil {
				for _, tcpRoute := range vs.Spec.Tcp {
					if tcpRoute.Route != nil {
						for _, dest := range tcpRoute.Route {
							if dest.Destination != nil && matchesServiceHost(dest.Destination.Host, serviceName) {
								match = true
								break
							}
						}
					}
					if match {
						break
					}
				}
			}

			if match {
				filteredVS = append(filteredVS, vs)
			}
		}
		virtualServices = filteredVS

		// Filter DestinationRules by spec.host
		filteredDR := make([]*networking_v1.DestinationRule, 0)
		for _, dr := range destinationRules {
			if dr == nil {
				continue
			}
			if matchesServiceHost(dr.Spec.Host, serviceName) {
				filteredDR = append(filteredDR, dr)
			}
		}
		destinationRules = filteredDR
	}

	// Filter gateways to only those referenced by VirtualServices
	gateways, _ = filterGatewaysReferencedByVirtualServices(ctx, businessLayer, cluster, virtualServices, gateways)

	// Get validation warnings for context
	istioValidations, err := businessLayer.Validations.GetValidations(ctx, cluster)
	if err != nil {
		// If validations fail, we still return the list; we just omit validation details.
		istioValidations = models.IstioValidations{}
	}

	items := make([]IstioListItem, 0, len(virtualServices)+len(destinationRules)+len(gateways))

	for _, vs := range virtualServices {
		if vs == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       vs.Name,
			Namespace:  vs.Namespace,
			Group:      kubernetes.VirtualServices.Group,
			Version:    kubernetes.VirtualServices.Version,
			Kind:       kubernetes.VirtualServices.Kind,
			Validation: validationSummaryForRuntimeObject(vs, kubernetes.VirtualServices, istioValidations, cluster),
		})
	}
	for _, dr := range destinationRules {
		if dr == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       dr.Name,
			Namespace:  dr.Namespace,
			Group:      kubernetes.DestinationRules.Group,
			Version:    kubernetes.DestinationRules.Version,
			Kind:       kubernetes.DestinationRules.Kind,
			Validation: validationSummaryForRuntimeObject(dr, kubernetes.DestinationRules, istioValidations, cluster),
		})
	}
	for _, gw := range gateways {
		if gw == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       gw.Name,
			Namespace:  gw.Namespace,
			Group:      kubernetes.Gateways.Group,
			Version:    kubernetes.Gateways.Version,
			Kind:       kubernetes.Gateways.Kind,
			Validation: validationSummaryForRuntimeObject(gw, kubernetes.Gateways, istioValidations, cluster),
		})
	}

	// Remaining supported types (not affected by service_name filtering).
	for _, se := range serviceEntries {
		if se == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       se.Name,
			Namespace:  se.Namespace,
			Group:      kubernetes.ServiceEntries.Group,
			Version:    kubernetes.ServiceEntries.Version,
			Kind:       kubernetes.ServiceEntries.Kind,
			Validation: validationSummaryForRuntimeObject(se, kubernetes.ServiceEntries, istioValidations, cluster),
		})
	}
	for _, sc := range sidecars {
		if sc == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       sc.Name,
			Namespace:  sc.Namespace,
			Group:      kubernetes.Sidecars.Group,
			Version:    kubernetes.Sidecars.Version,
			Kind:       kubernetes.Sidecars.Kind,
			Validation: validationSummaryForRuntimeObject(sc, kubernetes.Sidecars, istioValidations, cluster),
		})
	}
	for _, ef := range envoyFilters {
		if ef == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       ef.Name,
			Namespace:  ef.Namespace,
			Group:      kubernetes.EnvoyFilters.Group,
			Version:    kubernetes.EnvoyFilters.Version,
			Kind:       kubernetes.EnvoyFilters.Kind,
			Validation: validationSummaryForRuntimeObject(ef, kubernetes.EnvoyFilters, istioValidations, cluster),
		})
	}
	for _, we := range workloadEntries {
		if we == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       we.Name,
			Namespace:  we.Namespace,
			Group:      kubernetes.WorkloadEntries.Group,
			Version:    kubernetes.WorkloadEntries.Version,
			Kind:       kubernetes.WorkloadEntries.Kind,
			Validation: validationSummaryForRuntimeObject(we, kubernetes.WorkloadEntries, istioValidations, cluster),
		})
	}
	for _, wg := range workloadGroups {
		if wg == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       wg.Name,
			Namespace:  wg.Namespace,
			Group:      kubernetes.WorkloadGroups.Group,
			Version:    kubernetes.WorkloadGroups.Version,
			Kind:       kubernetes.WorkloadGroups.Kind,
			Validation: validationSummaryForRuntimeObject(wg, kubernetes.WorkloadGroups, istioValidations, cluster),
		})
	}
	for _, wp := range wasmPlugins {
		if wp == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       wp.Name,
			Namespace:  wp.Namespace,
			Group:      kubernetes.WasmPlugins.Group,
			Version:    kubernetes.WasmPlugins.Version,
			Kind:       kubernetes.WasmPlugins.Kind,
			Validation: validationSummaryForRuntimeObject(wp, kubernetes.WasmPlugins, istioValidations, cluster),
		})
	}
	for _, tl := range telemetries {
		if tl == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       tl.Name,
			Namespace:  tl.Namespace,
			Group:      kubernetes.Telemetries.Group,
			Version:    kubernetes.Telemetries.Version,
			Kind:       kubernetes.Telemetries.Kind,
			Validation: validationSummaryForRuntimeObject(tl, kubernetes.Telemetries, istioValidations, cluster),
		})
	}
	for _, ap := range authorizationPolicies {
		if ap == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       ap.Name,
			Namespace:  ap.Namespace,
			Group:      kubernetes.AuthorizationPolicies.Group,
			Version:    kubernetes.AuthorizationPolicies.Version,
			Kind:       kubernetes.AuthorizationPolicies.Kind,
			Validation: validationSummaryForRuntimeObject(ap, kubernetes.AuthorizationPolicies, istioValidations, cluster),
		})
	}
	for _, pa := range peerAuthentications {
		if pa == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       pa.Name,
			Namespace:  pa.Namespace,
			Group:      kubernetes.PeerAuthentications.Group,
			Version:    kubernetes.PeerAuthentications.Version,
			Kind:       kubernetes.PeerAuthentications.Kind,
			Validation: validationSummaryForRuntimeObject(pa, kubernetes.PeerAuthentications, istioValidations, cluster),
		})
	}
	for _, ra := range requestAuthentications {
		if ra == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       ra.Name,
			Namespace:  ra.Namespace,
			Group:      kubernetes.RequestAuthentications.Group,
			Version:    kubernetes.RequestAuthentications.Version,
			Kind:       kubernetes.RequestAuthentications.Kind,
			Validation: validationSummaryForRuntimeObject(ra, kubernetes.RequestAuthentications, istioValidations, cluster),
		})
	}

	for _, kgw := range k8sGateways {
		if kgw == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       kgw.Name,
			Namespace:  kgw.Namespace,
			Group:      kubernetes.K8sGateways.Group,
			Version:    kubernetes.K8sGateways.Version,
			Kind:       kubernetes.K8sGateways.Kind,
			Validation: validationSummaryForRuntimeObject(kgw, kubernetes.K8sGateways, istioValidations, cluster),
		})
	}
	for _, hr := range k8sHTTPRoutes {
		if hr == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       hr.Name,
			Namespace:  hr.Namespace,
			Group:      kubernetes.K8sHTTPRoutes.Group,
			Version:    kubernetes.K8sHTTPRoutes.Version,
			Kind:       kubernetes.K8sHTTPRoutes.Kind,
			Validation: validationSummaryForRuntimeObject(hr, kubernetes.K8sHTTPRoutes, istioValidations, cluster),
		})
	}
	for _, gr := range k8sGRPCRoutes {
		if gr == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       gr.Name,
			Namespace:  gr.Namespace,
			Group:      kubernetes.K8sGRPCRoutes.Group,
			Version:    kubernetes.K8sGRPCRoutes.Version,
			Kind:       kubernetes.K8sGRPCRoutes.Kind,
			Validation: validationSummaryForRuntimeObject(gr, kubernetes.K8sGRPCRoutes, istioValidations, cluster),
		})
	}
	for _, tr := range k8sTCPRoutes {
		if tr == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       tr.Name,
			Namespace:  tr.Namespace,
			Group:      kubernetes.K8sTCPRoutes.Group,
			Version:    kubernetes.K8sTCPRoutes.Version,
			Kind:       kubernetes.K8sTCPRoutes.Kind,
			Validation: validationSummaryForRuntimeObject(tr, kubernetes.K8sTCPRoutes, istioValidations, cluster),
		})
	}
	for _, tlr := range k8sTLSRoutes {
		if tlr == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       tlr.Name,
			Namespace:  tlr.Namespace,
			Group:      kubernetes.K8sTLSRoutes.Group,
			Version:    kubernetes.K8sTLSRoutes.Version,
			Kind:       kubernetes.K8sTLSRoutes.Kind,
			Validation: validationSummaryForRuntimeObject(tlr, kubernetes.K8sTLSRoutes, istioValidations, cluster),
		})
	}
	for _, rg := range k8sReferenceGrants {
		if rg == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       rg.Name,
			Namespace:  rg.Namespace,
			Group:      kubernetes.K8sReferenceGrants.Group,
			Version:    kubernetes.K8sReferenceGrants.Version,
			Kind:       kubernetes.K8sReferenceGrants.Kind,
			Validation: validationSummaryForRuntimeObject(rg, kubernetes.K8sReferenceGrants, istioValidations, cluster),
		})
	}
	for _, ip := range k8sInferencePools {
		if ip == nil {
			continue
		}
		items = append(items, IstioListItem{
			Name:       ip.Name,
			Namespace:  ip.Namespace,
			Group:      kubernetes.K8sInferencePools.Group,
			Version:    kubernetes.K8sInferencePools.Version,
			Kind:       kubernetes.K8sInferencePools.Kind,
			Validation: validationSummaryForRuntimeObject(ip, kubernetes.K8sInferencePools, istioValidations, cluster),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Namespace != items[j].Namespace {
			return items[i].Namespace < items[j].Namespace
		}
		if items[i].Kind != items[j].Kind {
			return items[i].Kind < items[j].Kind
		}
		return items[i].Name < items[j].Name
	})

	return items, http.StatusOK
}

// matchesServiceHost checks if a host specification matches the service name.
// Handles cases like:
// - exact match: "reviews" == "reviews"
// - FQDN match: "reviews.bookinfo.svc.cluster.local" starts with "reviews."
// - partial match: "reviews.bookinfo" starts with "reviews."
func matchesServiceHost(host, serviceName string) bool {
	host = strings.TrimSpace(host)
	serviceName = strings.TrimSpace(serviceName)

	if host == "" || serviceName == "" {
		return false
	}

	// Exact match
	if host == serviceName {
		return true
	}

	// Check if host starts with serviceName followed by a dot (FQDN)
	if strings.HasPrefix(host, serviceName+".") {
		return true
	}

	// Wildcard host (e.g., "*.bookinfo.svc.cluster.local")
	// Don't match wildcards to be conservative
	if strings.HasPrefix(host, "*") {
		return false
	}

	return false
}

func validationSummaryForRuntimeObject(obj runtime.Object, fallbackGVK schema.GroupVersionKind, validations models.IstioValidations, cluster string) ValidationSummary {
	typeAcc, _ := meta.TypeAccessor(obj)
	objAcc, _ := meta.Accessor(obj)

	apiVersion := ""
	kind := ""
	if typeAcc != nil {
		apiVersion = typeAcc.GetAPIVersion()
		kind = typeAcc.GetKind()
	}
	if apiVersion == "" {
		apiVersion = fallbackGVK.GroupVersion().String()
	}
	if kind == "" {
		kind = fallbackGVK.Kind
	}

	name := ""
	namespace := ""
	if objAcc != nil {
		name = objAcc.GetName()
		namespace = objAcc.GetNamespace()
	}

	// Default: valid when we don't find a validation entry.
	out := ValidationSummary{Valid: true}
	if apiVersion == "" || kind == "" || name == "" {
		return out
	}

	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil {
		return out
	}

	key := models.IstioValidationKey{
		ObjectGVK: schema.GroupVersionKind{Group: gv.Group, Version: gv.Version, Kind: kind},
		Name:      name,
		Namespace: namespace,
		Cluster:   cluster,
	}

	v, ok := validations[key]
	if !ok || v == nil {
		return out
	}

	out.Valid = v.Valid
	checks := make([]ValidationCheckSummary, 0, len(v.Checks))
	for _, c := range v.Checks {
		if c == nil {
			continue
		}
		sev := string(c.Severity)
		if sev != "error" && sev != "warning" {
			continue
		}
		checks = append(checks, ValidationCheckSummary{
			Severity: sev,
			Message:  c.Message,
		})
	}
	if len(checks) > 0 {
		out.Checks = checks
	}
	return out
}

func filterGatewaysReferencedByVirtualServices(
	ctx context.Context,
	businessLayer *business.Layer,
	cluster string,
	virtualServices []*networking_v1.VirtualService,
	gatewaysInNamespace []*networking_v1.Gateway,
) ([]*networking_v1.Gateway, []string) {
	warnings := []string{}

	// Collect gateway refs from VS.
	type gwRef struct {
		Namespace string
		Name      string
	}
	refs := map[gwRef]struct{}{}
	for _, vs := range virtualServices {
		if vs == nil {
			continue
		}
		for _, gw := range vs.Spec.Gateways {
			gw = strings.TrimSpace(gw)
			if gw == "" || gw == "mesh" {
				continue
			}
			refNS := vs.Namespace
			refName := gw
			if parts := strings.Split(gw, "/"); len(parts) == 2 {
				refNS = strings.TrimSpace(parts[0])
				refName = strings.TrimSpace(parts[1])
			}
			if refNS == "" || refName == "" {
				continue
			}
			refs[gwRef{Namespace: refNS, Name: refName}] = struct{}{}
		}
	}

	// Index already-fetched gateways in the current namespace list.
	byNSName := map[gwRef]*networking_v1.Gateway{}
	for _, gw := range gatewaysInNamespace {
		if gw == nil {
			continue
		}
		byNSName[gwRef{Namespace: gw.Namespace, Name: gw.Name}] = gw
	}

	// Resolve refs, fetching cross-namespace gateways on-demand.
	out := []*networking_v1.Gateway{}
	for ref := range refs {
		if gw, ok := byNSName[ref]; ok {
			out = append(out, gw)
			continue
		}

		details, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, cluster, ref.Namespace, kubernetes.Gateways, ref.Name)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("warning: failed to fetch referenced Gateway %s/%s: %v", ref.Namespace, ref.Name, err))
			continue
		}
		if details.Gateway != nil {
			out = append(out, details.Gateway)
		}
	}

	// Stable ordering (helps diffs, reduces "randomness" for the model).
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	sort.Strings(warnings)
	return out, warnings
}

func criteriaForListFilter(group, kind string) business.IstioConfigCriteria {
	// Default: if we can't confidently map it, keep original behavior.
	c := business.IstioConfigCriteria{}

	switch group {
	case "networking.istio.io":
		switch kind {
		case "VirtualService":
			c.IncludeVirtualServices = true
			return c
		case "DestinationRule":
			c.IncludeDestinationRules = true
			return c
		case "Gateway":
			c.IncludeGateways = true
			return c
		case "ServiceEntry":
			c.IncludeServiceEntries = true
			return c
		case "Sidecar":
			c.IncludeSidecars = true
			return c
		}
	case "security.istio.io":
		switch kind {
		case "AuthorizationPolicy":
			c.IncludeAuthorizationPolicies = true
			return c
		}
	case "gateway.networking.k8s.io":
		switch kind {
		case "Gateway":
			c.IncludeK8sGateways = true
			return c
		case "GRPCRoute":
			c.IncludeK8sGRPCRoutes = true
			return c
		case "HTTPRoute":
			c.IncludeK8sHTTPRoutes = true
			return c
		case "ReferenceGrant":
			c.IncludeK8sReferenceGrants = true
			return c
		case "TCPRoute":
			c.IncludeK8sTCPRoutes = true
			return c
		case "TLSRoute":
			c.IncludeK8sTLSRoutes = true
			return c
		}
	case "inference.networking.k8s.io":
		switch kind {
		case "InferencePool":
			c.IncludeK8sInferencePools = true
			return c
		}
	}

	return istioConfigCriteria
}
