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

	"github.com/kiali/kiali/ai/mcputil"
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
	IncludeTrafficExtensions:      true,
	IncludeWasmPlugins:            true,
	IncludeTelemetry:              true,
}

// istioListItem is an internal flat representation used while collecting
// resources before they are grouped into the final output structure.
type istioListItem struct {
	Name      string
	Namespace string
	Group     string
	Version   string
	Kind      string
	Valid     bool
}

// KindValidationResult summarises resources for a single GVK within a namespace.
// The map key in IstioListResult is "group/version/kind".
// Valid and Invalid are mutually exclusive subsets; both omitted when empty.
type KindValidationResult struct {
	Valid   []string `json:"valid,omitempty"`   // Resources passing validation
	Invalid []string `json:"invalid,omitempty"` // Resources failing validation
}

// IstioListResult is the grouped output returned by the list action.
// Resources are nested as: namespace → "group/version/kind" → {valid, invalid}.
// This eliminates per-item repetition of namespace, group, version, and kind keys.
type IstioListResult struct {
	Cluster    string                                     `json:"cluster"`
	Namespaces map[string]map[string]KindValidationResult `json:"namespaces"`
}

type validationSummary struct {
	Valid  bool
	Checks []validationCheckSummary
}

type validationCheckSummary struct {
	Severity string
	Message  string
}

