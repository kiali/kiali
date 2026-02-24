package get_logs

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"

	core_v1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
	"github.com/kiali/kiali/util"
)

const (
	defaultTailLines    = 50
	maxTailLinesReturn  = 200
	maxTailLinesFetch   = 500
	defaultMaxFetchByte = int64(256 * 1024) // hard cap to avoid context/memory blowups
)

type podLogJSON struct {
	Entries        []podLogEntry `json:"entries,omitempty"`
	LinesTruncated bool          `json:"linesTruncated,omitempty"`
}

type podLogEntry struct {
	Message   string `json:"message,omitempty"`
	Severity  string `json:"severity,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

func Execute(
	r *http.Request,
	args map[string]interface{},
	businessLayer *business.Layer,
	_ prometheus.ClientInterface,
	_ kubernetes.ClientFactory,
	_ cache.KialiCache,
	conf *config.Config,
	_ *grafana.Service,
	_ *perses.Service,
	_ *istio.Discovery,
) (interface{}, int) {
	if config.IsFeatureDisabled(config.FeatureLogView) {
		return "Pod Logs access is disabled", http.StatusForbidden
	}

	parsed, errMsg, code := parseArgs(args, conf)
	if code != http.StatusOK {
		return errMsg, code
	}

	log.Debugf("[Chat AI][get_logs] ns=%s requested=%s workload=%s pod=%s container=%s tail=%d severity=%v previous=%t cluster=%s",
		parsed.Namespace, parsed.Requested, parsed.Workload, parsed.Pod, parsed.Container, parsed.TailLines, parsed.Severities, parsed.Previous, parsed.ClusterName)

	warnings := []string{}

	// Resolve the input name into an actual pod.
	// FIRST: treat the name as a workload and pick a Running pod that is not "proxy-only".
	// SECOND: if it is not a workload, treat it as a Pod name.
	podName := parsed.Pod
	podModel := (*models.Pod)(nil)

	workloadName := strings.TrimSpace(parsed.Workload)
	if workloadName == "" {
		workloadName = strings.TrimSpace(parsed.Requested)
	}
	if workloadName == "" {
		workloadName = strings.TrimSpace(podName)
	}

	if workloadName != "" {
		selectedPodName, selectedPod, w, status, werr := resolvePodFromWorkload(r, businessLayer, parsed.ClusterName, parsed.Namespace, workloadName)
		if werr == nil && status == http.StatusOK && selectedPod != nil {
			warnings = append(warnings, "Resolved input as workload and selected pod: "+selectedPodName)
			podName = selectedPodName
			podModel = selectedPod
		} else if werr == nil && status != http.StatusOK && status != http.StatusNotFound {
			// Unexpected workload errors should surface.
			return w, status
		}
	}

	if podModel == nil {
		podModelResolved, err := businessLayer.Workload.GetPod(parsed.ClusterName, parsed.Namespace, podName)
		if err != nil {
			if k8serrors.IsNotFound(err) {
				return fmt.Sprintf("failed to get pod %s log in namespace %s: %v", podName, parsed.Namespace, err), http.StatusNotFound
			}
			return fmt.Sprintf("failed to get pod %s log in namespace %s: %v", podName, parsed.Namespace, err), http.StatusInternalServerError
		}
		podModel = podModelResolved
	}

	parsed.Pod = podName

	// Determine container candidates. If the first candidate yields no logs, we can try another non-proxy container.
	containerCandidates, cwarnings, code := containerCandidates(parsed.Container, podModel)
	if code != http.StatusOK {
		if len(cwarnings) > 0 {
			// Match kubernetes-mcp-server error style.
			// Example: "failed to get pod a-pod log in namespace ns: container X is not valid for pod a-pod"
			if parsed.Container != "" {
				return fmt.Sprintf("failed to get pod %s log in namespace %s: container %s is not valid for pod %s", parsed.Pod, parsed.Namespace, parsed.Container, parsed.Pod), http.StatusBadRequest
			}
			return fmt.Sprintf("failed to get pod %s log in namespace %s: %s", parsed.Pod, parsed.Namespace, cwarnings[0]), code
		}
		return "invalid container selection", code
	}
	warnings = append(warnings, cwarnings...)

	// If we are filtering, we may want to fetch a little more than we return so we can still provide
	// "last N matching lines" without returning unbounded output.
	fetchTail := parsed.TailLines
	if len(parsed.Severities) > 0 {
		fetchTail = min(maxTailLinesFetch, max(parsed.TailLines*4, parsed.TailLines))
	}

	var fetched []podLogEntry
	// Try containers in order until we get at least one log entry (or run out of candidates).
	for i, c := range containerCandidates {
		parsed.Container = c

		tail := int64(fetchTail)
		limit := defaultMaxFetchByte
		opts := &business.LogOptions{
			LogType: models.LogTypeApp,
			PodLogOptions: core_v1.PodLogOptions{
				Timestamps: true,
				Container:  parsed.Container,
				Previous:   parsed.Previous,
				TailLines:  &tail,
				LimitBytes: &limit,
			},
		}

		rec := httptest.NewRecorder()
		// `workload` and `service` are only needed for waypoint/ztunnel log types. For app logs they are ignored.
		if err := businessLayer.Workload.StreamPodLogs(r.Context(), parsed.ClusterName, parsed.Namespace, workloadName, "", parsed.Pod, opts, rec); err != nil {
			// Match kubernetes-mcp-server error style.
			if k8serrors.IsNotFound(err) {
				return fmt.Sprintf("failed to get pod %s log in namespace %s: %v", parsed.Pod, parsed.Namespace, err), http.StatusNotFound
			}
			return fmt.Sprintf("failed to get pod %s log in namespace %s: %v", parsed.Pod, parsed.Namespace, err), http.StatusInternalServerError
		}

		var pl podLogJSON
		if err := json.Unmarshal(rec.Body.Bytes(), &pl); err != nil {
			return fmt.Sprintf("failed to get pod %s log in namespace %s: %v", parsed.Pod, parsed.Namespace, err), http.StatusInternalServerError
		}

		fetched = pl.Entries
		if len(fetched) > 0 || i == len(containerCandidates)-1 {
			if i > 0 {
				warnings = append(warnings, "No logs returned for the first selected container; tried another non-proxy container: "+c)
			}
			break
		}
	}

	unfiltered := fetched
	filtered := unfiltered
	if len(parsed.Severities) > 0 {
		filtered = filterEntriesBySeverity(unfiltered, parsed.Severities)
	}
	if len(filtered) > parsed.TailLines {
		filtered = filtered[len(filtered)-parsed.TailLines:]
	}

	// Match kubernetes-mcp-server `pods_log` output shape: plain text logs.
	// (ToolCallResult content is a single text blob.)
	if len(filtered) == 0 {
		// If there were logs but they didn't match the severity filter, return a truthful message.
		if len(parsed.Severities) > 0 && len(unfiltered) > 0 {
			return "No log lines matched the requested severities within the fetched tail window.", http.StatusOK
		}
		// Keep message aligned with kubernetes-mcp-server core/pods.go behavior.
		return fmt.Sprintf("The pod %s in namespace %s has not logged any message yet", parsed.Pod, parsed.Namespace), http.StatusOK
	}

	out := strings.Join(entriesToLines(filtered), "\n")
	if out != "" {
		out += "\n"
	}
	// If we had warnings (e.g. workload resolution), we keep them in server logs only to preserve the exact pods_log output format.
	_ = warnings

	if parsed.Format == "plain" {
		return out, http.StatusOK
	}
	// Default: wrap in code block so chat preserves line breaks.
	// Use ~~~ per Kiali prompt requirements.
	return "~~~\n" + out + "~~~\n", http.StatusOK
}

func parseArgs(args map[string]interface{}, conf *config.Config) (GetLogsArgs, string, int) {
	out := GetLogsArgs{}

	out.Namespace = mcputil.GetStringArg(args, "namespace", "ns")
	// Align with kubernetes-mcp-server `pods_log` naming: `name` + `tail`.
	out.Pod = mcputil.GetStringArg(args, "name", "pod", "pod_name", "podName")
	out.Workload = mcputil.GetStringArg(args, "workload", "workload_name", "workloadName", "wl")
	out.Container = mcputil.GetStringArg(args, "container", "container_name", "containerName")
	out.ClusterName = mcputil.GetStringArg(args, "cluster_name", "clusterName")
	out.Previous = mcputil.AsBool(args["previous"])
	out.Analyze = mcputil.AsBool(args["analyze"])
	out.Format = strings.ToLower(mcputil.GetStringArg(args, "format"))
	if out.Format == "" || (out.Format != "plain" && out.Format != "codeblock") {
		out.Format = "codeblock"
	}

	tailLines, _, tailErr := parseTailArg(args)
	if tailErr != "" {
		// Match kubernetes-mcp-server error shape.
		return out, tailErr, http.StatusBadRequest
	}
	if tailLines <= 0 {
		tailLines = defaultTailLines
	}
	if tailLines > maxTailLinesReturn {
		tailLines = maxTailLinesReturn
	}
	out.TailLines = tailLines

	rawSeverity := mcputil.GetStringArg(args, "severity", "severities", "level")
	out.Severities = normalizeSeverities(rawSeverity)

	if out.Namespace == "" {
		return out, "failed to get pod log, missing argument namespace", http.StatusBadRequest
	}

	// Accept either pod or workload. If only workload is provided, treat it as the input name
	// and allow the resolver to pick a concrete pod from that workload.
	if out.Pod == "" && out.Workload != "" {
		out.Pod = out.Workload
	}
	if out.Pod == "" {
		return out, "failed to get pod log, missing argument name", http.StatusBadRequest
	}

	out.Requested = out.Pod
	if out.ClusterName == "" && conf != nil {
		out.ClusterName = conf.KubernetesConfig.ClusterName
	}
	if out.ClusterName == "" {
		return out, "cluster_name is required", http.StatusBadRequest
	}

	return out, "", http.StatusOK
}

func parseTailArg(args map[string]interface{}) (int, bool, string) {
	// Prefer kubernetes-mcp-server canonical name: `tail`
	if v, ok := args["tail"]; ok && v != nil {
		switch t := v.(type) {
		case float64:
			return int(t), true, ""
		case int:
			return t, true, ""
		case int64:
			return int(t), true, ""
		default:
			return 0, true, fmt.Sprintf("failed to parse tail parameter: expected integer, got %T", v)
		}
	}
	// Back-compat aliases used by Kiali AI tool schema
	for _, k := range []string{"tail_lines", "tailLines", "lines"} {
		if v, ok := args[k]; ok && v != nil {
			switch t := v.(type) {
			case float64:
				return int(t), true, ""
			case int:
				return t, true, ""
			case int64:
				return int(t), true, ""
			case string:
				i, err := strconv.Atoi(strings.TrimSpace(t))
				if err != nil {
					return 0, true, "failed to parse tail parameter: expected integer"
				}
				return i, true, ""
			default:
				return 0, true, fmt.Sprintf("failed to parse tail parameter: expected integer, got %T", v)
			}
		}
	}
	return 0, false, ""
}

func containerCandidates(requested string, pod *models.Pod) ([]string, []string, int) {
	containers := allContainerNames(pod)
	if requested != "" {
		for _, c := range containers {
			if c == requested {
				return []string{requested}, nil, http.StatusOK
			}
		}
		return nil, []string{"container not found in pod. available containers: " + strings.Join(containers, ", ")}, http.StatusBadRequest
	}

	// Prefer application containers (non-proxy) by default.
	appContainers := make([]string, 0, len(pod.Containers))
	for _, c := range pod.Containers {
		if c != nil && c.Name != "" {
			appContainers = append(appContainers, c.Name)
		}
	}
	if len(appContainers) == 1 {
		return appContainers, nil, http.StatusOK
	}
	if len(appContainers) > 1 {
		// Return all as candidates (deterministic order) but warn so the model can request a specific one next time.
		return appContainers,
			[]string{"Multiple non-proxy containers found; trying them in order. Available non-proxy containers: " + strings.Join(appContainers, ", ") + ". Provide `container` to choose a specific one."},
			http.StatusOK
	}

	// No non-proxy containers; fall back to istio containers only if unambiguous.
	if len(pod.IstioContainers) == 1 {
		return []string{pod.IstioContainers[0].Name}, []string{"Defaulted to istio container because the pod has no non-istio containers."}, http.StatusOK
	}
	if len(containers) == 1 {
		return []string{containers[0]}, nil, http.StatusOK
	}
	return nil, []string{"container is required when a pod has multiple containers. available containers: " + strings.Join(containers, ", ")}, http.StatusBadRequest
}

func resolvePodFromWorkload(r *http.Request, businessLayer *business.Layer, cluster, namespace, workload string) (string, *models.Pod, string, int, error) {
	if strings.TrimSpace(workload) == "" {
		return "", nil, "workload name is empty", http.StatusBadRequest, nil
	}
	criteria := business.WorkloadCriteria{
		Cluster:               cluster,
		Namespace:             namespace,
		WorkloadName:          workload,
		WorkloadGVK:           schema.GroupVersionKind{Group: "", Version: "", Kind: ""},
		IncludeHealth:         false,
		IncludeIstioResources: false,
		IncludeServices:       false,
		QueryTime:             util.Clock.Now(),
		RateInterval:          "10m",
	}
	wk, err := businessLayer.Workload.GetWorkload(r.Context(), criteria)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return "", nil, err.Error(), http.StatusNotFound, err
		}
		return "", nil, err.Error(), http.StatusInternalServerError, err
	}
	if wk == nil || len(wk.Pods) == 0 {
		return "", nil, "workload has no pods", http.StatusNotFound, nil
	}

	// Prefer a Running pod that is not "proxy-only" (i.e. has at least one non-proxy container).
	for _, p := range wk.Pods {
		if p != nil && strings.EqualFold(p.Status, "Running") && hasNonProxyContainers(p) {
			return p.Name, p, "", http.StatusOK, nil
		}
	}
	// Next, any Running pod.
	for _, p := range wk.Pods {
		if p != nil && strings.EqualFold(p.Status, "Running") {
			return p.Name, p, "", http.StatusOK, nil
		}
	}
	// Next, any pod with non-proxy containers.
	for _, p := range wk.Pods {
		if p != nil && hasNonProxyContainers(p) {
			return p.Name, p, "", http.StatusOK, nil
		}
	}
	// Otherwise first pod.
	for _, p := range wk.Pods {
		if p != nil && p.Name != "" {
			return p.Name, p, "", http.StatusOK, nil
		}
	}
	return "", nil, "workload pods are empty", http.StatusNotFound, nil
}

func hasNonProxyContainers(pod *models.Pod) bool {
	if pod == nil {
		return false
	}
	for _, c := range pod.Containers {
		if c != nil && c.Name != "" && c.Name != models.IstioProxy {
			return true
		}
	}
	return false
}

func filterEntriesBySeverity(entries []podLogEntry, severities []string) []podLogEntry {
	wantError := slices.Contains(severities, "ERROR")
	wantWarn := slices.Contains(severities, "WARN")

	out := make([]podLogEntry, 0, len(entries))
	for _, e := range entries {
		sev := strings.ToUpper(strings.TrimSpace(e.Severity))
		if wantError && sev == "ERROR" {
			out = append(out, e)
			continue
		}
		if wantWarn && (sev == "WARN" || sev == "WARNING") {
			out = append(out, e)
			continue
		}
	}
	return out
}

func entriesToLines(entries []podLogEntry) []string {
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		msg := strings.TrimRight(e.Message, " \t")
		ts := strings.TrimSpace(e.Timestamp)
		switch {
		case ts != "" && msg != "":
			out = append(out, ts+" "+msg)
		case msg != "":
			out = append(out, msg)
		case ts != "":
			out = append(out, ts)
		}
	}
	return out
}

func normalizeSeverities(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '|' || r == ' ' || r == ';'
	})
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		up := strings.ToUpper(strings.TrimSpace(p))
		switch up {
		case "ERROR", "ERR":
			up = "ERROR"
		case "WARN", "WARNING":
			up = "WARN"
		default:
			continue
		}
		if !slices.Contains(out, up) {
			out = append(out, up)
		}
	}
	slices.Sort(out)
	return out
}

func allContainerNames(pod *models.Pod) []string {
	out := make([]string, 0, len(pod.Containers)+len(pod.IstioContainers)+len(pod.IstioInitContainers))
	for _, c := range pod.Containers {
		if c != nil && c.Name != "" {
			out = append(out, c.Name)
		}
	}
	for _, c := range pod.IstioContainers {
		if c != nil && c.Name != "" {
			out = append(out, c.Name)
		}
	}
	for _, c := range pod.IstioInitContainers {
		if c != nil && c.Name != "" {
			out = append(out, c.Name)
		}
	}
	return out
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
