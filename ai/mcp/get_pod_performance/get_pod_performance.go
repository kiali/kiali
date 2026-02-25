package get_pod_performance

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
	"github.com/kiali/kiali/util"
)

func Execute(
	r *http.Request,
	args map[string]interface{},
	businessLayer *business.Layer,
	prom prometheus.ClientInterface,
	clientFactory kubernetes.ClientFactory,
	_ cache.KialiCache,
	conf *config.Config,
	_ *grafana.Service,
	_ *perses.Service,
	_ *istio.Discovery,
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
		clusterName = conf.KubernetesConfig.ClusterName
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

	resp := PodPerformanceResponse{
		Cluster:   clusterName,
		Namespace: namespace,
		Workload:  workloadName,
		PodName:   podName,
		TimeRange: timeRange,
		QueryTime: queryTime,
		Errors:    map[string]string{},
	}

	// If workloadName is provided, try to resolve to a concrete pod.
	// If the workload doesn't exist, fall back to using workloadName as podName.
	if workloadName != "" {
		resolvedPodName, state, err := resolvePodFromWorkload(r.Context(), businessLayer, clusterName, namespace, workloadName, queryTime)
		if err != nil {
			return err.Error(), http.StatusInternalServerError
		}
		if state == "resolved" {
			resp.PodName = resolvedPodName
			resp.Resolved = "workload"
		} else if state == "no_pods" {
			return fmt.Sprintf("workload %q in namespace %q exists but has no pods", workloadName, namespace), http.StatusNotFound
		} else if resp.PodName == "" {
			resp.PodName = workloadName
			resp.Resolved = "pod"
		} else {
			resp.Resolved = "pod"
		}
	} else {
		resp.Resolved = "pod"
	}

	// Always compute requests/limits from the Pod spec so we can return that even if metrics are missing.
	pod, podErr := getPod(r, clientFactory, clusterName, namespace, resp.PodName)
	if podErr != nil {
		if errors.IsNotFound(podErr) {
			return podErr.Error(), http.StatusNotFound
		}
		return podErr.Error(), http.StatusInternalServerError
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
	fillFromPrometheus(r, prom, namespace, resp.PodName, timeRange, queryTime, &resp)

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

	b.WriteString("**Rendimiento (CPU/Mem) — uso vs requests/limits**\n\n")
	b.WriteString(fmt.Sprintf("- **Cluster**: `%s`\n", resp.Cluster))
	b.WriteString(fmt.Sprintf("- **Namespace**: `%s`\n", resp.Namespace))
	if resp.Workload != "" {
		b.WriteString(fmt.Sprintf("- **Workload**: `%s`\n", resp.Workload))
	}
	b.WriteString(fmt.Sprintf("- **Pod**: `%s` (resuelto desde: `%s`)\n", resp.PodName, resp.Resolved))
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

	nameWidth := 5
	for _, r := range rows {
		if len(r.Container) > nameWidth {
			nameWidth = len(r.Container)
		}
	}
	if nameWidth > 24 {
		nameWidth = 24
	}

	// A short verdict line (best-effort).
	b.WriteString(renderVerdict(resp))
	b.WriteString("\n")

	b.WriteString("CPU (cores/millicores)\n\n")
	b.WriteString("    ")
	b.WriteString(fmt.Sprintf("%-*s  %8s  %8s  %8s  %7s  %7s\n", nameWidth, "SCOPE", "USAGE", "REQ", "LIM", "%REQ", "%LIM"))
	b.WriteString("    ")
	b.WriteString(fmt.Sprintf("%s\n", strings.Repeat("-", nameWidth+2+8+2+8+2+8+2+7+2+7)))
	for _, r := range rows {
		scope := truncateRight(r.Container, nameWidth)
		b.WriteString("    ")
		b.WriteString(fmt.Sprintf("%-*s  %8s  %8s  %8s  %7s  %7s\n",
			nameWidth,
			scope,
			formatCPU(r.CPU.Usage),
			formatCPU(r.CPU.Request),
			formatCPU(r.CPU.Limit),
			formatPercent(r.CPU.UsageRequestRatio),
			formatPercent(r.CPU.UsageLimitRatio),
		))
	}

	b.WriteString("\nMemoria\n\n")
	b.WriteString("    ")
	b.WriteString(fmt.Sprintf("%-*s  %10s  %10s  %10s  %7s  %7s\n", nameWidth, "SCOPE", "USAGE", "REQ", "LIM", "%REQ", "%LIM"))
	b.WriteString("    ")
	b.WriteString(fmt.Sprintf("%s\n", strings.Repeat("-", nameWidth+2+10+2+10+2+10+2+7+2+7)))
	for _, r := range rows {
		scope := truncateRight(r.Container, nameWidth)
		b.WriteString("    ")
		b.WriteString(fmt.Sprintf("%-*s  %10s  %10s  %10s  %7s  %7s\n",
			nameWidth,
			scope,
			formatBytes(r.Memory.Usage),
			formatBytes(r.Memory.Request),
			formatBytes(r.Memory.Limit),
			formatPercent(r.Memory.UsageRequestRatio),
			formatPercent(r.Memory.UsageLimitRatio),
		))
	}

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
			b.WriteString(fmt.Sprintf("- **%s**: %s\n", escapeTable(k), escapeTable(msg)))
		}
	}

	return b.String()
}

