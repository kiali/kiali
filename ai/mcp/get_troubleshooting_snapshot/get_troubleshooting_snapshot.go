package get_troubleshooting_snapshot

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"time"

	core_v1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/ai/mcp/get_mesh_traffic_graph"
	"github.com/kiali/kiali/ai/mcp/get_metrics"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	graphApi "github.com/kiali/kiali/graph/api"
	"github.com/kiali/kiali/models"
	jaegerModel "github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

const (
	defaultSnapshotSeconds     = 900
	defaultMaxEnvoyConfigDumps = 1
	defaultMaxLogPods          = 3
	defaultTailLines           = 100
	defaultTraceLimit          = 20
	maxLogFetchBytes           = int64(256 * 1024)
	maxMaxEnvoyConfigDumps     = 10
	maxMaxLogPods              = 20
	maxSnapshotDurationSeconds = 24 * 60 * 60
)

func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (TroubleshootingSnapshotResponse, string, int) {
	parsed, errMsg, code := parseArgs(args, kialiInterface)
	if code != http.StatusOK {
		return TroubleshootingSnapshotResponse{}, errMsg, code
	}
	if errMsg, code := validateNamespaceAccess(kialiInterface, parsed); code != http.StatusOK {
		return TroubleshootingSnapshotResponse{}, errMsg, code
	}

	workloads, target, resolveErrMsg, resolveCode := resolveTarget(kialiInterface, parsed)
	if resolveCode != http.StatusOK {
		return TroubleshootingSnapshotResponse{}, resolveErrMsg, resolveCode
	}

	response := TroubleshootingSnapshotResponse{
		Query: parsed,
		Target: TargetSummary{
			Cluster:   parsed.ClusterName,
			Kind:      target.Kind,
			Name:      target.Name,
			Namespace: parsed.Namespace,
			Workloads: target.Workloads,
		},
		Sources: map[string]SourceStatus{},
	}

	collectMetrics(kialiInterface, parsed, &response)
	collectGraph(kialiInterface, parsed, &response)
	collectTraces(kialiInterface, parsed, workloads, &response)
	collectLogs(kialiInterface, parsed, workloads, &response)
	collectEnvoyConfigDumps(kialiInterface, parsed, workloads, &response)

	return response, "", http.StatusOK
}

