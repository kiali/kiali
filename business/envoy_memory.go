package business

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"k8s.io/apimachinery/pkg/api/resource"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

const (
	sidecarHighMemoryBytes     = 100 * 1024 * 1024
	gatewayHighMemoryBytes     = 256 * 1024 * 1024
	sidecarLargeConfigClusters = 50
	gatewayLargeConfigClusters = 150
	envoyMemoryLimitRatio      = 0.7
	idleRequestRatePerSecond   = 0.1
	idleActiveConnections      = 5
	// Rough estimate of Envoy config memory contribution per active cluster.
	// There is no explicit config-vs-traffic memory split; this is a ballpark for UI guidance.
	roughConfigBytesPerCluster = 50 * 1024

	istioProxyMemoryLimitAnnotation = "sidecar.istio.io/proxyMemoryLimit"
)

// EnvoyMemoryService computes Envoy memory diagnostics for workloads.
type EnvoyMemoryService struct {
	conf *config.Config
	prom prometheus.ClientInterface
}

// NewEnvoyMemoryService creates an EnvoyMemoryService.
func NewEnvoyMemoryService(prom prometheus.ClientInterface, conf *config.Config) *EnvoyMemoryService {
	return &EnvoyMemoryService{conf: conf, prom: prom}
}

// GetSummary returns the current Envoy memory diagnostic for a workload.
func (in *EnvoyMemoryService) GetSummary(ctx context.Context, workload *models.Workload, q *prometheus.RangeQuery) (*models.EnvoyMemorySummary, error) {
	if workload == nil {
		return nil, fmt.Errorf("workload is required")
	}
	if !HasEnvoyProxyWorkload(workload) {
		return nil, fmt.Errorf("workload does not have an Envoy proxy")
	}

	envoyLabels := BuildWorkloadMetricLabels(in.conf, workload)
	if envoyLabels == "" {
		return nil, fmt.Errorf("workload has no pods with an Envoy proxy")
	}

	memoryMetric := in.prom.FetchRange(ctx, "envoy_server_memory_allocated", envoyLabels, "", "", q)
	clustersMetric := in.prom.FetchRange(ctx, "envoy_cluster_manager_active_clusters", envoyLabels, "", "", q)

	upstreamCx := in.prom.FetchRange(ctx, "envoy_cluster_upstream_cx_active", envoyLabels, "", "", q)
	upstreamRqTotal := in.prom.FetchRateRange(ctx, "envoy_cluster_upstream_rq_total", []string{envoyLabels}, "", q)
	// Some Istio versions export upstream_rq without the _total suffix.
	upstreamRq := in.prom.FetchRateRange(ctx, "envoy_cluster_upstream_rq", []string{envoyLabels}, "", q)
	// Downstream listener stats are often absent on waypoints and newer gateways.
	downstreamCx := in.prom.FetchRange(ctx, "envoy_listener_downstream_cx_active", envoyLabels, "", "", q)
	downstreamRq := fetchEnvoyDownstreamRequestRate(ctx, in.prom, envoyLabels, q)
	// istio_requests_total must use Istio-intrinsic labels (source_workload,
	// destination_workload) because scrape-based labels (app, version) are
	// stripped in federated Prometheus setups via recording-rule aggregation.
	istioSourceLabels := buildIstioWorkloadLabels(workload.Namespace, workload.Name, "source", in.conf)
	istioDestLabels := buildIstioWorkloadLabels(workload.Namespace, workload.Name, "destination", in.conf)
	istioRq := in.prom.FetchRateRange(ctx, "istio_requests_total", []string{istioSourceLabels, istioDestLabels}, "", q)

	memoryMax := maxLatestValue(memoryMetric)
	activeClustersMax := int64(maxLatestValue(clustersMetric))
	activeConnections := sumEnvoyActiveConnections(upstreamCx, downstreamCx)
	envoyRequestRate := envoyRequestRateFromMetrics(upstreamRqTotal, upstreamRq, downstreamRq)
	requestRate := maxRequestRate(envoyRequestRate, sumLatestValues(istioRq))

	proxyType := envoyProxyType(workload)
	absoluteThreshold, largeConfigClusters := envoyMemoryAbsoluteThresholds(proxyType)
	memoryLimit := resolveEnvoyProxyMemoryLimit(ctx, in.prom, workload, envoyLabels, q.End)
	memoryThreshold := computeEnvoyMemoryThreshold(absoluteThreshold, memoryLimit)
	cause := classifyEnvoyMemory(memoryThreshold, largeConfigClusters, memoryMax, activeClustersMax, activeConnections, requestRate)

	var memoryUsedPercent float64
	if memoryLimit > 0 {
		memoryUsedPercent = (memoryMax / memoryLimit) * 100
	}

	return &models.EnvoyMemorySummary{
		ActiveClustersMax:            activeClustersMax,
		ActiveConnections:            activeConnections,
		Cause:                        cause,
		LargeConfigClustersThreshold: largeConfigClusters,
		MemoryLimitBytes:             int64(memoryLimit),
		MemoryMaxBytes:               int64(memoryMax),
		MemoryThresholdBytes:         int64(memoryThreshold),
		MemoryUsedPercent:            memoryUsedPercent,
		ProxyType:                    proxyType,
		RequestRate:                  requestRate,
		RoughConfigMemoryBytes:       activeClustersMax * roughConfigBytesPerCluster,
	}, nil
}

