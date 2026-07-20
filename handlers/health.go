package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/queryparams"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
)

// ResponseHeader for indicating cached health data
const HealthCachedHeader = "X-Kiali-Health-Cached"

// ClusterHealth is the API handler to get health of services from namespaces in the given cluster.
// The 'type' query parameter can be set to 'app', 'service', or 'workload' to get health for a specific type.
// If 'type' is not specified, health for all types (app, service, workload) is returned.
// When health cache is enabled, this handler serves pre-computed health data from cache. On a cache miss
// (e.g., during startup before the first refresh completes), the handler returns an empty health map for
// the affected namespace rather than computing health on-demand. This avoids expensive Prometheus queries
// during the request lifecycle. The X-Kiali-Health-Cached header indicates whether all data came from cache.
// When health cache is disabled, health is computed on-demand for each request.
func ClusterHealth(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	discovery istio.MeshDiscovery,
	cpm business.ControlPlaneMonitor,
	grafana *grafana.Service,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		if err := queryparams.RejectUnknown(params, "clusterName", "namespaces", "rateInterval", "type"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}

		namespaces := params.Get("namespaces") // csl of namespaces
		nss := []string{}
		if len(namespaces) > 0 {
			nss = strings.Split(namespaces, ",")
		}
		cluster := queryparams.ClusterName(conf, params)

		healthType := params.Get("type")
		if err := queryparams.ValidateEnum(healthType, "type", "app", "service", "workload"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}

		// Determine which health types to fetch
		var healthTypes []string
		if healthType == "" {
			healthTypes = []string{"app", "service", "workload"}
		} else {
			healthTypes = []string{healthType}
		}

		// If no namespaces specified, get all namespaces for the cluster
		if len(nss) == 0 {
			businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
			if err != nil {
				RespondWithError(w, http.StatusInternalServerError, "Initialization error: "+err.Error())
				return
			}
			loadedNamespaces, _ := businessLayer.Namespace.GetClusterNamespaces(r.Context(), cluster)
			for _, ns := range loadedNamespaces {
				nss = append(nss, ns.Name)
			}
		}

		businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Initialization error: "+err.Error())
			return
		}
		rateInterval := params.Get("rateInterval")
		if rateInterval == "" {
			rateInterval = config.DefaultHealthRateInterval
		} else if err := queryparams.ValidatePromDuration(rateInterval, "rateInterval"); err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		result, healthCachedHeader, err := businessLayer.Health.GetNamespaceHealth(r.Context(), nss, cluster, healthTypes, rateInterval)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Initialization error: "+err.Error())
			return
		}
		w.Header().Set(HealthCachedHeader, healthCachedHeader)
		RespondWithJSON(w, http.StatusOK, result)
	}
}

func adjustRateInterval(ctx context.Context, business *business.Layer, namespace, rateInterval string, queryTime time.Time, cluster string) (string, error) {
	namespaceInfo, err := business.Namespace.GetClusterNamespace(ctx, namespace, cluster)
	if err != nil {
		return "", err
	}
	interval, err := util.AdjustRateInterval(namespaceInfo.CreationTimestamp, queryTime, rateInterval)
	if err != nil {
		return "", err
	}

	if interval != rateInterval {
		log.Debugf("Rate interval for namespace %v was adjusted to %v (original = %v, query time = %v, namespace created = %v)",
			namespace, interval, rateInterval, queryTime, namespaceInfo.CreationTimestamp)
	}

	return interval, nil
}