func escapeTable(s string) string {
	// Avoid breaking markdown table cells.
	return strings.ReplaceAll(s, "|", "\\|")
}

func formatCPU(v *ScalarValue) string {
	if v == nil {
		return "N/A"
	}
	cores := v.Value
	if cores == 0 {
		return "0"
	}
	if cores < 1 {
		return fmt.Sprintf("%.0fm", cores*1000)
	}
	if cores < 10 {
		return fmt.Sprintf("%.2f", cores)
	}
	return fmt.Sprintf("%.1f", cores)
}

func formatBytes(v *ScalarValue) string {
	if v == nil {
		return "N/A"
	}
	bytes := v.Value
	if bytes == 0 {
		return "0"
	}
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%.0fB", bytes)
	}
	div, exp := float64(unit), 0
	for n := bytes / unit; n >= unit && exp < 4; n /= unit {
		div *= unit
		exp++
	}
	suffix := []string{"KiB", "MiB", "GiB", "TiB", "PiB"}[exp]
	val := bytes / div
	if val < 10 {
		return fmt.Sprintf("%.2f%s", val, suffix)
	}
	if val < 100 {
		return fmt.Sprintf("%.1f%s", val, suffix)
	}
	return fmt.Sprintf("%.0f%s", val, suffix)
}

func formatPercent(r *float64) string {
	if r == nil {
		return "-"
	}
	return fmt.Sprintf("%.0f%%", (*r)*100)
}

func renderVerdict(resp PodPerformanceResponse) string {
	// Keep this conservative and short.
	var parts []string
	if resp.Memory.UsageRequestRatio != nil {
		parts = append(parts, fmt.Sprintf("Mem vs request: %s", formatPercent(resp.Memory.UsageRequestRatio)))
	}
	if resp.Memory.UsageLimitRatio != nil {
		parts = append(parts, fmt.Sprintf("Mem vs limit: %s", formatPercent(resp.Memory.UsageLimitRatio)))
	}
	if resp.CPU.UsageRequestRatio != nil {
		parts = append(parts, fmt.Sprintf("CPU vs request: %s", formatPercent(resp.CPU.UsageRequestRatio)))
	}
	if resp.CPU.UsageLimitRatio != nil {
		parts = append(parts, fmt.Sprintf("CPU vs limit: %s", formatPercent(resp.CPU.UsageLimitRatio)))
	}
	if len(parts) == 0 {
		return ""
	}
	return "**Resumen**: " + strings.Join(parts, " · ") + "\n"
}

func truncateRight(s string, max int) string {
	if max <= 0 || len(s) <= max {
		return s
	}
	if max <= 1 {
		return s[:max]
	}
	return s[:max-1] + "…"
}

// resolvePodFromWorkload tries to locate a workload by name and pick a representative pod.
// It returns state:
// - "resolved": workload found and pod selected
// - "no_pods": workload found but has no pods
// - "not_found": workload not found
func resolvePodFromWorkload(ctx context.Context, businessLayer *business.Layer, clusterName, namespace, workloadName string, queryTime time.Time) (podName string, state string, err error) {
	if businessLayer == nil {
		return "", "not_found", nil
	}

	criteria := business.WorkloadCriteria{
		Cluster:               clusterName,
		Namespace:             namespace,
		WorkloadName:          workloadName,
		WorkloadGVK:           schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"},
		IncludeHealth:         false,
		IncludeIstioResources: false,
		IncludeServices:       false,
		QueryTime:             queryTime,
	}
	w, err := businessLayer.Workload.GetWorkload(ctx, criteria)
	if err != nil {
		// If workload doesn't exist, the caller will fall back to treating workloadName as podName.
		if errors.IsNotFound(err) {
			return "", "not_found", nil
		}
		// Don't fail the whole tool call if workload lookup fails for non-NotFound reasons
		// (RBAC, transient API errors, etc.). Let the caller fall back to direct pod lookup.
		return "", "not_found", nil
	}
	if w == nil || len(w.Pods) == 0 {
		// Workload exists but has no pods (scaled to 0, pending, etc.)
		return "", "no_pods", nil
	}
	return pickBestPodName(w.Pods), "resolved", nil
}

