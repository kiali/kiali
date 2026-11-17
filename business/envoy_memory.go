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
	// Typical istio-proxy working set often exceeds 100 MiB with normal mesh config; keep modest headroom.
	sidecarHighMemoryBytes = 128 * 1024 * 1024
	gatewayHighMemoryBytes = 256 * 1024 * 1024
	// Bookinfo alone can approach ~50 clusters without scoping; keep headroom for small meshes.
	sidecarLargeConfigClusters = 100
	gatewayLargeConfigClusters = 150
	envoyMemoryLimitRatio      = 0.7
	// Cause heuristics aligned loosely with Istio sidecar benchmarks (~1000 req/s, 4 client conns).
	busyRequestRatePerSecond = 100.0
	busyActiveConnections    = 10
	busyTCPBytesPerSecond    = 256 * 1024
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
		allocatedMetric    prometheus.Metric
		clustersMetric     prometheus.Metric
		downstreamCxActive prometheus.Metric
		downstreamRq       prometheus.Metric
		istioHTTPDest      prometheus.Metric
		istioHTTPSource    prometheus.Metric
		memoryLimits       map[string]float64
		tcpClosed          prometheus.Metric
		tcpOpened          prometheus.Metric
		tcpRecvDest        prometheus.Metric
		tcpRecvSource      prometheus.Metric
		tcpSentDest        prometheus.Metric
		tcpSentSource      prometheus.Metric
		upstreamCxActive   prometheus.Metric
		upstreamRq         prometheus.Metric
		upstreamRqTotal    prometheus.Metric
		workingSetMetric   prometheus.Metric
	)

	var wg sync.WaitGroup
	wg.Add(17)
	go func() {
		defer wg.Done()
		allocatedMetric = in.prom.FetchRange(ctx, "envoy_server_memory_allocated", envoyLabels, "", "", q)
	}()
	go func() {
		defer wg.Done()
		// Working set is the most broadly available pressure signal for the istio-proxy cgroup.
		workingSetMetric = in.prom.FetchRange(ctx, "container_memory_working_set_bytes", appendEnvoyProxyContainerLabel(envoyLabels), "", "", q)
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
		istioHTTPSource = in.prom.FetchRateRange(ctx, "istio_requests_total", []string{istioRequestLabels[0]}, "", q)
	}()
	go func() {
		defer wg.Done()
		istioHTTPDest = in.prom.FetchRateRange(ctx, "istio_requests_total", []string{istioRequestLabels[1]}, "", q)
	}()
	go func() {
		defer wg.Done()
		tcpOpened = fetchIstioTCPConnections(ctx, in.prom, "istio_tcp_connections_opened_total", istioSourceLabels, istioDestLabels, q)
	}()
	go func() {
		defer wg.Done()
		tcpClosed = fetchIstioTCPConnections(ctx, in.prom, "istio_tcp_connections_closed_total", istioSourceLabels, istioDestLabels, q)
	}()
	go func() {
		defer wg.Done()
		upstreamCxActive = in.prom.FetchRange(ctx, "envoy_cluster_upstream_cx_active", envoyLabels, "", "", q)
	}()
	go func() {
		defer wg.Done()
		downstreamCxActive = in.prom.FetchRange(ctx, "envoy_listener_downstream_cx_active", envoyLabels, "", "", q)
	}()
	go func() {
		defer wg.Done()
		tcpSentSource = in.prom.FetchRateRange(ctx, "istio_tcp_sent_bytes_total", []string{istioSourceLabels}, "", q)
	}()
	go func() {
		defer wg.Done()
		tcpSentDest = in.prom.FetchRateRange(ctx, "istio_tcp_sent_bytes_total", []string{istioDestLabels}, "", q)
	}()
	go func() {
		defer wg.Done()
		tcpRecvSource = in.prom.FetchRateRange(ctx, "istio_tcp_received_bytes_total", []string{istioSourceLabels}, "", q)
	}()
	go func() {
		defer wg.Done()
		tcpRecvDest = in.prom.FetchRateRange(ctx, "istio_tcp_received_bytes_total", []string{istioDestLabels}, "", q)
	}()
	go func() {
		defer wg.Done()
		memoryLimits = resolveEnvoyProxyMemoryLimits(ctx, in.prom, workload, envoyLabels, q.End)
	}()
	wg.Wait()

	proxyType := envoyProxyType(workload)
	absoluteThreshold, largeConfigClusters := envoyMemoryAbsoluteThresholds(proxyType)
	memory := selectEnvoyStatusMemory(
		absoluteThreshold,
		allocatedMetric,
		workingSetMetric,
		memoryLimits,
	)
	statusAt := memory.PeakAt
	activeClustersMax, requestRate, trafficIsByteRate, activeConnections, connectionsObserved :=
		envoyMemoryStatusTrafficSignals(
			proxyType,
			statusAt,
			memory.Pod,
			clustersMetric,
			upstreamRqTotal,
			upstreamRq,
			downstreamRq,
			istioHTTPSource,
			istioHTTPDest,
			tcpSentSource,
			tcpSentDest,
			tcpRecvSource,
			tcpRecvDest,
			tcpOpened,
			tcpClosed,
			upstreamCxActive,
			downstreamCxActive,
		)

	cause := classifyEnvoyMemory(
		memory.ThresholdBytes,
		largeConfigClusters,
		memory.MaxBytes,
		activeClustersMax,
		activeConnections,
		requestRate,
		trafficIsByteRate,
		connectionsObserved,
	)

	var memoryUsedPercent float64
	if memory.LimitBytes > 0 {
		memoryUsedPercent = (memory.MaxBytes / memory.LimitBytes) * 100
	}

	return &models.EnvoyMemorySummary{
		ActiveClustersMax:            activeClustersMax,
		ActiveConnections:            activeConnections,
		ActiveConnectionsObserved:    connectionsObserved,
		Cause:                        cause,
		ConfigCountsPod:              memory.Pod,
		LargeConfigClustersThreshold: largeConfigClusters,
		MemoryLimitBytes:             int64(memory.LimitBytes),
		MemoryMaxBytes:               int64(memory.MaxBytes),
		MemoryMetric:                 memory.Metric,
		MemoryThresholdBytes:         int64(memory.ThresholdBytes),
		MemoryUsedPercent:            memoryUsedPercent,
		ProxyType:                    proxyType,
		RequestRate:                  requestRate,
		RoughConfigMemoryBytes:       activeClustersMax * roughConfigBytesPerCluster,
		TrafficIsByteRate:            trafficIsByteRate,
	}, nil
}

