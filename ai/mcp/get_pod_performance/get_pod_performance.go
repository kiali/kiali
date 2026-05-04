package get_pod_performance

import (
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util"
)

func Execute(
	kialiInterface *mcputil.KialiInterface,
	args map[string]interface{},
) (interface{}, int) {
	namespace := mcputil.GetStringArg(args, "namespace")
	workloadName := mcputil.GetStringArg(args, "workloadName", "workload_name", "workload")
	podName := mcputil.GetStringArg(args, "podName", "pod_name", "pod")
	clusterName := mcputil.GetStringArg(args, "clusterName", "cluster_name", "cluster")
	timeRange := mcputil.GetStringArg(args, "timeRange", "time_range", "duration", "range")
	queryTime := mcputil.GetTimeArg(args, "queryTime", "query_time", "endTime", "end_time")

	if namespace == "" {
		return "namespace is required", http.StatusBadRequest
	}
	if podName == "" && workloadName == "" {
		return "podName or workloadName is required", http.StatusBadRequest
	}
	if clusterName == "" {
		clusterName = kialiInterface.Conf.KubernetesConfig.ClusterName
	}
	if timeRange == "" {
		timeRange = defaultTimeRange
	}
	if queryTime.IsZero() {
		queryTime = util.Clock.Now()
	}
	if _, err := model.ParseDuration(timeRange); err != nil {
		return fmt.Sprintf("invalid timeRange %q (expected Prometheus duration like 5m, 1h, 1d): %v", timeRange, err), http.StatusBadRequest
	}

	// Validate cluster existence so the user gets a clear message for typos.
	if kialiInterface.ClientFactory != nil {
		if kialiInterface.ClientFactory.GetSAClient(clusterName) == nil {
			known := make([]string, 0)
			for c := range kialiInterface.ClientFactory.GetSAClients() {
				known = append(known, c)
			}
			return fmt.Sprintf("Cluster %q is not known to Kiali. Known clusters: %v. Please verify the cluster name and try again.", clusterName, known), http.StatusOK
		}
	}

	// Validate namespace existence early so the user gets a clear message.
	if kialiInterface.BusinessLayer != nil {
		if nsErrMsg, nsCode := mcputil.ValidateNamespaceAccess(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, namespace, clusterName); nsErrMsg != "" {
			return nsErrMsg + " Please verify the namespace name and your permissions, then try again.", nsCode
		}
	}

	resp := PodPerformanceResponse{
		Cluster:   clusterName,
		Namespace: namespace,
		Workload:  workloadName,
		PodName:   podName,
		TimeRange: timeRange,
		QueryTime: queryTime,
		Errors:    map[string]string{},
	}

	// When podName is explicitly provided, use it directly — the user wants
	// that specific pod. Only resolve from the workload when no podName was given.
	if podName != "" {
		resp.Resolved = "pod"
	} else if workloadName != "" {
		res, err := mcputil.ResolvePodFromWorkloadOrPod(
			kialiInterface.Request.Context(),
			kialiInterface.BusinessLayer,
			clusterName,
			namespace,
			workloadName,
			"",
			queryTime,
			mcputil.ResolvePodOptions{
				PreferRunning:        true,
				PreferNonProxyOnly:   false,
				RequirePods:          true,
				FallbackToPodOnError: true,
			},
		)
		if err != nil {
			if errors.Is(err, mcputil.ErrWorkloadHasNoPods) {
				return fmt.Sprintf("Workload %q in namespace %q exists but currently has no running pods. The workload may be scaled to zero or the pods may be starting up.", workloadName, namespace), http.StatusOK
			}
			return fmt.Sprintf("Unable to resolve workload %q in namespace %q: %v", workloadName, namespace, err), http.StatusOK
		}
		resp.PodName = res.PodName
		resp.Resolved = res.ResolvedFrom
	} else {
		resp.Resolved = "pod"
	}

	// Always compute requests/limits from the Pod spec so we can return that even if metrics are missing.
	pod, podErr := getPod(kialiInterface.Request, kialiInterface.ClientFactory, clusterName, namespace, resp.PodName)
	if podErr != nil {
		if k8serrors.IsNotFound(podErr) {
			return fmt.Sprintf("Pod %q was not found in namespace %q (cluster %q). The pod may have been deleted, not yet created, or the name may be incorrect.", resp.PodName, namespace, clusterName), http.StatusOK
		}
		return fmt.Sprintf("Unable to retrieve pod %q in namespace %q: %v", resp.PodName, namespace, podErr), http.StatusOK
	}
	containerReqLim := extractContainerRequestsLimits(pod)
	resp.Containers = make([]ContainerPerformance, 0, len(containerReqLim))

	// Fill requests/limits into response (per container + total).
	var totalCPUReq, totalCPULim float64
	var totalMemReqBytes, totalMemLimBytes float64
	for containerName, rl := range containerReqLim {
		c := ContainerPerformance{Container: containerName}

		if rl.CPURequestCores != nil {
			v := *rl.CPURequestCores
			c.CPU.Request = &ScalarValue{Value: v, Unit: "cores"}
			totalCPUReq += v
		}
		if rl.CPULimitCores != nil {
			v := *rl.CPULimitCores
			c.CPU.Limit = &ScalarValue{Value: v, Unit: "cores"}
			totalCPULim += v
		}
		if rl.MemoryRequestBytes != nil {
			v := *rl.MemoryRequestBytes
			c.Memory.Request = &ScalarValue{Value: v, Unit: "bytes"}
			totalMemReqBytes += v
		}
		if rl.MemoryLimitBytes != nil {
			v := *rl.MemoryLimitBytes
			c.Memory.Limit = &ScalarValue{Value: v, Unit: "bytes"}
			totalMemLimBytes += v
		}

		resp.Containers = append(resp.Containers, c)
	}
	if totalCPUReq > 0 {
		resp.CPU.Request = &ScalarValue{Value: totalCPUReq, Unit: "cores"}
	}
	if totalCPULim > 0 {
		resp.CPU.Limit = &ScalarValue{Value: totalCPULim, Unit: "cores"}
	}
	if totalMemReqBytes > 0 {
		resp.Memory.Request = &ScalarValue{Value: totalMemReqBytes, Unit: "bytes"}
	}
	if totalMemLimBytes > 0 {
		resp.Memory.Limit = &ScalarValue{Value: totalMemLimBytes, Unit: "bytes"}
	}

	// Use resolved pod name (when workloadName was provided).
	fillFromPrometheus(kialiInterface.Request, kialiInterface.Prom, namespace, resp.PodName, timeRange, queryTime, &resp)

	// Compute ratios on totals.
	resp.CPU.UsageRequestRatio = ratio(resp.CPU.Usage, resp.CPU.Request)
	resp.CPU.UsageLimitRatio = ratio(resp.CPU.Usage, resp.CPU.Limit)
	resp.Memory.UsageRequestRatio = ratio(resp.Memory.Usage, resp.Memory.Request)
	resp.Memory.UsageLimitRatio = ratio(resp.Memory.Usage, resp.Memory.Limit)

	// Compute ratios on per container rows.
	for i := range resp.Containers {
		c := &resp.Containers[i]
		c.CPU.UsageRequestRatio = ratio(c.CPU.Usage, c.CPU.Request)
		c.CPU.UsageLimitRatio = ratio(c.CPU.Usage, c.CPU.Limit)
		c.Memory.UsageRequestRatio = ratio(c.Memory.Usage, c.Memory.Request)
		c.Memory.UsageLimitRatio = ratio(c.Memory.Usage, c.Memory.Limit)
	}

	if len(resp.Errors) == 0 {
		resp.Errors = nil
	}
	return renderHumanSummary(resp), http.StatusOK
}

