package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"

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

	var istioConfig *models.IstioConfigList
	var err error
	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}
	if namespace == "" {
		istioConfig, err = businessLayer.IstioConfig.GetIstioConfigList(ctx, cluster, istioConfigCriteria)
	} else {
		istioConfig, err = businessLayer.IstioConfig.GetIstioConfigListForNamespace(ctx, cluster, namespace, istioConfigCriteria)
	}

	if err != nil {
		return fmt.Sprintf("Error while getting istio config: %s", err.Error()), http.StatusInternalServerError
	}

	istioConfig.IstioValidations, err = businessLayer.Validations.GetValidations(ctx, cluster)
	if err != nil {
		return fmt.Sprintf("Error while getting validations: %s", err.Error()), http.StatusInternalServerError
	}

	return istioConfig, http.StatusOK
}
