package business

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/common/model"
	"k8s.io/apimachinery/pkg/api/resource"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

const (
	sidecarHighMemoryBytes = 100 * 1024 * 1024
	gatewayHighMemoryBytes = 256 * 1024 * 1024
	// Bookinfo alone can approach ~50 clusters without scoping; keep headroom for small meshes.
	sidecarLargeConfigClusters = 100
	gatewayLargeConfigClusters = 150
	envoyMemoryLimitRatio      = 0.7
	idleRequestRatePerSecond   = 0.1
	idleActiveConnections      = 5
	// Waypoints expose L4 byte rates; treat below this as idle for classification.
	idleTCPBytesPerSecond = 100.0
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

	envoyLabels := buildWorkloadPodNamesSelector(in.conf, workload)
	if envoyLabels == "" {
		return nil, fmt.Errorf("workload has no pods with an Envoy proxy")
	}

	// Istio telemetry must use intrinsic workload labels (source_workload /
	// destination_workload); scrape labels are stripped in federated Prometheus.
	istioSourceLabels := buildIstioWorkloadLabels(workload.Namespace, workload.Name, "source", in.conf)
	istioDestLabels := buildIstioWorkloadLabels(workload.Namespace, workload.Name, "destination", in.conf)
	istioRequestLabels := []string{
		appendPromLabelMatchers(istioSourceLabels, nil, map[string]string{"reporter": "source|waypoint"}),
		appendPromLabels(istioDestLabels, map[string]string{"reporter": "destination"}),
	}

	var (
		memoryMetric    prometheus.Metric
		clustersMetric  prometheus.Metric
		upstreamRqTotal prometheus.Metric
		upstreamRq      prometheus.Metric
		downstreamRq    prometheus.Metric
		istioRq         prometheus.Metric
		tcpOpened       prometheus.Metric
		tcpClosed       prometheus.Metric
		tcpByteRate     float64
		memoryLimit     float64
	)

	var wg sync.WaitGroup
	wg.Add(10)
	go func() {
		defer wg.Done()
		memoryMetric = in.prom.FetchRange(ctx, "envoy_server_memory_allocated", envoyLabels, "", "", q)
	}()
	go func() {
		defer wg.Done()
		clustersMetric = in.prom.FetchRange(ctx, "envoy_cluster_manager_active_clusters", envoyLabels, "", "", q)
	}()
	go func() {
		defer wg.Done()
		upstreamRqTotal = in.prom.FetchRateRange(ctx, "envoy_cluster_upstream_rq_total", []string{envoyLabels}, "", q)
	}()
	go func() {
		defer wg.Done()
		// Some Istio versions export upstream_rq without the _total suffix.
		upstreamRq = in.prom.FetchRateRange(ctx, "envoy_cluster_upstream_rq", []string{envoyLabels}, "", q)
	}()
	go func() {
		defer wg.Done()
		// Downstream listener stats are often absent on waypoints and newer gateways.
		downstreamRq = fetchEnvoyDownstreamRequestRate(ctx, in.prom, envoyLabels, q)
	}()
	go func() {
		defer wg.Done()
		istioRq = in.prom.FetchRateRange(ctx, "istio_requests_total", istioRequestLabels, "", q)
	}()
	go func() {
		defer wg.Done()
		// Prefer Istio TCP connection counters: Envoy cx gauges are often disabled / stuck at 1.
		tcpOpened = fetchIstioTCPConnections(ctx, in.prom, "istio_tcp_connections_opened_total", istioSourceLabels, istioDestLabels, q)
	}()
	go func() {
		defer wg.Done()
		tcpClosed = fetchIstioTCPConnections(ctx, in.prom, "istio_tcp_connections_closed_total", istioSourceLabels, istioDestLabels, q)
	}()
	go func() {
		defer wg.Done()
		tcpByteRate = fetchIstioTCPByteRate(ctx, in.prom, istioSourceLabels, istioDestLabels, q)
	}()
	go func() {
		defer wg.Done()
		memoryLimit = resolveEnvoyProxyMemoryLimit(ctx, in.prom, workload, envoyLabels, q.End)
	}()
	wg.Wait()

	memoryMax := maxLatestValue(memoryMetric)
	activeClustersMax := int64(maxLatestValue(clustersMetric))
	activeConnections := activeTCPConnections(tcpOpened, tcpClosed)

	proxyType := envoyProxyType(workload)
	envoyRequestRate := envoyRequestRateFromMetrics(upstreamRqTotal, upstreamRq, downstreamRq)
	httpRequestRate := maxRequestRate(envoyRequestRate, sumLatestValues(istioRq))
	// Use TCP byte rate for waypoints, or when HTTP request rate is absent and TCP bytes are present.
	trafficIsByteRate := proxyType == models.EnvoyProxyTypeWaypoint || (httpRequestRate == 0 && tcpByteRate > 0)
	requestRate := httpRequestRate
	if trafficIsByteRate {
		requestRate = tcpByteRate
	}

	absoluteThreshold, largeConfigClusters := envoyMemoryAbsoluteThresholds(proxyType)
	memoryThreshold := computeEnvoyMemoryThreshold(absoluteThreshold, memoryLimit)
	cause := classifyEnvoyMemory(memoryThreshold, largeConfigClusters, memoryMax, activeClustersMax, activeConnections, requestRate, trafficIsByteRate)

	var memoryUsedPercent float64
	if memoryLimit > 0 {
		memoryUsedPercent = (memoryMax / memoryLimit) * 100
	}

	return &models.EnvoyMemorySummary{
		ActiveClustersMax:            activeClustersMax,
		ActiveConnections:            activeConnections,
		Cause:                        cause,
		ConfigCountsPod:              podWithMaxLatestMemory(memoryMetric),
		LargeConfigClustersThreshold: largeConfigClusters,
		MemoryLimitBytes:             int64(memoryLimit),
		MemoryMaxBytes:               int64(memoryMax),
		MemoryThresholdBytes:         int64(memoryThreshold),
		MemoryUsedPercent:            memoryUsedPercent,
		ProxyType:                    proxyType,
		RequestRate:                  requestRate,
		RoughConfigMemoryBytes:       activeClustersMax * roughConfigBytesPerCluster,
		TrafficIsByteRate:            trafficIsByteRate,
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

func classifyEnvoyMemory(memoryThreshold float64, largeConfigThreshold int64, memoryBytes float64, activeClusters int64, activeConnections int64, trafficRate float64, trafficIsByteRate bool) models.EnvoyMemoryCause {
	if memoryBytes <= memoryThreshold {
		return models.EnvoyMemoryCauseOK
	}

	idleTraffic := trafficRate < idleRequestRatePerSecond
	if trafficIsByteRate {
		idleTraffic = trafficRate < idleTCPBytesPerSecond
	}
	idle := idleTraffic && activeConnections < idleActiveConnections
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
// Prefers pod-name selectors when pods are known so sibling gateway/waypoint pods
// that share app or gateway labels are not included.
func BuildWorkloadMetricLabels(conf *config.Config, workload *models.Workload) string {
	if podLabels := buildWorkloadPodNamesSelector(conf, workload); podLabels != "" {
		return podLabels
	}

	labelFilters := workloadLabelFilters(conf, workload.Labels)
	if len(labelFilters) > 0 {
		return buildEnvoyMetricLabels(conf, workload.Namespace, labelFilters)
	}

	return ""
}

func buildWorkloadPodNamesSelector(conf *config.Config, workload *models.Workload) string {
	if workload == nil {
		return ""
	}

	podNames := make([]string, 0, len(workload.Pods))
	for _, pod := range workload.Pods {
		if pod == nil || pod.Name == "" {
			continue
		}
		podNames = append(podNames, escapePromLabelValue(pod.Name))
	}
	if len(podNames) == 0 {
		return ""
	}
	sort.Strings(podNames)

	namespaceLabel := conf.ExternalServices.CustomDashboards.NamespaceLabel
	if namespaceLabel == "" {
		namespaceLabel = "namespace"
	}

	var b strings.Builder
	fmt.Fprintf(&b, `{%s="%s"`, namespaceLabel, workload.Namespace)
	if len(podNames) == 1 {
		fmt.Fprintf(&b, `,pod="%s"`, podNames[0])
	} else {
		fmt.Fprintf(&b, `,pod=~"%s"`, strings.Join(podNames, "|"))
	}

	keys := make([]string, 0, len(conf.ExternalServices.Prometheus.QueryScope))
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

// podWithMaxLatestMemory returns the pod label for the series with the highest latest memory sample.
func podWithMaxLatestMemory(metric prometheus.Metric) string {
	bestPod := ""
	bestValue := 0.0
	for _, stream := range metric.Matrix {
		if len(stream.Values) == 0 {
			continue
		}
		value := float64(stream.Values[len(stream.Values)-1].Value)
		if value <= bestValue {
			continue
		}
		pod := string(stream.Metric[model.LabelName("pod")])
		if pod == "" {
			continue
		}
		bestValue = value
		bestPod = pod
	}
	return bestPod
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

func activeTCPConnections(opened, closed prometheus.Metric) int64 {
	active := sumLatestValues(opened) - sumLatestValues(closed)
	if active < 0 {
		return 0
	}
	return int64(active)
}

// fetchIstioTCPConnections loads a TCP counter for this workload as source or destination.
// Do not filter by reporter: Istio L4 telemetry reporter labels are inverted
// (https://github.com/istio/istio/issues/32399), so source_workload=waypoint often
// appears with reporter="destination".
func fetchIstioTCPConnections(
	ctx context.Context,
	prom prometheus.ClientInterface,
	metricName string,
	sourceLabels string,
	destLabels string,
	q *prometheus.RangeQuery,
) prometheus.Metric {
	source := prom.FetchRange(ctx, metricName, sourceLabels, "", "sum", q)
	dest := prom.FetchRange(ctx, metricName, destLabels, "", "sum", q)
	return prometheus.Metric{Matrix: append(source.Matrix, dest.Matrix...)}
}

// fetchIstioTCPByteRate returns combined TCP sent+received byte rate for this workload.
func fetchIstioTCPByteRate(
	ctx context.Context,
	prom prometheus.ClientInterface,
	sourceLabels string,
	destLabels string,
	q *prometheus.RangeQuery,
) float64 {
	labels := []string{sourceLabels, destLabels}
	sent := prom.FetchRateRange(ctx, "istio_tcp_sent_bytes_total", labels, "", q)
	received := prom.FetchRateRange(ctx, "istio_tcp_received_bytes_total", labels, "", q)
	return sumLatestValues(sent) + sumLatestValues(received)
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