func parseArgs(args map[string]interface{}, kialiInterface *mcputil.KialiInterface) (TroubleshootingSnapshotArgs, string, int) {
	parsed := TroubleshootingSnapshotArgs{}
	if kialiInterface == nil || kialiInterface.Conf == nil {
		return parsed, "Kiali interface is not available", http.StatusInternalServerError
	}

	parsed.Namespace = mcputil.GetStringArg(args, "namespace", "ns")
	parsed.WorkloadName = mcputil.GetStringArg(args, "workloadName", "workload_name", "workload")
	parsed.ServiceName = mcputil.GetStringArg(args, "serviceName", "service_name", "service")
	parsed.ClusterName = mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName", "cluster_name", "cluster")
	parsed.GraphType = mcputil.GetStringOrDefault(args, "versionedApp", "graphType", "graph_type")
	parsed.Direction = mcputil.GetStringOrDefault(args, "outbound", "direction")
	parsed.Reporter = mcputil.GetStringOrDefault(args, "source", "reporter")
	parsed.Since = mcputil.GetStringArg(args, "since", "startTime", "start_time")
	parsed.To = mcputil.GetStringArg(args, "to", "endTime", "end_time")
	var errMsg string
	var code int
	parsed.DurationSeconds, errMsg, code = parsePositiveIntArg(args, defaultSnapshotSeconds, maxSnapshotDurationSeconds, "durationSeconds", "duration_seconds")
	if code != http.StatusOK {
		return parsed, errMsg, code
	}
	parsed.IncludeLogs = mcputil.AsBoolOrDefault(args, true, "includeLogs", "include_logs")
	parsed.IncludeMetrics = mcputil.AsBoolOrDefault(args, true, "includeMetrics", "include_metrics")
	parsed.IncludeTraces = mcputil.AsBoolOrDefault(args, true, "includeTraces", "include_traces")
	parsed.IncludeGraph = mcputil.AsBoolOrDefault(args, true, "includeGraph", "include_graph")
	parsed.IncludeEnvoyConfigDump = mcputil.AsBoolOrDefault(args, true, "includeEnvoyConfigDump", "include_envoy_config_dump")
	parsed.MaxLogPods, errMsg, code = parsePositiveIntArg(args, defaultMaxLogPods, maxMaxLogPods, "maxLogPods", "max_log_pods")
	if code != http.StatusOK {
		return parsed, errMsg, code
	}
	parsed.MaxEnvoyConfigDumps, errMsg, code = parsePositiveIntArg(args, defaultMaxEnvoyConfigDumps, maxMaxEnvoyConfigDumps, "maxEnvoyConfigDumps", "max_envoy_config_dumps")
	if code != http.StatusOK {
		return parsed, errMsg, code
	}

	if parsed.Namespace == "" {
		return parsed, "namespace is required", http.StatusBadRequest
	}
	if parsed.WorkloadName == "" && parsed.ServiceName == "" {
		return parsed, "workloadName or serviceName is required", http.StatusBadRequest
	}
	if parsed.WorkloadName != "" && parsed.ServiceName != "" {
		return parsed, "provide either workloadName or serviceName, not both", http.StatusBadRequest
	}
	if (parsed.Since == "") != (parsed.To == "") {
		return parsed, "provide both since and to, or omit them to use durationSeconds ending now", http.StatusBadRequest
	}
	if parsed.Since != "" && parsed.To != "" && argsContainAny(args, "durationSeconds", "duration_seconds") {
		return parsed, "provide either since/to or durationSeconds, not both", http.StatusBadRequest
	}
	if parsed.Direction != "inbound" && parsed.Direction != "outbound" {
		return parsed, "direction must be inbound or outbound", http.StatusBadRequest
	}
	if err := models.ValidateReporter(parsed.Reporter); err != nil {
		return parsed, err.Error(), http.StatusBadRequest
	}
	switch parsed.GraphType {
	case graph.GraphTypeApp, graph.GraphTypeService, graph.GraphTypeVersionedApp, graph.GraphTypeWorkload:
	default:
		return parsed, "graphType must be one of app, service, versionedApp, workload", http.StatusBadRequest
	}

	now := time.Now().UTC()
	if parsed.Since != "" && parsed.To != "" {
		start, startErr := time.Parse(time.RFC3339, parsed.Since)
		if startErr != nil {
			return parsed, "invalid since timestamp: expected RFC3339", http.StatusBadRequest
		}
		end, endErr := time.Parse(time.RFC3339, parsed.To)
		if endErr != nil {
			return parsed, "invalid to timestamp: expected RFC3339", http.StatusBadRequest
		}
		if !end.After(start) {
			return parsed, "to must be later than since", http.StatusBadRequest
		}
		if end.Sub(start) > time.Duration(maxSnapshotDurationSeconds)*time.Second {
			return parsed, fmt.Sprintf("the since/to window must not exceed %d seconds", maxSnapshotDurationSeconds), http.StatusBadRequest
		}
		parsed.SinceTime = start
		parsed.ToTime = end
	} else {
		parsed.ToTime = now
		parsed.SinceTime = now.Add(-time.Duration(parsed.DurationSeconds) * time.Second)
		parsed.Since = parsed.SinceTime.Format(time.RFC3339)
		parsed.To = parsed.ToTime.Format(time.RFC3339)
	}

	return parsed, "", http.StatusOK
}

func parsePositiveIntArg(args map[string]interface{}, defaultValue, maxValue int, keys ...string) (int, string, int) {
	label := keys[0]
	for _, key := range keys {
		if val, ok := args[key]; ok {
			parsed := mcputil.AsInt(val)
			if parsed <= 0 {
				return 0, fmt.Sprintf("%s must be greater than zero", label), http.StatusBadRequest
			}
			if parsed > maxValue {
				return 0, fmt.Sprintf("%s must not exceed %d", label, maxValue), http.StatusBadRequest
			}
			return parsed, "", http.StatusOK
		}
	}
	return defaultValue, "", http.StatusOK
}

func argsContainAny(args map[string]interface{}, names ...string) bool {
	for _, name := range names {
		if _, ok := args[name]; ok {
			return true
		}
	}
	return false
}

