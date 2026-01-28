package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
)

const defaultHealthRateInterval = "10m"

// ResponseHeader for indicating cached health data
const HealthCachedHeader = "X-Kiali-Health-Cached"

// ClusterHealth is the API handler to get app-based health of every services from namespaces in the given cluster.
// This handler serves pre-computed health data from cache.
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
		namespaces := params.Get("namespaces") // csl of namespaces
		nss := []string{}
		if len(namespaces) > 0 {
			nss = strings.Split(namespaces, ",")
		}
		cluster := clusterNameFromQuery(conf, params)

		// Extract health type from query params
		healthType := params.Get("type")
		if healthType == "" {
			healthType = "app"
		}
		if healthType != "app" && healthType != "service" && healthType != "workload" {
			RespondWithError(w, http.StatusBadRequest, "Bad request, query parameter 'type' must be one of ['app','service','workload']")
			return
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

		result := models.ClustersNamespaceHealth{
			AppHealth:      map[string]*models.NamespaceAppHealth{},
			ServiceHealth:  map[string]*models.NamespaceServiceHealth{},
			WorkloadHealth: map[string]*models.NamespaceWorkloadHealth{},
		}

		// Check if health cache is enabled
		healthCacheEnabled := conf.KialiInternal.HealthCache.Enabled

		if healthCacheEnabled {
			// Serve from cache
			allFromCache := true
			for _, ns := range nss {
				// GetHealth now tracks cache hit/miss metrics internally
				cachedData, found := kialiCache.GetHealth(cluster, ns, healthTypeToMetricType(healthType))
				if !found {
					// Cache miss - return "unknown" status for this namespace
					allFromCache = false
					log.Debugf("health cache miss for cluster=%s namespace=%s, returning unknown status", cluster, ns)
					switch healthType {
					case "app":
						result.AppHealth[ns] = &models.NamespaceAppHealth{}
					case "service":
						result.ServiceHealth[ns] = &models.NamespaceServiceHealth{}
					case "workload":
						result.WorkloadHealth[ns] = &models.NamespaceWorkloadHealth{}
					}
					continue
				}

				// Use cached data
				switch healthType {
				case "app":
					result.AppHealth[ns] = &cachedData.AppHealth
				case "service":
					result.ServiceHealth[ns] = &cachedData.ServiceHealth
				case "workload":
					result.WorkloadHealth[ns] = &cachedData.WorkloadHealth
				}
			}

			// Set header to indicate data came from cache
			if allFromCache && len(nss) > 0 {
				w.Header().Set(HealthCachedHeader, "true")
			} else {
				w.Header().Set(HealthCachedHeader, "false")
			}
		} else {
			// Health cache disabled - compute on-demand
			w.Header().Set(HealthCachedHeader, "false")

			businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
			if err != nil {
				RespondWithError(w, http.StatusInternalServerError, "Initialization error: "+err.Error())
				return
			}

			queryTime := util.Clock.Now()
			rateInterval := params.Get("rateInterval")
			if rateInterval == "" {
				rateInterval = defaultHealthRateInterval
			}

			for _, ns := range nss {
				criteria := business.NamespaceHealthCriteria{
					Cluster:        cluster,
					IncludeMetrics: true,
					Namespace:      ns,
					QueryTime:      queryTime,
					RateInterval:   rateInterval,
				}

				switch healthType {
				case "app":
					health, err := businessLayer.Health.GetNamespaceAppHealth(r.Context(), criteria)
					if err != nil {
						log.Warningf("Error computing app health for namespace %s: %v", ns, err)
						result.AppHealth[ns] = &models.NamespaceAppHealth{}
					} else {
						result.AppHealth[ns] = &health
					}
				case "service":
					health, err := businessLayer.Health.GetNamespaceServiceHealth(r.Context(), criteria)
					if err != nil {
						log.Warningf("Error computing service health for namespace %s: %v", ns, err)
						result.ServiceHealth[ns] = &models.NamespaceServiceHealth{}
					} else {
						result.ServiceHealth[ns] = &health
					}
				case "workload":
					health, err := businessLayer.Health.GetNamespaceWorkloadHealth(r.Context(), criteria)
					if err != nil {
						log.Warningf("Error computing workload health for namespace %s: %v", ns, err)
						result.WorkloadHealth[ns] = &models.NamespaceWorkloadHealth{}
					} else {
						result.WorkloadHealth[ns] = &health
					}
				}
			}
		}

		RespondWithJSON(w, http.StatusOK, result)
	}
}

type baseHealthParams struct {
	// Cluster name
	ClusterName string `json:"clusterName"`
	// The namespace scope
	//
	// in: path
	Namespace string `json:"namespace"`
	// The rate interval used for fetching error rate
	//
	// in: query
	// default: 10m
	RateInterval string `json:"rateInterval"`
	// The time to use for the prometheus query
	QueryTime time.Time
}

func (p *baseHealthParams) baseExtract(conf *config.Config, r *http.Request, vars map[string]string) {
	queryParams := r.URL.Query()
	p.RateInterval = defaultHealthRateInterval
	p.QueryTime = util.Clock.Now()
	if rateInterval := queryParams.Get("rateInterval"); rateInterval != "" {
		p.RateInterval = rateInterval
	}
	p.ClusterName = clusterNameFromQuery(conf, queryParams)
	if queryTime := queryParams.Get("queryTime"); queryTime != "" {
		unix, err := strconv.ParseInt(queryTime, 10, 64)
		if err == nil {
			p.QueryTime = time.Unix(unix, 0)
		}
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

// healthTypeToMetricType converts a health type string to the internalmetrics.HealthType
func healthTypeToMetricType(healthType string) internalmetrics.HealthType {
	switch healthType {
	case "app":
		return internalmetrics.HealthTypeApp
	case "service":
		return internalmetrics.HealthTypeService
	case "workload":
		return internalmetrics.HealthTypeWorkload
	default:
		return internalmetrics.HealthTypeApp
	}
}
