package get_overview_stats

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

const topServicesLimit = 6

type ApplicationHealthSummary struct {
	Degraded  int     `json:"degraded"`
	Failure   int     `json:"failure"`
	Healthy   int     `json:"healthy"`
	NA        int     `json:"na"`
	NoTraffic int     `json:"no_traffic"`
	RpsIn     float64 `json:"rps_in"`
	RpsOut    float64 `json:"rps_out"`
	Total     int     `json:"total"`
}

type ClusterSummary struct {
	Healthy   int `json:"healthy"`
	Total     int `json:"total"`
	Unhealthy int `json:"unhealthy"`
}

type ControlPlaneInfo struct {
	Cluster        string `json:"cluster"`
	IstiodName     string `json:"istiod_name"`
	ManagedCluster int    `json:"managed_clusters"`
	Revision       string `json:"revision,omitempty"`
	Status         string `json:"status"`
	Version        string `json:"version,omitempty"`
}

type ControlPlaneSummary struct {
	ControlPlanes []ControlPlaneInfo `json:"control_planes"`
	Healthy       int                `json:"healthy"`
	Total         int                `json:"total"`
	Unhealthy     int                `json:"unhealthy"`
}

type DataPlaneSummary struct {
	Ambient  int `json:"ambient"`
	Degraded int `json:"degraded"`
	Failure  int `json:"failure"`
	Healthy  int `json:"healthy"`
	NA       int `json:"na"`
	Sidecar  int `json:"sidecar"`
	Total    int `json:"total"`
}

type IstioConfigSummary struct {
	Errors   int `json:"errors"`
	Total    int `json:"total"`
	Valid    int `json:"valid"`
	Warnings int `json:"warnings"`
}

type NamespacesSummary struct {
	ControlPlane int `json:"control_plane"`
	DataPlane    int `json:"data_plane"`
	Total        int `json:"total"`
}

type OverviewStatsResponse struct {
	Applications      ApplicationHealthSummary `json:"applications"`
	Clusters          ClusterSummary           `json:"clusters"`
	ControlPlanes     ControlPlaneSummary      `json:"control_planes"`
	DataPlanes        DataPlaneSummary         `json:"data_planes"`
	Errors            string                   `json:"errors,omitempty"`
	IstioConfig       IstioConfigSummary       `json:"istio_config"`
	NamespacesSummary NamespacesSummary        `json:"namespaces_summary"`
	Summary           string                   `json:"summary"`
	TopServiceErrors  []ServiceErrorInfo       `json:"top_service_errors,omitempty"`
	TopServiceLatency []ServiceLatencyInfo     `json:"top_service_latency,omitempty"`
}

type ServiceErrorInfo struct {
	Cluster     string  `json:"cluster"`
	ErrorRate   float64 `json:"error_rate"`
	Namespace   string  `json:"namespace"`
	RequestRate float64 `json:"request_rate"`
	ServiceName string  `json:"service_name"`
}

type ServiceLatencyInfo struct {
	Cluster     string  `json:"cluster"`
	LatencyMs   float64 `json:"latency_ms"`
	Namespace   string  `json:"namespace"`
	ServiceName string  `json:"service_name"`
}