func validateNamespaceAccess(kialiInterface *mcputil.KialiInterface, args TroubleshootingSnapshotArgs) (string, int) {
	_, err := kialiInterface.BusinessLayer.Namespace.GetClusterNamespace(kialiInterface.Request.Context(), args.Namespace, args.ClusterName)
	if err == nil {
		return "", http.StatusOK
	}
	if k8serrors.IsNotFound(err) || k8serrors.IsForbidden(err) || k8serrors.IsUnauthorized(err) || business.IsAccessibleError(err) {
		return fmt.Sprintf("Namespace %q is not accessible in cluster %q.", args.Namespace, args.ClusterName), http.StatusForbidden
	}
	return fmt.Sprintf("failed to validate namespace %q in cluster %q: %v", args.Namespace, args.ClusterName, err), http.StatusInternalServerError
}

func resolveTarget(kialiInterface *mcputil.KialiInterface, args TroubleshootingSnapshotArgs) ([]*models.Workload, TargetSummary, string, int) {
	ctx := kialiInterface.Request.Context()
	if args.ServiceName != "" {
		svc, err := kialiInterface.BusinessLayer.Svc.GetService(ctx, args.ClusterName, args.Namespace, args.ServiceName)
		if err != nil {
			errMsg, code := resourceError("service", args.Namespace, args.ServiceName, err)
			return nil, TargetSummary{}, errMsg, code
		}

		rateInterval := args.ToTime.Sub(args.SinceTime).String()
		workloads := make([]*models.Workload, 0)
		labelSelector := labels.Set(svc.Selectors).String()
		if labelSelector != "" {
			namespaceWorkloads, listErr := kialiInterface.BusinessLayer.Workload.GetNamespaceWorkloads(ctx, args.ClusterName, args.Namespace, labelSelector)
			if listErr == nil {
				workloads = make([]*models.Workload, 0, len(namespaceWorkloads))
				for _, workload := range namespaceWorkloads {
					if workload == nil || workload.Name == "" {
						continue
					}
					fullWorkload, workloadErr := kialiInterface.BusinessLayer.Workload.GetWorkload(ctx, business.WorkloadCriteria{
						Cluster:      args.ClusterName,
						Namespace:    args.Namespace,
						WorkloadName: workload.Name,
						QueryTime:    args.ToTime,
						RateInterval: rateInterval,
					})
					if workloadErr == nil {
						workloads = append(workloads, fullWorkload)
					}
				}
			}
		}

		names := make([]string, 0, len(workloads))
		for _, workload := range workloads {
			names = append(names, workload.Name)
		}
		return workloads, TargetSummary{Kind: "service", Name: args.ServiceName, Workloads: names}, "", http.StatusOK
	}

	workload, err := kialiInterface.BusinessLayer.Workload.GetWorkload(ctx, business.WorkloadCriteria{
		Cluster:      args.ClusterName,
		Namespace:    args.Namespace,
		WorkloadName: args.WorkloadName,
		QueryTime:    args.ToTime,
		RateInterval: args.ToTime.Sub(args.SinceTime).String(),
	})
	if err != nil {
		errMsg, code := resourceError("workload", args.Namespace, args.WorkloadName, err)
		return nil, TargetSummary{}, errMsg, code
	}
	return []*models.Workload{workload}, TargetSummary{Kind: "workload", Name: workload.Name, Workloads: []string{workload.Name}}, "", http.StatusOK
}

func resourceError(kind, namespace, name string, err error) (string, int) {
	message := fmt.Sprintf("failed to get %s %q in namespace %q: %v", kind, name, namespace, err)
	if k8serrors.IsNotFound(err) {
		return message, http.StatusNotFound
	}
	return message, http.StatusInternalServerError
}

