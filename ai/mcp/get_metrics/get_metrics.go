package get_metrics

import (
	"net/http"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

func Execute(
	r *http.Request,
	args map[string]interface{},
	businessLayer *business.Layer,
	prom prometheus.ClientInterface,
	clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache,
	conf *config.Config,
	_ *grafana.Service,
	_ *perses.Service,
	discovery *istio.Discovery,
) (interface{}, int) {
	resourceType := mcputil.GetStringArg(args, "resourceType")
	clusterName := mcputil.GetStringOrDefault(args, conf.KubernetesConfig.ClusterName, "clusterName")
	namespace := mcputil.GetStringArg(args, "namespace")
	resourceName := mcputil.GetStringArg(args, "resourceName")

	namespaceInfo, err := mcputil.CheckNamespaceAccess(r, conf, kialiCache, discovery, clientFactory, namespace, clusterName)
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

	metricsService := business.NewMetricsService(prom, conf)
	metrics, err := metricsService.GetMetrics(r.Context(), params, nil)
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}
	return metrics, http.StatusOK
}