func Execute(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, prom prometheus.ClientInterface, _ kubernetes.ClientFactory, _ cache.KialiCache, conf *config.Config, _ *grafana.Service, _ *perses.Service, discovery *istio.Discovery) (interface{}, int) {
	clusterName := mcputil.GetStringArg(args, "clusterName")
	if clusterName == "" {
		clusterName = conf.KubernetesConfig.ClusterName
	}

	response := OverviewStatsResponse{}
	rateInterval := string(conf.HealthConfig.Compute.Duration)
	if rateInterval == "" {
		rateInterval = "10m"
	}
	queryTime := time.Now()

	nsList, err := businessLayer.Namespace.GetClusterNamespaces(r.Context(), clusterName)
	if err != nil {
		log.Warningf("Error fetching namespaces: %v", err)
		response.Errors = fmt.Sprintf("Error fetching namespaces: %v", err)
		response.Summary = "Error fetching data"
		return response, http.StatusOK
	}

	cpCount := 0
	for _, ns := range nsList {
		if ns.IsControlPlane {
			cpCount++
		}
	}
	response.NamespacesSummary = NamespacesSummary{
		ControlPlane: cpCount,
		DataPlane:    len(nsList) - cpCount,
		Total:        len(nsList),
	}

	// Cluster stats from Istio component status
	istioStatus, err := businessLayer.IstioStatus.GetStatus(r.Context())
	if err != nil {
		log.Warningf("Error fetching Istio status: %v", err)
	} else {
		clusterIssues := make(map[string]int)
		for _, comp := range istioStatus {
			cluster := comp.Cluster
			if cluster == "" {
				cluster = clusterName
			}
			if _, exists := clusterIssues[cluster]; !exists {
				clusterIssues[cluster] = 0
			}
			if comp.Status != kubernetes.ComponentHealthy && comp.Status != "" {
				clusterIssues[cluster]++
			}
		}
		healthy := 0
		unhealthy := 0
		for _, issues := range clusterIssues {
			if issues > 0 {
				unhealthy++
			} else {
				healthy++
			}
		}
		response.Clusters = ClusterSummary{
			Healthy:   healthy,
			Total:     len(clusterIssues),
			Unhealthy: unhealthy,
		}
	}

	// Mesh control planes from discovery API
	if discovery != nil {
		mesh, err := discovery.Mesh(r.Context())
		if err != nil {
			log.Warningf("Error fetching mesh control planes: %v", err)
		} else {
			cpInfos := make([]ControlPlaneInfo, 0, len(mesh.ControlPlanes))
			cpHealthy := 0
			cpUnhealthy := 0
			for _, cp := range mesh.ControlPlanes {
				clusterN := ""
				if cp.Cluster != nil {
					clusterN = cp.Cluster.Name
				}
				version := ""
				if cp.Version != nil {
					version = cp.Version.Version
				}
				managedCount := 0
				if cp.ManagedClusters != nil {
					managedCount = len(cp.ManagedClusters)
				}
				status := cp.Status
				if status == "" || status == kubernetes.ComponentHealthy {
					cpHealthy++
				} else {
					cpUnhealthy++
				}
				cpInfos = append(cpInfos, ControlPlaneInfo{
					Cluster:        clusterN,
					IstiodName:     cp.IstiodName,
					ManagedCluster: managedCount,
					Revision:       cp.Revision,
					Status:         status,
					Version:        version,
				})
			}
			response.ControlPlanes = ControlPlaneSummary{
				ControlPlanes: cpInfos,
				Healthy:       cpHealthy,
				Total:         len(cpInfos),
				Unhealthy:     cpUnhealthy,
			}
		}
	}

	// Istio config validations
	validations, err := businessLayer.Validations.GetValidations(r.Context(), clusterName)
	if err != nil {
		log.Warningf("Error fetching Istio validations: %v", err)
	} else {
		validCount := 0
		warningCount := 0
		errorCount := 0
		totalConfigs := 0
		for _, v := range validations {
			if v.ObjectGVK.Kind == "workload" {
				continue
			}
			totalConfigs++
			if v.Valid {
				hasWarning := false
				for _, check := range v.Checks {
					if check.Severity == models.WarningSeverity {
						hasWarning = true
						break
					}
				}
				if hasWarning {
					warningCount++
				} else {
					validCount++
				}
			} else {
				errorCount++
			}
		}
		response.IstioConfig = IstioConfigSummary{
			Errors:   errorCount,
			Total:    totalConfigs,
			Valid:    validCount,
			Warnings: warningCount,
		}
	}

	// Data plane health and application stats across all data plane namespaces
	dpSummary := DataPlaneSummary{}
	appSummary := ApplicationHealthSummary{}
	var allServiceErrors []ServiceErrorInfo

	for _, ns := range nsList {
		if ns.IsControlPlane {
			continue
		}
		dpSummary.Total++
		if ns.IsAmbient {
			dpSummary.Ambient++
		} else {
			dpSummary.Sidecar++
		}

		criteria := business.NamespaceHealthCriteria{
			Cluster:        clusterName,
			IncludeMetrics: true,
			Namespace:      ns.Name,
			QueryTime:      queryTime,
			RateInterval:   rateInterval,
		}

		wlHealth, err := businessLayer.Health.GetNamespaceWorkloadHealth(r.Context(), criteria)
		if err != nil {
			log.Warningf("Error fetching workload health for namespace %s: %v", ns.Name, err)
			dpSummary.NA++
		} else {
			nsStatus := aggregateWorkloadStatus(wlHealth)
			switch nsStatus {
			case models.HealthStatusHealthy:
				dpSummary.Healthy++
			case models.HealthStatusDegraded:
				dpSummary.Degraded++
			case models.HealthStatusFailure:
				dpSummary.Failure++
			default:
				dpSummary.NA++
			}
		}

		appHealth, err := businessLayer.Health.GetNamespaceAppHealth(r.Context(), criteria)
		if err != nil {
			log.Warningf("Error fetching app health for namespace %s: %v", ns.Name, err)
		} else {
			for _, ah := range appHealth {
				if ah == nil {
					continue
				}
				appSummary.Total++
				var status models.HealthStatus
				if ah.Status != nil {
					status = ah.Status.Status
				}
				switch status {
				case models.HealthStatusHealthy:
					appSummary.Healthy++
				case models.HealthStatusDegraded:
					appSummary.Degraded++
				case models.HealthStatusFailure:
					appSummary.Failure++
				default:
					appSummary.NA++
				}
				rateIn := ah.Requests.GetInboundRequestRate()
				rateOut := ah.Requests.GetOutboundRequestRate()
				appSummary.RpsIn += rateIn
				appSummary.RpsOut += rateOut
				if rateIn == 0 && rateOut == 0 {
					appSummary.NoTraffic++
				}
			}
		}

		svcHealth, err := businessLayer.Health.GetNamespaceServiceHealth(r.Context(), criteria)
		if err != nil {
			log.Warningf("Error fetching service health for namespace %s: %v", ns.Name, err)
		} else {
			for svcName, sh := range svcHealth {
				if sh == nil || sh.Status == nil {
					continue
				}
				requestRate := sh.Requests.GetTotalRequestRate()
				if requestRate <= 0 {
					continue
				}
				errorRate := sh.Status.ErrorRatio / 100.0
				if errorRate > 0 {
					allServiceErrors = append(allServiceErrors, ServiceErrorInfo{
						Cluster:     clusterName,
						ErrorRate:   math.Round(errorRate*10000) / 10000,
						Namespace:   ns.Name,
						RequestRate: math.Round(requestRate*100) / 100,
						ServiceName: svcName,
					})
				}
			}
		}
	}

	response.DataPlanes = dpSummary
	appSummary.RpsIn = math.Round(appSummary.RpsIn*100) / 100
	appSummary.RpsOut = math.Round(appSummary.RpsOut*100) / 100
	response.Applications = appSummary

	sort.Slice(allServiceErrors, func(i, j int) bool {
		return allServiceErrors[i].ErrorRate > allServiceErrors[j].ErrorRate
	})
	if len(allServiceErrors) > topServicesLimit {
		allServiceErrors = allServiceErrors[:topServicesLimit]
	}
	response.TopServiceErrors = allServiceErrors

	// Top service latencies (P95) from Prometheus
	if prom != nil {
		latencies := fetchTopLatencies(r, prom, conf, rateInterval)
		response.TopServiceLatency = latencies
	}

	response.Summary = buildSummary(response)
	return response, http.StatusOK
}