func collectMetrics(kialiInterface *mcputil.KialiInterface, args TroubleshootingSnapshotArgs, response *TroubleshootingSnapshotResponse) {
	status := SourceStatus{Enabled: kialiInterface.Conf.ExternalServices.Prometheus.Enabled, Included: false}
	if !args.IncludeMetrics {
		status.Reason = "disabled by request"
	} else if !status.Enabled {
		status.Reason = "Prometheus is disabled"
	} else {
		query := models.IstioMetricsQuery{
			Cluster:   args.ClusterName,
			Direction: args.Direction,
			Namespace: args.Namespace,
			Reporter:  args.Reporter,
		}
		if args.ServiceName != "" {
			query.Service = args.ServiceName
		} else {
			query.Workload = args.WorkloadName
		}
		query.FillDefaults()
		query.Start = args.SinceTime
		query.End = args.ToTime
		query.Step = time.Duration(defaultStepSeconds(args)) * time.Second
		query.RateInterval = defaultRateInterval(args)
		query.Quantiles = []string{"0.5", "0.95", "0.99", "0.999"}
		query.Avg = true

		metrics, err := business.NewMetricsService(kialiInterface.Prom, kialiInterface.Conf).GetMetrics(kialiInterface.Request.Context(), query, nil)
		if err != nil {
			setError(response, "metrics", err)
			status.Reason = "metrics request failed"
		} else {
			resourceType := "workload"
			resourceName := args.WorkloadName
			if args.ServiceName != "" {
				resourceType = "service"
				resourceName = args.ServiceName
			}
			summary := get_metrics.SummarizeMetricsForLLM(metrics, resourceType, args.Namespace, resourceName, &query)
			response.Metrics = &summary
			status.Included = true
		}
	}
	response.Sources["metrics"] = status
}

func collectGraph(kialiInterface *mcputil.KialiInterface, args TroubleshootingSnapshotArgs, response *TroubleshootingSnapshotResponse) {
	status := SourceStatus{Enabled: kialiInterface.Conf.ExternalServices.Prometheus.Enabled, Included: false}
	if !args.IncludeGraph {
		status.Reason = "disabled by request"
	} else if !status.Enabled {
		status.Reason = "Prometheus is disabled"
	} else {
		graphRequest, _ := http.NewRequestWithContext(kialiInterface.Request.Context(), http.MethodGet, "/internal/troubleshooting/graph", nil)
		query := graphRequest.URL.Query()
		query.Set("clusterName", args.ClusterName)
		query.Set("duration", args.ToTime.Sub(args.SinceTime).String())
		query.Set("graphType", args.GraphType)
		query.Set("namespaces", args.Namespace)
		query.Set("queryTime", strconv.FormatInt(args.ToTime.Unix(), 10))
		graphRequest.URL.RawQuery = query.Encode()

		code, payload, _ := graphApi.GraphNamespaces(
			kialiInterface.Request.Context(),
			kialiInterface.BusinessLayer,
			kialiInterface.Prom,
			graph.NewOptions(graphRequest, kialiInterface.BusinessLayer, kialiInterface.Conf),
		)
		if code != http.StatusOK {
			setError(response, "graph", fmt.Errorf("%v", payload))
			status.Reason = "graph request failed"
		} else {
			raw, err := json.Marshal(payload)
			if err != nil {
				setError(response, "graph", err)
				status.Reason = "graph response encoding failed"
			} else {
				graph := get_mesh_traffic_graph.TransformGraph(raw, args.GraphType, []string{args.Namespace}, nil, nil)
				response.Graph = &graph
				status.Included = true
			}
		}
	}
	response.Sources["graph"] = status
}

func collectTraces(kialiInterface *mcputil.KialiInterface, args TroubleshootingSnapshotArgs, workloads []*models.Workload, response *TroubleshootingSnapshotResponse) {
	status := SourceStatus{Enabled: kialiInterface.Conf.ExternalServices.Tracing.Enabled, Included: false}
	if !args.IncludeTraces {
		status.Reason = "disabled by request"
	} else if !status.Enabled {
		status.Reason = "tracing is disabled"
	} else {
		traceQuery := models.TracingQuery{
			Start:   args.SinceTime,
			End:     args.ToTime,
			Limit:   defaultTraceLimit,
			Cluster: args.ClusterName,
			Tags:    map[string]string{},
		}
		for key, value := range kialiInterface.Conf.ExternalServices.Tracing.QueryScope {
			traceQuery.Tags[key] = value
		}
		traceQuery.Tags[models.IstioClusterTag] = args.ClusterName

		traces, err := fetchSnapshotTraces(kialiInterface.Request.Context(), &kialiInterface.BusinessLayer.Tracing, args, traceQuery)
		if err != nil {
			setError(response, "traces", err)
			status.Reason = "trace request failed"
		} else {
			response.Traces = &traces
			status.Included = true
		}
	}
	response.Sources["traces"] = status
}

