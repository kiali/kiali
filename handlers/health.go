package handlers

import (
	"context"
	goerrors "errors"
	"fmt"
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
		parsed, err := queryparams.ParseWithConfig(params, conf, clusterHealthQueryParams)
		if err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}

		namespaces := parsed.String("namespaces") // csl of namespaces
		nss := []string{}
		if len(namespaces) > 0 {
			nss = strings.Split(namespaces, ",")
		}
		cluster := parsed.Cluster()

		// A skipped cluster (definitively broken registration) is 404 in both query
		// forms - naming a namespace and the aggregate - before any user-namespace
		// filtering can turn it into a 403 or an empty 200: Kiali does not know the
		// cluster, matching the cache-based routes' contract. A degraded cluster (access
		// revoked, recovers on its own) is 503 in both forms: its cached health is the
		// frozen pre-revocation snapshot.
		if kialiCache.IsClusterSkipped(cluster) {
			RespondWithError(w, http.StatusNotFound, fmt.Sprintf("cluster [%s]: no cache is configured for the cluster", cluster))
			return
		}
		if _, kubeCacheErr := kialiCache.GetKubeCache(cluster); kubeCacheErr != nil && goerrors.Is(kubeCacheErr, cache.ErrClusterDegraded) {
			RespondWithError(w, http.StatusServiceUnavailable, kubeCacheErr.Error())
			return
		}

		healthType := parsed.String("type")

		// Determine which health types to fetch
		var healthTypes []string
		if healthType == "" {
			healthTypes = []string{"app", "service", "workload"}
		} else {
			healthTypes = []string{healthType}
		}

		businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Initialization error: "+err.Error())
			return
		}

		// The namespaces query parameter is user-supplied. The health data is
		// served from a cache populated by the Kiali ServiceAccount's background
		// monitor, so the Kubernetes API cannot enforce the user's RBAC here:
		// validate the requested namespaces against the user's accessible
		// namespaces and fail closed. Use the same LIST-based accessible set
		// (GetClusterNamespaces) as the empty-parameter path, not per-namespace
		// gets: with require_namespace_get=false (the default) a caller can be
		// authorized through namespace LIST, and a per-namespace GET check would
		// make the result depend on whether the per-token namespace cache is
		// warm - health would flicker between 200 and 403 for such users. Do not
		// silently drop inaccessible namespaces from a multi-namespace request -
		// partial data would make the UI show wrong aggregates.
		accessibleNamespaces, err := businessLayer.Namespace.GetClusterNamespaces(r.Context(), cluster)
		if err != nil {
			handleErrorResponse(w, err, "Error fetching namespaces: "+err.Error())
			return
		}

		if len(nss) == 0 {
			for _, ns := range accessibleNamespaces {
				// The cached accessible set is deliberately unfiltered: a partially
				// revoked namespace must not surface in the aggregate with its frozen
				// pre-revocation health.
				if kialiCache.IsNamespaceRevoked(cluster, ns.Name) {
					continue
				}
				nss = append(nss, ns.Name)
			}
		} else {
			accessible := make(map[string]struct{}, len(accessibleNamespaces))
			for _, ns := range accessibleNamespaces {
				accessible[ns.Name] = struct{}{}
			}
			for _, ns := range nss {
				if _, ok := accessible[ns]; !ok {
					respondNamespaceNotAccessible(w, ns)
					return
				}
				// A partially-revoked namespace passes the user's accessible check (the
				// cached sets are deliberately unfiltered), but its health is the SA's
				// frozen pre-revocation snapshot: refuse it like the detail endpoints,
				// with the same 503 semantics. A skipped cluster cannot reach here: it
				// has no user client, so its namespaces are never in the accessible set
				// and the not-accessible guard above has already responded.
				if kialiCache.IsNamespaceRevoked(cluster, ns) {
					RespondWithError(w, http.StatusServiceUnavailable, fmt.Sprintf("namespace [%s] in cluster [%s]: %s", ns, cluster, cache.ErrNamespaceRevoked.Error()))
					return
				}
			}
		}

		rateInterval := parsed.Duration("rateInterval")
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