// HasEnvoyProxyWorkload returns true when the workload exposes Envoy memory diagnostics.
func HasEnvoyProxyWorkload(workload *models.Workload) bool {
	if workload == nil || workload.IsZtunnel() {
		return false
	}
	if workload.IsGateway() || workload.IsWaypoint() {
		return true
	}
	return workload.HasIstioSidecar()
}

func envoyProxyType(workload *models.Workload) models.EnvoyProxyType {
	if workload.IsGateway() {
		return models.EnvoyProxyTypeGateway
	}
	if workload.IsWaypoint() {
		return models.EnvoyProxyTypeWaypoint
	}
	return models.EnvoyProxyTypeSidecar
}

func classifyEnvoyMemory(memoryThreshold float64, largeConfigThreshold int64, memoryBytes float64, activeClusters int64, activeConnections int64, requestRate float64) models.EnvoyMemoryCause {
	if memoryBytes <= memoryThreshold {
		return models.EnvoyMemoryCauseOK
	}

	idle := requestRate < idleRequestRatePerSecond && activeConnections < idleActiveConnections
	largeConfig := activeClusters > largeConfigThreshold

	if idle && largeConfig {
		return models.EnvoyMemoryCauseConfiguration
	}
	if !idle {
		return models.EnvoyMemoryCauseTraffic
	}
	return models.EnvoyMemoryCauseUnknown
}

func envoyMemoryAbsoluteThresholds(proxyType models.EnvoyProxyType) (highMemoryBytes float64, largeConfigClusters int64) {
	switch proxyType {
	case models.EnvoyProxyTypeGateway, models.EnvoyProxyTypeWaypoint:
		return float64(gatewayHighMemoryBytes), gatewayLargeConfigClusters
	default:
		return float64(sidecarHighMemoryBytes), sidecarLargeConfigClusters
	}
}

func computeEnvoyMemoryThreshold(absoluteThreshold, proxyMemoryLimitBytes float64) float64 {
	if proxyMemoryLimitBytes > 0 {
		return proxyMemoryLimitBytes * envoyMemoryLimitRatio
	}

	return absoluteThreshold
}

func resolveEnvoyProxyMemoryLimit(ctx context.Context, prom prometheus.ClientInterface, workload *models.Workload, labels string, queryTime time.Time) float64 {
	limit := envoyProxyMemoryLimitFromAnnotations(workload)
	if prom != nil && prom.API() != nil && labels != "" {
		query := fmt.Sprintf(
			`max(container_spec_memory_limit_bytes%s)`,
			appendEnvoyProxyContainerLabel(labels),
		)
		if promLimit := promInstantScalar(ctx, prom, query, queryTime); promLimit > limit {
			limit = promLimit
		}
	}

	return limit
}

func envoyProxyMemoryLimitFromAnnotations(workload *models.Workload) float64 {
	if workload == nil {
		return 0
	}

	max := 0.0
	for _, pod := range workload.Pods {
		if pod == nil || pod.Annotations == nil {
			continue
		}
		raw, ok := pod.Annotations[istioProxyMemoryLimitAnnotation]
		if !ok {
			continue
		}
		if bytes := parseMemoryQuantity(raw); bytes > max {
			max = bytes
		}
	}

	return max
}

func parseMemoryQuantity(raw string) float64 {
	quantity, err := resource.ParseQuantity(strings.TrimSpace(raw))
	if err != nil {
		return 0
	}

	return float64(quantity.Value())
}

func appendEnvoyProxyContainerLabel(labels string) string {
	trimmed := strings.TrimSuffix(labels, "}")
	return fmt.Sprintf(`%s,container="%s"}`, trimmed, models.IstioProxy)
}

func promInstantScalar(ctx context.Context, prom prometheus.ClientInterface, query string, queryTime time.Time) float64 {
	result, _, err := prom.API().Query(ctx, query, queryTime)
	if err != nil {
		return 0
	}

	vector, ok := result.(model.Vector)
	if !ok || len(vector) == 0 {
		return 0
	}

	max := 0.0
	for _, sample := range vector {
		value := float64(sample.Value)
		if value > max {
			max = value
		}
	}

	return max
}