func collectLogs(kialiInterface *mcputil.KialiInterface, args TroubleshootingSnapshotArgs, workloads []*models.Workload, response *TroubleshootingSnapshotResponse) {
	status := SourceStatus{Enabled: !config.IsFeatureDisabled(config.FeatureLogView), Included: false}
	if !args.IncludeLogs {
		status.Reason = "disabled by request"
	} else if !status.Enabled {
		status.Reason = "Pod Logs access is disabled"
	} else {
		podCount := 0
		for _, workload := range workloads {
			if workload == nil {
				continue
			}
			for _, pod := range workload.Pods {
				if pod == nil || pod.Name == "" || podCount >= args.MaxLogPods {
					continue
				}
				item := PodLogSource{
					Cluster:   args.ClusterName,
					Kind:      "pod",
					Name:      pod.Name,
					Namespace: args.Namespace,
				}
				logs, err := fetchPodLogs(kialiInterface.Request.Context(), kialiInterface, args, workload.Name, pod)
				if err != nil {
					item.Error = err.Error()
				} else {
					item.Data = logs
					podCount++
					status.Included = true
				}
				response.Logs = append(response.Logs, item)
			}
		}
		eligiblePods := countPods(workloads)
		if eligiblePods > args.MaxLogPods {
			response.Warnings = append(response.Warnings, fmt.Sprintf("logs were limited to %d of %d pods", args.MaxLogPods, eligiblePods))
		}
		if !status.Included && len(response.Logs) == 0 {
			status.Reason = "no logs were collected"
		} else if !status.Included {
			status.Reason = "all log requests failed"
		}
	}
	response.Sources["logs"] = status
}

func fetchPodLogs(ctx context.Context, kialiInterface *mcputil.KialiInterface, args TroubleshootingSnapshotArgs, workloadName string, pod *models.Pod) (LogsResult, error) {
	tailLines := int64(defaultTailLines)
	limitBytes := maxLogFetchBytes
	window := args.ToTime.Sub(args.SinceTime)
	opts := &business.LogOptions{
		LogType:  models.LogTypeApp,
		Duration: &window,
		PodLogOptions: core_v1.PodLogOptions{
			Timestamps: true,
			Container:  containerForPod(pod),
			TailLines:  &tailLines,
			LimitBytes: &limitBytes,
			SinceTime:  &meta_v1.Time{Time: args.SinceTime},
		},
	}

	recorder := httptest.NewRecorder()
	if err := kialiInterface.BusinessLayer.Workload.StreamPodLogs(ctx, args.ClusterName, args.Namespace, workloadName, "", pod.Name, opts, recorder); err != nil {
		return LogsResult{}, err
	}

	var result LogsResult
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		return LogsResult{}, err
	}
	return result, nil
}

func containerForPod(pod *models.Pod) string {
	for _, container := range pod.Containers {
		if container != nil && container.Name != "" && container.Name != "istio-proxy" {
			return container.Name
		}
	}
	for _, container := range pod.IstioContainers {
		if container != nil && container.Name != "" {
			return container.Name
		}
	}
	return ""
}

func collectEnvoyConfigDumps(kialiInterface *mcputil.KialiInterface, args TroubleshootingSnapshotArgs, workloads []*models.Workload, response *TroubleshootingSnapshotResponse) {
	status := SourceStatus{Enabled: true, Included: false}
	if !args.IncludeEnvoyConfigDump {
		status.Reason = "disabled by request"
		response.Sources["envoyConfigDumps"] = status
		return
	}

	proxyStatus := business.NewProxyStatusService(
		kialiInterface.Conf,
		kialiInterface.KialiCache,
		kialiInterface.Discovery,
		kialiInterface.ClientFactory.GetSAClients(),
		&kialiInterface.BusinessLayer.Namespace,
	)
	dumpCount := 0
	for _, workload := range workloads {
		if workload == nil || len(workload.Pods) == 0 || dumpCount >= args.MaxEnvoyConfigDumps {
			continue
		}
		pod := firstRunningPod(workload)
		if pod == nil {
			continue
		}
		item := EnvoyConfigDumpSource{
			Cluster:   args.ClusterName,
			Kind:      "pod",
			Name:      pod.Name,
			Namespace: args.Namespace,
		}
		dump, err := proxyStatus.GetConfigDump(args.ClusterName, args.Namespace, pod.Name)
		if err != nil {
			item.Error = err.Error()
		} else {
			item.Data = dump
			dumpCount++
			status.Included = true
		}
		response.EnvoyConfigDumps = append(response.EnvoyConfigDumps, item)
	}
	if len(response.EnvoyConfigDumps) > 0 {
		response.Warnings = append(response.Warnings, "Envoy config dumps are fetched from the live proxy admin endpoint and reflect the current state, not a historical state at `to`.")
	} else if !status.Included {
		status.Reason = "no Envoy config dump was collected"
	}
	response.Sources["envoyConfigDumps"] = status
}

