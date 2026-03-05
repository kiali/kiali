package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

var istioConfigCriteria = business.IstioConfigCriteria{
	IncludeGateways:              true,
	IncludeK8sGateways:           true,
	IncludeK8sGRPCRoutes:         true,
	IncludeK8sHTTPRoutes:         true,
	IncludeK8sInferencePools:     true,
	IncludeK8sReferenceGrants:    true,
	IncludeK8sTCPRoutes:          true,
	IncludeK8sTLSRoutes:          true,
	IncludeVirtualServices:       true,
	IncludeDestinationRules:      true,
	IncludeServiceEntries:        true,
	IncludeSidecars:              true,
	IncludeAuthorizationPolicies: true,
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
	warnings := []string{}
	istioValidations, err := businessLayer.Validations.GetValidations(ctx, cluster)
	if err == nil {
		// Extract warning/error messages from validations (compact, not the full validation objects)
		for key, validation := range istioValidations {
			if !validation.Valid {
				for _, check := range validation.Checks {
					if check.Severity == "error" || check.Severity == "warning" {
						warnings = append(warnings, fmt.Sprintf("%s %s/%s: %s", key.ObjectGVK.Kind, key.Namespace, key.Name, check.Message))
					}
				}
			}
		}
	}

	// Return compact YAML instead of the full verbose object
	yml, yErr := compactIstioConfigAsYAML(virtualServices, destinationRules, gateways, warnings)
	if yErr != nil {
		return fmt.Sprintf("Error while rendering istio config as YAML: %s", yErr.Error()), http.StatusInternalServerError
	}

	// Wrap in code block for readability
	return "~~~\n" + yml + "~~~\n", http.StatusOK
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

func compactIstioConfigAsYAML(
	virtualServices []*networking_v1.VirtualService,
	destinationRules []*networking_v1.DestinationRule,
	gateways []*networking_v1.Gateway,
	warnings []string,
) (string, error) {
	docs := []string{}

	for _, w := range warnings {
		// Keep warnings as YAML comments (low token cost, useful for debugging missing refs).
		if strings.TrimSpace(w) != "" {
			docs = append(docs, "# "+strings.TrimSpace(w))
		}
	}

	for _, vs := range virtualServices {
		doc, err := compactRuntimeObjectYAML(vs, kubernetes.VirtualServices)
		if err != nil {
			return "", err
		}
		docs = append(docs, doc)
	}
	for _, dr := range destinationRules {
		doc, err := compactRuntimeObjectYAML(dr, kubernetes.DestinationRules)
		if err != nil {
			return "", err
		}
		docs = append(docs, doc)
	}
	for _, gw := range gateways {
		doc, err := compactRuntimeObjectYAML(gw, kubernetes.Gateways)
		if err != nil {
			return "", err
		}
		docs = append(docs, doc)
	}

	out := strings.Join(docs, "\n---\n")
	if out != "" && !strings.HasSuffix(out, "\n") {
		out += "\n"
	}
	return out, nil
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