// HasEnvoyProxyWorkload returns true when the workload exposes Envoy memory diagnostics.
func HasEnvoyProxyWorkload(workload *models.Workload) bool {
	if workload == nil || workload.IsZtunnelWorkload() {
		return false
	}
	if workload.IsGatewayWorkload() || workload.IsWaypointWorkload() {
		return true
	}
	return workload.HasIstioSidecar()
}

func envoyProxyType(workload *models.Workload) models.EnvoyProxyType {
	if workload.IsGatewayWorkload() {
		return models.EnvoyProxyTypeGateway
	}
	if workload.IsWaypointWorkload() {
		return models.EnvoyProxyTypeWaypoint
	}
	return models.EnvoyProxyTypeSidecar
}

func classifyEnvoyMemory(
	memoryThreshold float64,
	largeConfigThreshold int64,
	memoryBytes float64,
	activeClusters int64,
	activeConnections int64,
	trafficRate float64,
	trafficIsByteRate bool,
	connectionsObserved bool,
) models.EnvoyMemoryCause {
	// Missing status memory samples (empty query), not elevated memory.
	if memoryBytes == 0 {
		return models.EnvoyMemoryCauseUnknown
	}
	if memoryBytes <= memoryThreshold {
		return models.EnvoyMemoryCauseOK
	}

	largeConfig := activeClusters > largeConfigThreshold
	busy := envoyMemoryBusyTraffic(
		activeConnections,
		connectionsObserved,
		trafficRate,
		trafficIsByteRate,
	)

	if largeConfig {
		if busy {
			return models.EnvoyMemoryCauseTraffic
		}
		return models.EnvoyMemoryCauseConfiguration
	}
	if busy {
		return models.EnvoyMemoryCauseTraffic
	}
	return models.EnvoyMemoryCauseUnknown
}