func firstRunningPod(workload *models.Workload) *models.Pod {
	for _, pod := range workload.Pods {
		if pod != nil && pod.Name != "" && strings.EqualFold(pod.Status, "Running") {
			return pod
		}
	}
	return nil
}

func countPods(workloads []*models.Workload) int {
	count := 0
	for _, workload := range workloads {
		if workload == nil {
			continue
		}
		for _, pod := range workload.Pods {
			if pod != nil && pod.Name != "" {
				count++
			}
		}
	}
	return count
}

type snapshotTracing interface {
	GetServiceTraces(ctx context.Context, ns, service string, query models.TracingQuery) (*jaegerModel.TracingResponse, error)
	GetWorkloadTraces(ctx context.Context, ns, workload string, query models.TracingQuery) (*jaegerModel.TracingResponse, error)
}

func fetchSnapshotTraces(ctx context.Context, tracing snapshotTracing, args TroubleshootingSnapshotArgs, query models.TracingQuery) (TracesResult, error) {
	if args.WorkloadName != "" {
		traces, err := tracing.GetWorkloadTraces(ctx, args.Namespace, args.WorkloadName, query)
		if err != nil {
			return TracesResult{}, err
		}
		return buildTraceSummary(args.WorkloadName, traces), nil
	}
	traces, err := tracing.GetServiceTraces(ctx, args.Namespace, args.ServiceName, query)
	if err != nil {
		return TracesResult{}, err
	}
	return buildTraceSummary(args.ServiceName, traces), nil
}

func buildTraceSummary(serviceName string, traces *jaegerModel.TracingResponse) TracesResult {
	result := TracesResult{Service: serviceName, Traces: []TraceSummary{}}
	if traces == nil {
		return result
	}
	for _, trace := range traces.Data {
		summary := TraceSummary{
			ID:         string(trace.TraceID),
			SpansCount: len(trace.Spans),
		}
		var minStart uint64
		var maxEnd uint64
		for i, span := range trace.Spans {
			if i == 0 || span.StartTime < minStart {
				minStart = span.StartTime
			}
			if end := span.StartTime + span.Duration; end > maxEnd {
				maxEnd = end
			}
			if summary.RootOperation == "" && len(span.References) == 0 && span.ParentSpanID == "" {
				summary.RootOperation = span.OperationName
			}
			if spanHasError(&trace.Spans[i]) {
				summary.HasErrors = true
			}
		}
		summary.DurationMs = float64(maxEnd-minStart) / 1000
		result.Traces = append(result.Traces, summary)
	}
	result.TotalFound = len(result.Traces)
	return result
}

func spanHasError(span *jaegerModels.Span) bool {
	for _, tag := range span.Tags {
		switch tag.Key {
		case "error":
			return tag.Value == true || strings.EqualFold(fmt.Sprintf("%v", tag.Value), "true")
		case "http.status_code", "grpc.status_code":
			if code, err := strconv.Atoi(fmt.Sprintf("%v", tag.Value)); err == nil && code >= 500 {
				return true
			}
		case "status":
			if strings.EqualFold(fmt.Sprintf("%v", tag.Value), "error") {
				return true
			}
		}
	}
	return false
}

func defaultRateInterval(args TroubleshootingSnapshotArgs) string {
	window := args.ToTime.Sub(args.SinceTime)
	if window > 10*time.Minute {
		window = 10 * time.Minute
	}
	return window.String()
}

func defaultStepSeconds(args TroubleshootingSnapshotArgs) int {
	step := int(args.ToTime.Sub(args.SinceTime).Seconds() / 100)
	if step < 15 {
		step = 15
	}
	return step
}

func setError(response *TroubleshootingSnapshotResponse, source string, err error) {
	if response.Errors == nil {
		response.Errors = map[string]string{}
	}
	response.Errors[source] = err.Error()
}