func fetchTopLatencies(r *http.Request, prom prometheus.ClientInterface, conf *config.Config, rateInterval string) []ServiceLatencyInfo {
	labels := `destination_workload!="unknown"`
	queryScope := conf.ExternalServices.Prometheus.QueryScope
	for labelName, labelValue := range queryScope {
		labels = fmt.Sprintf("%s,%s=\"%s\"", labels, prometheus.SanitizeLabelName(labelName), labelValue)
	}
	groupBy := "destination_cluster,destination_service_namespace,destination_service_name"
	query := fmt.Sprintf(
		`round(topk(%d, histogram_quantile(0.95, sum(rate(istio_request_duration_milliseconds_bucket{%s}[%s])) by (le,%s)) > 0), 0.001)`,
		topServicesLimit, labels, rateInterval, groupBy,
	)

	result, warnings, err := prom.API().Query(r.Context(), query, time.Now())
	if err != nil {
		log.Warningf("Error querying Prometheus for service latencies: %v", err)
		return nil
	}
	if len(warnings) > 0 {
		log.Warningf("Prometheus warnings for service latencies: %v", warnings)
	}

	vector, ok := result.(model.Vector)
	if !ok {
		log.Warningf("Unexpected Prometheus result type for latencies: %T", result)
		return nil
	}

	latencies := make([]ServiceLatencyInfo, 0, len(vector))
	for _, sample := range vector {
		if math.IsNaN(float64(sample.Value)) {
			continue
		}
		serviceName := string(sample.Metric["destination_service_name"])
		if serviceName == "" {
			continue
		}
		latencies = append(latencies, ServiceLatencyInfo{
			Cluster:     string(sample.Metric["destination_cluster"]),
			LatencyMs:   math.Round(float64(sample.Value)*1000) / 1000,
			Namespace:   string(sample.Metric["destination_service_namespace"]),
			ServiceName: serviceName,
		})
	}
	return latencies
}