func renderHumanSummary(resp PodPerformanceResponse) string {
	var b strings.Builder

	b.WriteString("**Performance (CPU/Memory) — usage vs requests/limits**\n\n")
	b.WriteString(fmt.Sprintf("- **Cluster**: `%s`\n", resp.Cluster))
	b.WriteString(fmt.Sprintf("- **Namespace**: `%s`\n", resp.Namespace))
	if resp.Workload != "" {
		b.WriteString(fmt.Sprintf("- **Workload**: `%s`\n", resp.Workload))
	}
	b.WriteString(fmt.Sprintf("- **Pod**: `%s` (resolved from: `%s`)\n", resp.PodName, resp.Resolved))
	b.WriteString(fmt.Sprintf("- **Window**: `%s`\n", resp.TimeRange))
	b.WriteString(fmt.Sprintf("- **Query time**: `%s`\n\n", resp.QueryTime.UTC().Format(time.RFC3339)))

	// Render as fixed-width text in indented code blocks.
	// This is reliably readable with react-markdown without needing GFM tables.
	rows := make([]ContainerPerformance, 0, len(resp.Containers)+1)
	rows = append(rows, ContainerPerformance{Container: "TOTAL", CPU: resp.CPU, Memory: resp.Memory})
	if len(resp.Containers) > 0 {
		containers := make([]ContainerPerformance, len(resp.Containers))
		copy(containers, resp.Containers)
		sort.Slice(containers, func(i, j int) bool { return containers[i].Container < containers[j].Container })
		rows = append(rows, containers...)
	}

	// A short verdict line (best-effort).
	b.WriteString(renderVerdict(resp))
	b.WriteString("\n")

	cpuTable := mcputil.TextTable{
		Indent:  "",
		Headers: []string{"SCOPE", "USAGE", "REQ", "LIM", "%REQ", "%LIM"},
		AlignRight: map[int]bool{
			1: true, 2: true, 3: true, 4: true, 5: true,
		},
	}
	memTable := mcputil.TextTable{
		Indent:  "",
		Headers: []string{"SCOPE", "USAGE", "REQ", "LIM", "%REQ", "%LIM"},
		AlignRight: map[int]bool{
			1: true, 2: true, 3: true, 4: true, 5: true,
		},
	}

	for _, r := range rows {
		cpuTable.Rows = append(cpuTable.Rows, []string{
			r.Container,
			mcputil.FormatCores(floatFromScalar(r.CPU.Usage)),
			mcputil.FormatCores(floatFromScalar(r.CPU.Request)),
			mcputil.FormatCores(floatFromScalar(r.CPU.Limit)),
			mcputil.FormatPercentRatio(r.CPU.UsageRequestRatio),
			mcputil.FormatPercentRatio(r.CPU.UsageLimitRatio),
		})
		memTable.Rows = append(memTable.Rows, []string{
			r.Container,
			mcputil.FormatBinaryBytes(floatFromScalar(r.Memory.Usage)),
			mcputil.FormatBinaryBytes(floatFromScalar(r.Memory.Request)),
			mcputil.FormatBinaryBytes(floatFromScalar(r.Memory.Limit)),
			mcputil.FormatPercentRatio(r.Memory.UsageRequestRatio),
			mcputil.FormatPercentRatio(r.Memory.UsageLimitRatio),
		})
	}

	b.WriteString("CPU (cores/millicores)\n\n")
	b.WriteString("~~~\n")
	b.WriteString(cpuTable.Render())
	b.WriteString("~~~\n")
	b.WriteString("\nMemory\n\n")
	b.WriteString("~~~\n")
	b.WriteString(memTable.Render())
	b.WriteString("~~~\n")

	if len(resp.Errors) > 0 {
		keys := make([]string, 0, len(resp.Errors))
		for k := range resp.Errors {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		b.WriteString("\n**Notes**\n")
		for _, k := range keys {
			msg := resp.Errors[k]
			// Keep this short; the table already conveys N/A.
			b.WriteString(fmt.Sprintf("- **%s**: %s\n", k, msg))
		}
	}

	return b.String()
}

func renderVerdict(resp PodPerformanceResponse) string {
	// Keep this conservative and short.
	var parts []string
	if resp.Memory.UsageRequestRatio != nil {
		parts = append(parts, fmt.Sprintf("Memory vs request: %s", mcputil.FormatPercentRatio(resp.Memory.UsageRequestRatio)))
	}
	if resp.Memory.UsageLimitRatio != nil {
		parts = append(parts, fmt.Sprintf("Memory vs limit: %s", mcputil.FormatPercentRatio(resp.Memory.UsageLimitRatio)))
	}
	if resp.CPU.UsageRequestRatio != nil {
		parts = append(parts, fmt.Sprintf("CPU vs request: %s", mcputil.FormatPercentRatio(resp.CPU.UsageRequestRatio)))
	}
	if resp.CPU.UsageLimitRatio != nil {
		parts = append(parts, fmt.Sprintf("CPU vs limit: %s", mcputil.FormatPercentRatio(resp.CPU.UsageLimitRatio)))
	}
	if len(parts) == 0 {
		return ""
	}
	return "**Summary**: " + strings.Join(parts, " · ") + "\n"
}

type containerRequestsLimits struct {
	CPURequestCores    *float64
	CPULimitCores      *float64
	MemoryRequestBytes *float64
	MemoryLimitBytes   *float64
}

func extractContainerRequestsLimits(pod *corev1.Pod) map[string]containerRequestsLimits {
	out := make(map[string]containerRequestsLimits, len(pod.Spec.Containers))
	for _, c := range pod.Spec.Containers {
		var rl containerRequestsLimits

		if q, ok := c.Resources.Requests[corev1.ResourceCPU]; ok {
			v := q.AsApproximateFloat64()
			rl.CPURequestCores = &v
		}
		if q, ok := c.Resources.Limits[corev1.ResourceCPU]; ok {
			v := q.AsApproximateFloat64()
			rl.CPULimitCores = &v
		}
		if q, ok := c.Resources.Requests[corev1.ResourceMemory]; ok {
			v := float64(q.Value())
			rl.MemoryRequestBytes = &v
		}
		if q, ok := c.Resources.Limits[corev1.ResourceMemory]; ok {
			v := float64(q.Value())
			rl.MemoryLimitBytes = &v
		}

		out[c.Name] = rl
	}
	return out
}

func getPod(r *http.Request, clientFactory kubernetes.ClientFactory, clusterName, namespace, podName string) (*corev1.Pod, error) {
	k8s := clientFactory.GetSAClient(clusterName)
	return k8s.GetPod(namespace, podName)
}

func isConnectionError(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "no such host") ||
		strings.Contains(msg, "dial tcp") ||
		strings.Contains(msg, "i/o timeout") ||
		strings.Contains(msg, "connect:") ||
		strings.Contains(msg, "service unavailable")
}

