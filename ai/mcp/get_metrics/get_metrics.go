package get_metrics

import (
	"net/http"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/models"
)

func Execute(
	kialiInterface *mcputil.KialiInterface,
	args map[string]interface{},
) (interface{}, int) {
	resourceType := mcputil.GetStringArg(args, "resourceType")
	clusterName := mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName")
	namespace := mcputil.GetStringArg(args, "namespace")
	resourceName := mcputil.GetStringArg(args, "resourceName")

	namespaceInfo, err := mcputil.CheckNamespaceAccess(kialiInterface.Request, kialiInterface.Conf, kialiInterface.KialiCache, kialiInterface.Discovery, kialiInterface.ClientFactory, namespace, clusterName)
	if err != nil {
		return err.Error(), http.StatusForbidden
	}
	params := models.IstioMetricsQuery{Cluster: clusterName, Namespace: namespace}

	switch resourceType {
	case "service":
		params.Service = resourceName
	case "workload":
		params.Workload = resourceName
	case "app":
		params.App = resourceName
	default:
		return "invalid resourceType: must be one of 'service', 'workload', 'app'", http.StatusBadRequest
	}

	if err := mcputil.ExtractIstioMetricsQueryParams(args, &params, namespaceInfo); err != nil {
		return err.Error(), http.StatusBadRequest
	}

	metricsService := business.NewMetricsService(kialiInterface.Prom, kialiInterface.Conf)
	metrics, err := metricsService.GetMetrics(kialiInterface.Request.Context(), params, nil)
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}
	summary := SummarizeMetricsForLLM(metrics, resourceType, namespace, resourceName, &params)
	return summary, http.StatusOK
}