func pickBestPodName(pods models.Pods) string {
	// Prefer Running & Ready.
	best := ""
	for _, p := range pods {
		if p == nil || p.Name == "" {
			continue
		}
		if p.Status == "Running" && isPodReady(p) {
			return p.Name
		}
		if best == "" && p.Status == "Running" {
			best = p.Name
		}
		if best == "" {
			best = p.Name
		}
	}
	return best
}

func isPodReady(p *models.Pod) bool {
	if p == nil {
		return false
	}
	// Consider the application containers (non-proxy) readiness.
	if len(p.Containers) == 0 {
		return false
	}
	for _, c := range p.Containers {
		if c == nil {
			continue
		}
		if !c.IsReady {
			return false
		}
	}
	return true
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

func fillFromPrometheus(r *http.Request, prom prometheus.ClientInterface, namespace, podName, timeRange string, queryTime time.Time, resp *PodPerformanceResponse) {
	if prom == nil || prom.API() == nil {
		resp.Errors["prometheus"] = "prometheus client not available"
		return
	}

	// Totals
	cpuTotalQuery := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{namespace=%q,pod=%q,container!="" ,container!="POD"}[%s]))`, namespace, podName, timeRange)
	memTotalQuery := fmt.Sprintf(`sum(container_memory_working_set_bytes{namespace=%q,pod=%q,container!="" ,container!="POD"})`, namespace, podName)

	if v, err := queryFloat(r.Context(), prom, cpuTotalQuery, queryTime); err != nil {
		resp.Errors["cpu_usage"] = err.Error()
	} else {
		resp.CPU.Usage = &ScalarValue{Value: v, Unit: "cores"}
	}

	if v, err := queryFloat(r.Context(), prom, memTotalQuery, queryTime); err != nil {
		resp.Errors["memory_usage"] = err.Error()
	} else {
		resp.Memory.Usage = &ScalarValue{Value: v, Unit: "bytes"}
	}

	// Per-container usage (best effort).
	cpuByContainerQuery := fmt.Sprintf(`sum by (container) (rate(container_cpu_usage_seconds_total{namespace=%q,pod=%q,container!="" ,container!="POD"}[%s]))`, namespace, podName, timeRange)
	memByContainerQuery := fmt.Sprintf(`sum by (container) (container_memory_working_set_bytes{namespace=%q,pod=%q,container!="" ,container!="POD"})`, namespace, podName)

	cpuByContainer, err := queryVectorByLabel(r.Context(), prom, cpuByContainerQuery, queryTime, "container")
	if err != nil {
		resp.Errors["cpu_usage_by_container"] = err.Error()
	}
	memByContainer, err := queryVectorByLabel(r.Context(), prom, memByContainerQuery, queryTime, "container")
	if err != nil {
		resp.Errors["memory_usage_by_container"] = err.Error()
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

func queryFloat(ctx context.Context, prom prometheus.ClientInterface, query string, queryTime time.Time) (float64, error) {
	result, warnings, err := prom.API().Query(ctx, query, queryTime)
	_ = warnings // warnings are best-effort; surface errors only
	if err != nil {
		return 0, err
	}
	return modelValueToSingleFloat(result)
}

func queryVectorByLabel(ctx context.Context, prom prometheus.ClientInterface, query string, queryTime time.Time, label string) (map[string]float64, error) {
	result, _, err := prom.API().Query(ctx, query, queryTime)
	if err != nil {
		return nil, err
	}
	vec, ok := result.(model.Vector)
	if !ok {
		if scalar, ok2 := result.(*model.Scalar); ok2 {
			return map[string]float64{"": float64(scalar.Value)}, nil
		}
		return nil, fmt.Errorf("unexpected prometheus result type %T", result)
	}
	out := map[string]float64{}
	for _, sample := range vec {
		key := string(sample.Metric[model.LabelName(label)])
		out[key] = float64(sample.Value)
	}
	return out, nil
}

func modelValueToSingleFloat(v model.Value) (float64, error) {
	switch t := v.(type) {
	case model.Vector:
		if len(t) == 0 {
			return 0, fmt.Errorf("no data")
		}
		sum := 0.0
		for _, s := range t {
			sum += float64(s.Value)
		}
		return sum, nil
	case *model.Scalar:
		return float64(t.Value), nil
	default:
		return 0, fmt.Errorf("unexpected prometheus result type %T", v)
	}
}
