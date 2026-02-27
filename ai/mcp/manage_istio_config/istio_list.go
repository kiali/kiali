package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
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
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)

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

	istioConfig.IstioValidations, err = businessLayer.Validations.GetValidations(ctx, cluster)
	if err != nil {
		return fmt.Sprintf("Error while getting validations: %s", err.Error()), http.StatusInternalServerError
	}

	// If the caller asked for a specific GVK, trim validations to that type.
	if group != "" && version != "" && kind != "" {
		istioConfig.IstioValidations = istioConfig.IstioValidations.FilterByTypes([]string{
			schema.GroupVersionKind{Group: group, Version: version, Kind: kind}.String(),
		})
	}

	return istioConfig, http.StatusOK
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