const promUnavailableMsg = "Prometheus is not accessible. Performance metrics are temporarily unavailable — please verify that Prometheus is running and reachable."

func promErrorMessage(err error, fallbackKey string) string {
	if errors.Is(err, mcputil.ErrNoData) {
		return "no data returned by Prometheus"
	}
	if isConnectionError(err) {
		return promUnavailableMsg
	}
	return fmt.Sprintf("unable to query %s metrics from Prometheus", fallbackKey)
}

func fillFromPrometheus(r *http.Request, prom prometheus.ClientInterface, namespace, podName, timeRange string, queryTime time.Time, resp *PodPerformanceResponse) {
	if prom == nil || prom.API() == nil {
		resp.Errors["prometheus"] = "Prometheus is not accessible. Performance metrics are temporarily unavailable — please verify that Prometheus is running and reachable."
		return
	}

	// Totals
	cpuTotalQuery := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{namespace=%q,pod=%q,container!="" ,container!="POD"}[%s]))`, namespace, podName, timeRange)
	memTotalQuery := fmt.Sprintf(`sum(container_memory_working_set_bytes{namespace=%q,pod=%q,container!="" ,container!="POD"})`, namespace, podName)

	if v, err := mcputil.PromQueryFloat64(r.Context(), prom, cpuTotalQuery, queryTime); err != nil {
		if isConnectionError(err) {
			resp.Errors["prometheus"] = promUnavailableMsg
			return
		}
		resp.Errors["cpu_usage"] = promErrorMessage(err, "CPU")
	} else {
		resp.CPU.Usage = &ScalarValue{Value: v, Unit: "cores"}
	}

	if v, err := mcputil.PromQueryFloat64(r.Context(), prom, memTotalQuery, queryTime); err != nil {
		if isConnectionError(err) {
			resp.Errors["prometheus"] = promUnavailableMsg
			return
		}
		resp.Errors["memory_usage"] = promErrorMessage(err, "memory")
	} else {
		resp.Memory.Usage = &ScalarValue{Value: v, Unit: "bytes"}
	}

	// Per-container usage (best effort).
	cpuByContainerQuery := fmt.Sprintf(`sum by (container) (rate(container_cpu_usage_seconds_total{namespace=%q,pod=%q,container!="" ,container!="POD"}[%s]))`, namespace, podName, timeRange)
	memByContainerQuery := fmt.Sprintf(`sum by (container) (container_memory_working_set_bytes{namespace=%q,pod=%q,container!="" ,container!="POD"})`, namespace, podName)

	cpuByContainer, err := mcputil.PromQueryVectorByLabel(r.Context(), prom, cpuByContainerQuery, queryTime, "container")
	if err != nil {
		if isConnectionError(err) {
			resp.Errors["prometheus"] = promUnavailableMsg
			return
		}
		resp.Errors["cpu_usage_by_container"] = promErrorMessage(err, "per-container CPU")
	}
	memByContainer, err := mcputil.PromQueryVectorByLabel(r.Context(), prom, memByContainerQuery, queryTime, "container")
	if err != nil {
		if isConnectionError(err) {
			resp.Errors["prometheus"] = promUnavailableMsg
			return
		}
		resp.Errors["memory_usage_by_container"] = promErrorMessage(err, "per-container memory")
	}

	if len(cpuByContainer) == 0 && len(memByContainer) == 0 {
		return
	}

	// Merge into container rows. Only set usage for containers we already have (from Pod spec),
	// but also create new rows for containers that exist in metrics (if any).
	index := map[string]int{}
	for i := range resp.Containers {
		index[resp.Containers[i].Container] = i
	}
	ensureRow := func(container string) *ContainerPerformance {
		if i, ok := index[container]; ok {
			return &resp.Containers[i]
		}
		resp.Containers = append(resp.Containers, ContainerPerformance{Container: container})
		index[container] = len(resp.Containers) - 1
		return &resp.Containers[len(resp.Containers)-1]
	}

	for c, v := range cpuByContainer {
		row := ensureRow(c)
		row.CPU.Usage = &ScalarValue{Value: v, Unit: "cores"}
	}
	for c, v := range memByContainer {
		row := ensureRow(c)
		row.Memory.Usage = &ScalarValue{Value: v, Unit: "bytes"}
	}
}

func ratio(n *ScalarValue, d *ScalarValue) *float64 {
	if n == nil || d == nil {
		return nil
	}
	if d.Value == 0 {
		return nil
	}
	v := n.Value / d.Value
	return &v
}

func floatFromScalar(v *ScalarValue) *float64 {
	if v == nil {
		return nil
	}
	x := v.Value
	return &x
}