func IstioList(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	// Extract parameters
	cluster := mcputil.GetStringArg(args, "clusterName")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	kind := mcputil.GetStringArg(args, "kind")
	serviceName := mcputil.GetStringArg(args, "serviceName")

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
		return fmt.Sprintf("Error while getting istio config: %s", err.Error()), http.StatusOK
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
	trafficExtensions := istioConfig.TrafficExtensions
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

	items := make([]istioListItem, 0, len(virtualServices)+len(destinationRules)+len(gateways))

	appendItem := func(name, ns string, gvk schema.GroupVersionKind, obj runtime.Object) {
		v := validationSummaryForRuntimeObject(obj, gvk, istioValidations, cluster)
		items = append(items, istioListItem{
			Name:      name,
			Namespace: ns,
			Group:     gvk.Group,
			Version:   gvk.Version,
			Kind:      gvk.Kind,
			Valid:     v.Valid,
		})
	}

	for _, vs := range virtualServices {
		if vs != nil {
			appendItem(vs.Name, vs.Namespace, kubernetes.VirtualServices, vs)
		}
	}
	for _, dr := range destinationRules {
		if dr != nil {
			appendItem(dr.Name, dr.Namespace, kubernetes.DestinationRules, dr)
		}
	}
	for _, gw := range gateways {
		if gw != nil {
			appendItem(gw.Name, gw.Namespace, kubernetes.Gateways, gw)
		}
	}

	// Remaining supported types (not affected by service_name filtering).
	for _, se := range serviceEntries {
		if se != nil {
			appendItem(se.Name, se.Namespace, kubernetes.ServiceEntries, se)
		}
	}
	for _, sc := range sidecars {
		if sc != nil {
			appendItem(sc.Name, sc.Namespace, kubernetes.Sidecars, sc)
		}
	}
	for _, ef := range envoyFilters {
		if ef != nil {
			appendItem(ef.Name, ef.Namespace, kubernetes.EnvoyFilters, ef)
		}
	}
	for _, we := range workloadEntries {
		if we != nil {
			appendItem(we.Name, we.Namespace, kubernetes.WorkloadEntries, we)
		}
	}
	for _, wg := range workloadGroups {
		if wg != nil {
			appendItem(wg.Name, wg.Namespace, kubernetes.WorkloadGroups, wg)
		}
	}
	for _, te := range trafficExtensions {
		if te != nil {
			appendItem(te.Name, te.Namespace, kubernetes.TrafficExtensions, te)
		}
	}
	for _, wp := range wasmPlugins {
		if wp != nil {
			appendItem(wp.Name, wp.Namespace, kubernetes.WasmPlugins, wp)
		}
	}
	for _, tl := range telemetries {
		if tl != nil {
			appendItem(tl.Name, tl.Namespace, kubernetes.Telemetries, tl)
		}
	}
	for _, ap := range authorizationPolicies {
		if ap != nil {
			appendItem(ap.Name, ap.Namespace, kubernetes.AuthorizationPolicies, ap)
		}
	}
	for _, pa := range peerAuthentications {
		if pa != nil {
			appendItem(pa.Name, pa.Namespace, kubernetes.PeerAuthentications, pa)
		}
	}
	for _, ra := range requestAuthentications {
		if ra != nil {
			appendItem(ra.Name, ra.Namespace, kubernetes.RequestAuthentications, ra)
		}
	}
	for _, kgw := range k8sGateways {
		if kgw != nil {
			appendItem(kgw.Name, kgw.Namespace, kubernetes.K8sGateways, kgw)
		}
	}
	for _, hr := range k8sHTTPRoutes {
		if hr != nil {
			appendItem(hr.Name, hr.Namespace, kubernetes.K8sHTTPRoutes, hr)
		}
	}
	for _, gr := range k8sGRPCRoutes {
		if gr != nil {
			appendItem(gr.Name, gr.Namespace, kubernetes.K8sGRPCRoutes, gr)
		}
	}
	for _, tr := range k8sTCPRoutes {
		if tr != nil {
			appendItem(tr.Name, tr.Namespace, kubernetes.K8sTCPRoutes, tr)
		}
	}
	for _, tlr := range k8sTLSRoutes {
		if tlr != nil {
			appendItem(tlr.Name, tlr.Namespace, kubernetes.K8sTLSRoutes, tlr)
		}
	}
	for _, rg := range k8sReferenceGrants {
		if rg != nil {
			appendItem(rg.Name, rg.Namespace, kubernetes.K8sReferenceGrants, rg)
		}
	}
	for _, ip := range k8sInferencePools {
		if ip != nil {
			appendItem(ip.Name, ip.Namespace, kubernetes.K8sInferencePools, ip)
		}
	}

	// Sort for deterministic output: namespace → group/kind → name.
	sort.Slice(items, func(i, j int) bool {
		if items[i].Namespace != items[j].Namespace {
			return items[i].Namespace < items[j].Namespace
		}
		gvkI := items[i].Group + "/" + items[i].Kind
		gvkJ := items[j].Group + "/" + items[j].Kind
		if gvkI != gvkJ {
			return gvkI < gvkJ
		}
		return items[i].Name < items[j].Name
	})

	// Group into namespace → "group/version/kind" → {valid, invalid}.
	// Because items are pre-sorted the name slices are already in alphabetical order.
	namespaces := make(map[string]map[string]KindValidationResult)
	for _, item := range items {
		gvkKey := item.Group + "/" + item.Version + "/" + item.Kind
		if namespaces[item.Namespace] == nil {
			namespaces[item.Namespace] = make(map[string]KindValidationResult)
		}
		kvr := namespaces[item.Namespace][gvkKey]
		if item.Valid {
			kvr.Valid = append(kvr.Valid, item.Name)
		} else {
			kvr.Invalid = append(kvr.Invalid, item.Name)
		}
		namespaces[item.Namespace][gvkKey] = kvr
	}

	return IstioListResult{Cluster: cluster, Namespaces: namespaces}, http.StatusOK
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

func validationSummaryForRuntimeObject(obj runtime.Object, fallbackGVK schema.GroupVersionKind, validations models.IstioValidations, cluster string) validationSummary {
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
	out := validationSummary{Valid: true}
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
	checks := make([]validationCheckSummary, 0, len(v.Checks))
	for _, c := range v.Checks {
		if c == nil {
			continue
		}
		sev := string(c.Severity)
		if sev != "error" && sev != "warning" {
			continue
		}
		checks = append(checks, validationCheckSummary{
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
	case "extensions.istio.io":
		switch kind {
		case "TrafficExtension":
			c.IncludeTrafficExtensions = true
			return c
		case "WasmPlugin":
			c.IncludeWasmPlugins = true
			return c
		}
	case "telemetry.istio.io":
		switch kind {
		case "Telemetry":
			c.IncludeTelemetry = true
			return c
		}
	}

	return istioConfigCriteria
}