func envoyMemoryBusyTraffic(
	activeConnections int64,
	connectionsObserved bool,
	trafficRate float64,
	trafficIsByteRate bool,
) bool {
	if connectionsObserved && activeConnections >= busyActiveConnections {
		return true
	}
	if trafficIsByteRate {
		return trafficRate >= busyTCPBytesPerSecond
	}
	return trafficRate >= busyRequestRatePerSecond
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

type envoyMemorySelection struct {
	LimitBytes     float64
	MaxBytes       float64
	Metric         models.EnvoyMemoryMetric
	PeakAt         model.Time
	Pod            string
	ThresholdBytes float64
}

type podPeakSample struct {
	at    model.Time
	value float64
}

// selectEnvoyStatusMemory prefers the istio-proxy cgroup working set because it
// remains available when Istio filters Envoy stats. Envoy allocated memory is a
// fallback and uses the absolute threshold because it is not total cgroup usage.
func selectEnvoyStatusMemory(
	absoluteThreshold float64,
	allocatedMetric prometheus.Metric,
	workingSetMetric prometheus.Metric,
	memoryLimits map[string]float64,
) envoyMemorySelection {
	workingSetByPod := peakSamplesByPod(workingSetMetric)
	if len(workingSetByPod) > 0 {
		return selectHighestMemoryPressure(workingSetByPod, memoryLimits, absoluteThreshold, models.EnvoyMemoryMetricWorkingSet)
	}

	return selectHighestMemoryPressure(peakSamplesByPod(allocatedMetric), memoryLimits, absoluteThreshold, models.EnvoyMemoryMetricAllocated)
}

func selectHighestMemoryPressure(peaksByPod map[string]podPeakSample, memoryLimits map[string]float64, absoluteThreshold float64, metric models.EnvoyMemoryMetric) envoyMemorySelection {
	selection := envoyMemorySelection{Metric: metric, ThresholdBytes: absoluteThreshold}
	bestPressure := 0.0
	for pod, peak := range peaksByPod {
		limit := memoryLimits[pod]
		threshold := absoluteThreshold
		if metric == models.EnvoyMemoryMetricWorkingSet {
			threshold = computeEnvoyMemoryThreshold(absoluteThreshold, limit)
		}
		pressure := peak.value / threshold
		if pressure < bestPressure {
			continue
		}
		if pressure == bestPressure && peak.at < selection.PeakAt {
			continue
		}
		bestPressure = pressure
		selection = envoyMemorySelection{
			LimitBytes:     limit,
			MaxBytes:       peak.value,
			Metric:         metric,
			PeakAt:         peak.at,
			Pod:            pod,
			ThresholdBytes: threshold,
		}
	}
	return selection
}

func resolveEnvoyProxyMemoryLimits(ctx context.Context, prom prometheus.ClientInterface, workload *models.Workload, labels string, queryTime time.Time) map[string]float64 {
	limits := envoyProxyMemoryLimitsFromAnnotations(workload)
	if prom != nil && prom.API() != nil && labels != "" {
		query := fmt.Sprintf(`container_spec_memory_limit_bytes%s`, appendEnvoyProxyContainerLabel(labels))
		for pod, promLimit := range promInstantPodValues(ctx, prom, query, queryTime) {
			if promLimit > limits[pod] {
				limits[pod] = promLimit
			}
		}
	}

	return limits
}

func envoyProxyMemoryLimitsFromAnnotations(workload *models.Workload) map[string]float64 {
	limits := map[string]float64{}
	if workload == nil {
		return limits
	}

	for _, pod := range workload.Pods {
		if pod == nil || pod.Annotations == nil {
			continue
		}
		raw, ok := pod.Annotations[istioProxyMemoryLimitAnnotation]
		if !ok {
			continue
		}
		if bytes := parseMemoryQuantity(raw); bytes > limits[pod.Name] {
			limits[pod.Name] = bytes
		}
	}

	return limits
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

func promInstantPodValues(ctx context.Context, prom prometheus.ClientInterface, query string, queryTime time.Time) map[string]float64 {
	values := map[string]float64{}
	result, _, err := prom.API().Query(ctx, query, queryTime)
	if err != nil {
		return values
	}

	vector, ok := result.(model.Vector)
	if !ok {
		return values
	}

	for _, sample := range vector {
		pod := string(sample.Metric[model.LabelName("pod")])
		if pod == "" {
			continue
		}
		value := float64(sample.Value)
		if value > values[pod] {
			values[pod] = value
		}
	}

	return values
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

// peakSamplesByPod keeps the peak sample in the selected interval for each pod and its timestamp.
// This preserves short-lived pressure across an istio-proxy container restart.
func peakSamplesByPod(metric prometheus.Metric) map[string]podPeakSample {
	peaksByPod := map[string]podPeakSample{}
	for _, stream := range metric.Matrix {
		pod := string(stream.Metric[model.LabelName("pod")])
		for _, sample := range stream.Values {
			value := float64(sample.Value)
			peak := peaksByPod[pod]
			if value > peak.value || (value == peak.value && sample.Timestamp > peak.at) {
				peaksByPod[pod] = podPeakSample{at: sample.Timestamp, value: value}
			}
		}
	}
	return peaksByPod
}

// envoyMemoryStatusTrafficSignals derives cause inputs at the memory peak timestamp,
// falling back to latest samples when the peak time is unknown.
func envoyMemoryStatusTrafficSignals(
	proxyType models.EnvoyProxyType,
	at model.Time,
	statusPod string,
	clustersMetric prometheus.Metric,
	upstreamRqTotal, upstreamRq, downstreamRq prometheus.Metric,
	istioHTTPSource, istioHTTPDest prometheus.Metric,
	tcpSentSource, tcpSentDest, tcpRecvSource, tcpRecvDest prometheus.Metric,
	tcpOpened, tcpClosed, upstreamCxActive, downstreamCxActive prometheus.Metric,
) (activeClustersMax int64, requestRate float64, trafficIsByteRate bool, activeConnections int64, connectionsObserved bool) {
	readAt := at
	if readAt == 0 {
		readAt = latestSampleTime(
			clustersMetric,
			upstreamRqTotal,
			upstreamRq,
			downstreamRq,
			istioHTTPSource,
			istioHTTPDest,
			tcpOpened,
			tcpClosed,
			upstreamCxActive,
			downstreamCxActive,
		)
	}

	clusters := maxPodScalarAtTime(clustersMetric, statusPod, readAt)
	if clusters == 0 {
		clusters = maxScalarAtTime(clustersMetric, readAt)
	}
	activeClustersMax = int64(clusters)

	envoyRequestRate := envoyRequestRateFromMetricsAtTime(upstreamRqTotal, upstreamRq, downstreamRq, readAt)
	httpRequestRate := istioHTTPRequestRateAtTime(istioHTTPSource, istioHTTPDest, readAt)
	httpRequestRate = maxRequestRate(envoyRequestRate, httpRequestRate)
	tcpByteRate := istioTCPByteRateAtTime(tcpSentSource, tcpSentDest, tcpRecvSource, tcpRecvDest, readAt)
	trafficIsByteRate = proxyType == models.EnvoyProxyTypeWaypoint || (httpRequestRate == 0 && tcpByteRate > 0)
	requestRate = httpRequestRate
	if trafficIsByteRate {
		requestRate = tcpByteRate
	}

	activeConnections, connectionsObserved = resolveActiveConnectionsAtTime(
		tcpOpened,
		tcpClosed,
		upstreamCxActive,
		downstreamCxActive,
		httpRequestRate,
		trafficIsByteRate,
		readAt,
	)
	return activeClustersMax, requestRate, trafficIsByteRate, activeConnections, connectionsObserved
}

func latestSampleTime(metrics ...prometheus.Metric) model.Time {
	var latest model.Time
	for _, metric := range metrics {
		for _, stream := range metric.Matrix {
			if len(stream.Values) == 0 {
				continue
			}
			if ts := stream.Values[len(stream.Values)-1].Timestamp; ts > latest {
				latest = ts
			}
		}
	}
	return latest
}

func sampleValueAt(samples []model.SamplePair, at model.Time) (float64, bool) {
	if at == 0 {
		if len(samples) == 0 {
			return 0, false
		}
		return float64(samples[len(samples)-1].Value), true
	}
	for _, sample := range samples {
		if sample.Timestamp == at {
			return float64(sample.Value), true
		}
	}
	return 0, false
}

func maxScalarAtTime(metric prometheus.Metric, at model.Time) float64 {
	max := 0.0
	for _, stream := range metric.Matrix {
		value, ok := sampleValueAt(stream.Values, at)
		if !ok || value <= max {
			continue
		}
		max = value
	}
	return max
}

func maxPodScalarAtTime(metric prometheus.Metric, pod string, at model.Time) float64 {
	if pod == "" {
		return maxScalarAtTime(metric, at)
	}
	max := 0.0
	for _, stream := range metric.Matrix {
		if string(stream.Metric[model.LabelName("pod")]) != pod {
			continue
		}
		value, ok := sampleValueAt(stream.Values, at)
		if !ok || value <= max {
			continue
		}
		max = value
	}
	return max
}

func sumAtTime(metric prometheus.Metric, at model.Time) float64 {
	sum := 0.0
	found := false
	for _, stream := range metric.Matrix {
		value, ok := sampleValueAt(stream.Values, at)
		if !ok {
			continue
		}
		sum += value
		found = true
	}
	if !found {
		return 0
	}
	return sum
}

func envoyRequestRateFromMetricsAtTime(upstreamTotal, upstream, downstream prometheus.Metric, at model.Time) float64 {
	rate := sumEnvoyRequestRateAtTime(upstreamTotal, downstream, at)
	if rate == 0 {
		rate = sumEnvoyRequestRateAtTime(upstream, downstream, at)
	}
	return rate
}

func sumEnvoyRequestRateAtTime(upstream, downstream prometheus.Metric, at model.Time) float64 {
	return sumAtTime(upstream, at) + sumAtTime(downstream, at)
}

func istioHTTPRequestRateAtTime(source, dest prometheus.Metric, at model.Time) float64 {
	return maxRequestRate(sumAtTime(source, at), sumAtTime(dest, at))
}

func istioTCPByteRateAtTime(sentSource, sentDest, recvSource, recvDest prometheus.Metric, at model.Time) float64 {
	sent := maxRequestRate(sumAtTime(sentSource, at), sumAtTime(sentDest, at))
	received := maxRequestRate(sumAtTime(recvSource, at), sumAtTime(recvDest, at))
	return sent + received
}

func activeTCPConnectionsAtTime(opened, closed prometheus.Metric, at model.Time) int64 {
	active := sumAtTime(opened, at) - sumAtTime(closed, at)
	if active < 0 {
		return 0
	}
	return int64(active)
}

func envoyActiveConnectionsAtTime(upstreamCx, downstreamCx prometheus.Metric, at model.Time) int64 {
	return int64(sumAtTime(upstreamCx, at) + sumAtTime(downstreamCx, at))
}

func resolveActiveConnectionsAtTime(
	tcpOpened, tcpClosed, upstreamCx, downstreamCx prometheus.Metric,
	httpRequestRate float64,
	trafficIsByteRate bool,
	at model.Time,
) (active int64, observed bool) {
	tcpObserved := istioTCPConnectionMetricsPresent(tcpOpened, tcpClosed)
	tcpActive := activeTCPConnectionsAtTime(tcpOpened, tcpClosed, at)
	envoyObserved := envoyConnectionMetricsPresent(upstreamCx, downstreamCx)
	envoyActive := envoyActiveConnectionsAtTime(upstreamCx, downstreamCx, at)
	httpTraffic := !trafficIsByteRate && httpRequestRate >= busyRequestRatePerSecond

	if tcpObserved && tcpActive > 0 {
		return tcpActive, true
	}
	if httpTraffic && envoyObserved && envoyActive > 0 {
		return envoyActive, true
	}
	if tcpObserved {
		return tcpActive, true
	}
	if envoyObserved {
		return envoyActive, true
	}
	return 0, false
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

func istioTCPConnectionMetricsPresent(opened, closed prometheus.Metric) bool {
	return len(opened.Matrix) > 0 || len(closed.Matrix) > 0
}

func envoyActiveConnections(upstreamCx, downstreamCx prometheus.Metric) int64 {
	return int64(sumLatestValues(upstreamCx) + sumLatestValues(downstreamCx))
}

func envoyConnectionMetricsPresent(upstreamCx, downstreamCx prometheus.Metric) bool {
	return len(upstreamCx.Matrix) > 0 || len(downstreamCx.Matrix) > 0
}

// resolveActiveConnections prefers Istio TCP opened/closed deltas for L4 workloads.
// HTTP sidecars often report net zero on those counters while Envoy cx gauges still reflect load.
func resolveActiveConnections(
	tcpOpened, tcpClosed, upstreamCx, downstreamCx prometheus.Metric,
	httpRequestRate float64,
	trafficIsByteRate bool,
) (active int64, observed bool) {
	tcpObserved := istioTCPConnectionMetricsPresent(tcpOpened, tcpClosed)
	tcpActive := activeTCPConnections(tcpOpened, tcpClosed)
	envoyObserved := envoyConnectionMetricsPresent(upstreamCx, downstreamCx)
	envoyActive := envoyActiveConnections(upstreamCx, downstreamCx)
	httpTraffic := !trafficIsByteRate && httpRequestRate >= busyRequestRatePerSecond

	if tcpObserved && tcpActive > 0 {
		return tcpActive, true
	}
	if httpTraffic && envoyObserved && envoyActive > 0 {
		return envoyActive, true
	}
	if tcpObserved {
		return tcpActive, true
	}
	if envoyObserved {
		return envoyActive, true
	}
	return 0, false
}

// fetchIstioHTTPRequestRate returns the HTTP request rate for this workload using Istio
// telemetry. Source and destination reporters are queried separately because PromQL OR on
// two scalar sums with empty metric labels retains only one operand.
func fetchIstioHTTPRequestRate(
	ctx context.Context,
	prom prometheus.ClientInterface,
	sourceLabels string,
	destLabels string,
	q *prometheus.RangeQuery,
) float64 {
	source := prom.FetchRateRange(ctx, "istio_requests_total", []string{sourceLabels}, "", q)
	dest := prom.FetchRateRange(ctx, "istio_requests_total", []string{destLabels}, "", q)
	return maxRequestRate(sumLatestValues(source), sumLatestValues(dest))
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
	sentSource := prom.FetchRateRange(ctx, "istio_tcp_sent_bytes_total", []string{sourceLabels}, "", q)
	sentDest := prom.FetchRateRange(ctx, "istio_tcp_sent_bytes_total", []string{destLabels}, "", q)
	recvSource := prom.FetchRateRange(ctx, "istio_tcp_received_bytes_total", []string{sourceLabels}, "", q)
	recvDest := prom.FetchRateRange(ctx, "istio_tcp_received_bytes_total", []string{destLabels}, "", q)
	return istioTCPByteRateAtTime(sentSource, sentDest, recvSource, recvDest, 0)
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