// BuildWorkloadMetricLabels builds Prometheus label selectors scoped to a workload.
func BuildWorkloadMetricLabels(conf *config.Config, workload *models.Workload) string {
	labelFilters := workloadLabelFilters(conf, workload.Labels)
	if len(labelFilters) > 0 {
		return buildEnvoyMetricLabels(conf, workload.Namespace, labelFilters)
	}

	return ""
}

func workloadLabelFilters(conf *config.Config, labels map[string]string) map[string]string {
	filters := make(map[string]string)
	appLabelName, ok := conf.GetAppLabelName(labels)
	if ok {
		filters[appLabelName] = labels[appLabelName]
	}
	versionLabelName, ok := conf.GetVersionLabelName(labels)
	if ok {
		filters[versionLabelName] = labels[versionLabelName]
	}
	if len(filters) > 0 {
		return filters
	}

	return envoyProxyWorkloadLabelFilters(labels)
}

func envoyProxyWorkloadLabelFilters(labels map[string]string) map[string]string {
	filters := make(map[string]string)
	for _, key := range []string{
		config.GatewayLabel,
		"gateway.istio.io/managed",
		"gateway.networking.k8s.io/gateway-class-name",
		config.IstioServiceCanonicalName,
		"istio",
		"istio.io/gateway-name",
	} {
		if value, ok := labels[key]; ok && value != "" {
			filters[key] = value
		}
	}

	return filters
}

func buildEnvoyMetricLabels(conf *config.Config, namespace string, labelsFilters map[string]string) string {
	namespaceLabel := conf.ExternalServices.CustomDashboards.NamespaceLabel
	if namespaceLabel == "" {
		namespaceLabel = "namespace"
	}

	var b strings.Builder
	fmt.Fprintf(&b, `{%s="%s"`, namespaceLabel, namespace)

	keys := make([]string, 0, len(labelsFilters))
	for key := range labelsFilters {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		fmt.Fprintf(&b, `,%s="%s"`, prometheus.SanitizeLabelName(key), escapePromLabelValue(labelsFilters[key]))
	}

	keys = keys[:0]
	for labelName := range conf.ExternalServices.Prometheus.QueryScope {
		keys = append(keys, labelName)
	}
	sort.Strings(keys)
	for _, labelName := range keys {
		fmt.Fprintf(&b, `,%s="%s"`, prometheus.SanitizeLabelName(labelName), escapePromLabelValue(conf.ExternalServices.Prometheus.QueryScope[labelName]))
	}

	b.WriteByte('}')
	return b.String()
}

// buildIstioWorkloadLabels builds a Prometheus selector using Istio-intrinsic
// workload labels.  prefix must be "source" or "destination".
func buildIstioWorkloadLabels(namespace, workloadName, prefix string, conf *config.Config) string {
	lb := NewMetricsLabelsBuilder(istioMetricLabelPrefixToDirection(prefix), conf)
	lb.Workload(workloadName, namespace).QueryScope()
	return lb.Build()
}

func maxLatestValue(metric prometheus.Metric) float64 {
	max := 0.0
	for _, stream := range metric.Matrix {
		if len(stream.Values) == 0 {
			continue
		}
		value := float64(stream.Values[len(stream.Values)-1].Value)
		if value > max {
			max = value
		}
	}
	return max
}

func sumLatestValues(metric prometheus.Metric) float64 {
	sum := 0.0
	for _, stream := range metric.Matrix {
		if len(stream.Values) == 0 {
			continue
		}
		sum += float64(stream.Values[len(stream.Values)-1].Value)
	}
	return sum
}

func sumEnvoyRequestRate(upstream, downstream prometheus.Metric) float64 {
	return sumLatestValues(upstream) + sumLatestValues(downstream)
}

func envoyRequestRateFromMetrics(upstreamTotal, upstream, downstream prometheus.Metric) float64 {
	rate := sumEnvoyRequestRate(upstreamTotal, downstream)
	if rate == 0 {
		rate = sumEnvoyRequestRate(upstream, downstream)
	}

	return rate
}

func maxRequestRate(candidates ...float64) float64 {
	max := 0.0
	for _, candidate := range candidates {
		if candidate > max {
			max = candidate
		}
	}
	return max
}

func sumEnvoyActiveConnections(upstream, downstream prometheus.Metric) int64 {
	return int64(sumLatestValues(upstream) + sumLatestValues(downstream))
}

func fetchEnvoyDownstreamRequestRate(ctx context.Context, prom prometheus.ClientInterface, labels string, q *prometheus.RangeQuery) prometheus.Metric {
	for _, metricName := range []string{
		"envoy_listener_http_downstream_rq",
		"envoy_listener_http_downstream_rq_total",
	} {
		metric := prom.FetchRateRange(ctx, metricName, []string{labels}, "", q)
		if len(metric.Matrix) > 0 {
			return metric
		}
	}
	return prometheus.Metric{}
}