func aggregateWorkloadStatus(health models.NamespaceWorkloadHealth) models.HealthStatus {
	worst := models.HealthStatusNA
	for _, wh := range health {
		if wh == nil || wh.Status == nil {
			continue
		}
		s := wh.Status.Status
		if s == models.HealthStatusFailure {
			return models.HealthStatusFailure
		}
		if s == models.HealthStatusDegraded {
			worst = models.HealthStatusDegraded
		}
		if s == models.HealthStatusHealthy && worst != models.HealthStatusDegraded {
			worst = models.HealthStatusHealthy
		}
	}
	return worst
}

func buildSummary(r OverviewStatsResponse) string {
	return fmt.Sprintf(
		"Clusters: %d total (%d healthy, %d unhealthy). "+
			"Namespaces: %d total (%d control plane, %d data plane). "+
			"Control planes: %d healthy, %d unhealthy out of %d. "+
			"Data planes: %d healthy, %d degraded, %d unhealthy, %d NA (%d ambient, %d sidecar). "+
			"Istio configs: %d valid, %d warnings, %d errors out of %d. "+
			"Applications: %d total (%d healthy, %d degraded, %d failure, %d NA, %d no traffic), RPS in: %.1f, RPS out: %.1f. "+
			"Services with errors: %d. Services with latency data: %d.",
		r.Clusters.Total, r.Clusters.Healthy, r.Clusters.Unhealthy,
		r.NamespacesSummary.Total, r.NamespacesSummary.ControlPlane, r.NamespacesSummary.DataPlane,
		r.ControlPlanes.Healthy, r.ControlPlanes.Unhealthy, r.ControlPlanes.Total,
		r.DataPlanes.Healthy, r.DataPlanes.Degraded, r.DataPlanes.Failure, r.DataPlanes.NA, r.DataPlanes.Ambient, r.DataPlanes.Sidecar,
		r.IstioConfig.Valid, r.IstioConfig.Warnings, r.IstioConfig.Errors, r.IstioConfig.Total,
		r.Applications.Total, r.Applications.Healthy, r.Applications.Degraded, r.Applications.Failure, r.Applications.NA, r.Applications.NoTraffic,
		r.Applications.RpsIn, r.Applications.RpsOut,
		len(r.TopServiceErrors), len(r.TopServiceLatency),
	)
}
