package get_traces

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/util"
)

const (
	defaultLimit           = 10
	defaultLookbackSeconds = 600 // 10m
	defaultMaxSpans        = 7
)

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
	parsed := parseArgs(args, conf)

	if parsed.TraceID == "" && (parsed.Namespace == "" || parsed.ServiceName == "") {
		return "Either trace_id or (namespace + service_name) is required", http.StatusBadRequest
	}

	ctx := r.Context()

	traceID := parsed.TraceID
	if traceID == "" {
		q := buildServiceQuery(parsed, conf, true)
		traces, err := businessLayer.Tracing.GetServiceTraces(ctx, parsed.Namespace, parsed.ServiceName, q)
		if err != nil {
			return err.Error(), http.StatusServiceUnavailable
		}
		// Some tracing backends/instrumentations don't set error=true even when HTTP 5xx exists.
		// If user asked for error_only and got nothing, fallback to a broader search and filter locally.
		if (traces == nil || len(traces.Data) == 0) && parsed.ErrorOnly {
			q2 := buildServiceQuery(parsed, conf, false)
			traces2, err2 := businessLayer.Tracing.GetServiceTraces(ctx, parsed.Namespace, parsed.ServiceName, q2)
			if err2 != nil {
				return err2.Error(), http.StatusServiceUnavailable
			}
			if traces2 != nil && len(traces2.Data) > 0 {
				traces2.Data = filterTracesWithErrorIndicators(traces2.Data)
				traces = traces2
			}
		}

		if traces == nil || len(traces.Data) == 0 {
			return GetTracesResponse{Found: false, Query: parsed}, http.StatusOK
		}
		best := pickBestTrace(traces.Data, parsed.ErrorOnly)
		traceID = string(best.TraceID)
	}

	trace, err := businessLayer.Tracing.GetTraceDetail(ctx, traceID)
	if err != nil {
		return err.Error(), http.StatusServiceUnavailable
	}
	if trace == nil {
		return "Trace not found", http.StatusNotFound
	}

	// Some clients return an object with errors and no data when not found. Keep the 404 semantics.
	if len(trace.Data.Spans) == 0 && len(trace.Errors) > 0 {
		return "Trace not found", http.StatusNotFound
	}

	summary := summarizeTrace(trace.Data, parsed.MaxSpans)

	resp := GetTracesResponse{
		Found:   true,
		Query:   parsed,
		Summary: &summary,
		TraceID: traceID,
	}

	return resp, http.StatusOK
}

func parseArgs(args map[string]interface{}, conf *config.Config) GetTracesArgs {
	out := GetTracesArgs{
		Limit:           defaultLimit,
		LookbackSeconds: defaultLookbackSeconds,
		MaxSpans:        defaultMaxSpans,
	}

	out.TraceID = strings.TrimSpace(asString(args["trace_id"]))
	out.Namespace = strings.TrimSpace(asString(args["namespace"]))
	out.ServiceName = strings.TrimSpace(asString(args["service_name"]))
	out.ClusterName = strings.TrimSpace(asString(args["cluster_name"]))
	out.ErrorOnly = asBool(args["error_only"])

	if v := asInt(args["limit"]); v > 0 {
		out.Limit = v
	}
	if v := asInt(args["lookback_seconds"]); v > 0 {
		out.LookbackSeconds = v
	}
	if v := asInt(args["max_spans"]); v > 0 {
		out.MaxSpans = v
	}

	if out.ClusterName == "" && conf != nil {
		out.ClusterName = conf.KubernetesConfig.ClusterName
	}

	return out
}

func buildServiceQuery(args GetTracesArgs, conf *config.Config, includeErrorTag bool) models.TracingQuery {
	now := util.Clock.Now()
	q := models.TracingQuery{
		Start:   now.Add(-time.Duration(args.LookbackSeconds) * time.Second),
		End:     now,
		Limit:   args.Limit,
		Tags:    make(map[string]string),
		Cluster: args.ClusterName,
	}

	// Respect configured query scope tags (e.g. to filter by mesh/tenant).
	if conf != nil {
		for k, v := range conf.ExternalServices.Tracing.QueryScope {
			q.Tags[k] = v
		}
	}

	// Tracing multi-cluster filter uses the cluster tag.
	if q.Tags != nil {
		q.Tags[models.IstioClusterTag] = args.ClusterName
	}

	if args.ErrorOnly && includeErrorTag {
		q.Tags["error"] = "true"
	}

	return q
}

func pickBestTrace(traces []jaegerModels.Trace, errorOnly bool) jaegerModels.Trace {
	if len(traces) == 0 {
		return jaegerModels.Trace{}
	}

	candidates := traces
	if !errorOnly {
		withErr := make([]jaegerModels.Trace, 0, len(traces))
		for _, t := range traces {
			if estimateErrorSpans(t) > 0 {
				withErr = append(withErr, t)
			}
		}
		if len(withErr) > 0 {
			candidates = withErr
		}
	}

	best := candidates[0]
	bestDur := estimateTraceDurationMicros(best)
	for _, t := range candidates[1:] {
		d := estimateTraceDurationMicros(t)
		if d > bestDur {
			best = t
			bestDur = d
		}
	}
	return best
}

func estimateTraceDurationMicros(trace jaegerModels.Trace) uint64 {
	if len(trace.Spans) == 0 {
		return 0
	}
	minStart := trace.Spans[0].StartTime
	maxEnd := trace.Spans[0].StartTime + trace.Spans[0].Duration
	for _, s := range trace.Spans[1:] {
		if s.StartTime < minStart {
			minStart = s.StartTime
		}
		if end := s.StartTime + s.Duration; end > maxEnd {
			maxEnd = end
		}
	}
	if maxEnd < minStart {
		return 0
	}
	return maxEnd - minStart
}

func estimateErrorSpans(trace jaegerModels.Trace) int {
	count := 0
	for _, s := range trace.Spans {
		if isErrorSpan(&s) {
			count++
		}
	}
	return count
}

func filterTracesWithErrorIndicators(traces []jaegerModels.Trace) []jaegerModels.Trace {
	out := make([]jaegerModels.Trace, 0, len(traces))
	for _, t := range traces {
		if traceHasErrorIndicators(t) {
			out = append(out, t)
		}
	}
	return out
}

func traceHasErrorIndicators(trace jaegerModels.Trace) bool {
	for i := range trace.Spans {
		s := &trace.Spans[i]
		if isErrorSpan(s) {
			return true
		}
		if isHTTPErrorSpan(s) {
			return true
		}
		if isGRPCErrorSpan(s) {
			return true
		}
		if hasNonEmptyTag(s, "response_flags") {
			// Istio fault-injection often sets response_flags like "FI".
			return true
		}
		if hasTagValueEqualFold(s, "status", "error") {
			return true
		}
	}
	return false
}

func summarizeTrace(trace jaegerModels.Trace, maxSpans int) TraceSummary {
	if maxSpans <= 0 {
		maxSpans = defaultMaxSpans
	}

	byID := make(map[string]*jaegerModels.Span, len(trace.Spans))
	for i := range trace.Spans {
		s := &trace.Spans[i]
		byID[string(s.SpanID)] = s
	}

	// Determine parent pointers using References (preferred) or ParentSpanID.
	parentByID := make(map[string]string, len(trace.Spans))
	for _, s := range trace.Spans {
		spanID := string(s.SpanID)
		parent := ""
		for _, ref := range s.References {
			if ref.RefType == jaegerModels.ChildOf && string(ref.SpanID) != "" {
				parent = string(ref.SpanID)
				break
			}
		}
		if parent == "" && string(s.ParentSpanID) != "" {
			parent = string(s.ParentSpanID)
		}
		if parent != "" {
			parentByID[spanID] = parent
		}
	}

	// Find global start for offsets and total duration.
	var (
		minStart uint64
		maxEnd   uint64
	)
	if len(trace.Spans) > 0 {
		minStart = trace.Spans[0].StartTime
		maxEnd = trace.Spans[0].StartTime + trace.Spans[0].Duration
		for _, s := range trace.Spans[1:] {
			if s.StartTime < minStart {
				minStart = s.StartTime
			}
			if end := s.StartTime + s.Duration; end > maxEnd {
				maxEnd = end
			}
		}
	}

	briefs := make([]SpanBrief, 0, len(trace.Spans))
	rootSpans := make([]SpanBrief, 0)
	errorSpans := make([]SpanBrief, 0)

	for _, s := range trace.Spans {
		spanID := string(s.SpanID)
		parent := parentByID[spanID]

		service := spanServiceName(trace, &s)
		brief := SpanBrief{
			DurationMs:    float64(s.Duration) / 1000.0,
			Operation:     s.OperationName,
			ParentSpanID:  parent,
			Service:       service,
			SpanID:        spanID,
			StartOffsetMs: float64(s.StartTime-minStart) / 1000.0,
			Tags:          interestingTags(&s),
		}

		briefs = append(briefs, brief)
		if parent == "" || byID[parent] == nil {
			rootSpans = append(rootSpans, brief)
		}
		if isErrorSpan(&s) {
			errorSpans = append(errorSpans, brief)
		}
	}

	sort.Slice(rootSpans, func(i, j int) bool { return rootSpans[i].StartOffsetMs < rootSpans[j].StartOffsetMs })

	sort.Slice(briefs, func(i, j int) bool { return briefs[i].DurationMs > briefs[j].DurationMs })
	bottlenecks := takeFirst(briefs, maxSpans)

	sort.Slice(errorSpans, func(i, j int) bool { return errorSpans[i].DurationMs > errorSpans[j].DurationMs })
	errorSpans = takeFirst(errorSpans, maxSpans)

	var chain []SpanBrief
	if len(errorSpans) > 0 {
		chain = buildAncestorChain(trace, byID, parentByID, errorSpans[0].SpanID, minStart)
	}

	warnings := make([]string, 0, len(trace.Warnings))
	for _, w := range trace.Warnings {
		if strings.TrimSpace(w) != "" {
			warnings = append(warnings, w)
		}
	}

	totalDurationMs := 0.0
	if maxEnd >= minStart {
		totalDurationMs = float64(maxEnd-minStart) / 1000.0
	}

	return TraceSummary{
		TotalDurationMs: totalDurationMs,
		TotalSpans:      len(trace.Spans),
		Bottlenecks:     bottlenecks,
		ErrorChain:      chain,
		ErrorSpans:      errorSpans,
		RootSpans:       takeFirst(rootSpans, maxSpans),
		Warnings:        warnings,
	}
}

func buildAncestorChain(trace jaegerModels.Trace, byID map[string]*jaegerModels.Span, parentByID map[string]string, spanID string, baseStart uint64) []SpanBrief {
	chain := make([]SpanBrief, 0, 8)
	seen := make(map[string]bool, 8)

	curr := spanID
	for curr != "" && !seen[curr] {
		seen[curr] = true

		s := byID[curr]
		if s == nil {
			break
		}

		parent := parentByID[curr]
		chain = append(chain, SpanBrief{
			DurationMs:    float64(s.Duration) / 1000.0,
			Operation:     s.OperationName,
			ParentSpanID:  parent,
			Service:       spanServiceName(trace, s),
			SpanID:        curr,
			StartOffsetMs: float64(s.StartTime-baseStart) / 1000.0,
			Tags:          interestingTags(s),
		})

		curr = parent
	}

	// Reverse into root -> leaf.
	for i, j := 0, len(chain)-1; i < j; i, j = i+1, j-1 {
		chain[i], chain[j] = chain[j], chain[i]
	}

	return chain
}

func spanServiceName(trace jaegerModels.Trace, span *jaegerModels.Span) string {
	if span == nil {
		return ""
	}
	if span.Process != nil {
		return span.Process.ServiceName
	}
	if p, ok := trace.Processes[span.ProcessID]; ok {
		return p.ServiceName
	}
	return ""
}

func isErrorSpan(span *jaegerModels.Span) bool {
	if span == nil {
		return false
	}
	for _, kv := range span.Tags {
		if kv.Key != "error" {
			continue
		}
		switch v := kv.Value.(type) {
		case bool:
			return v
		case string:
			return strings.EqualFold(v, "true")
		default:
			// fallthrough: unknown type, best-effort string conversion
			return strings.EqualFold(asString(kv.Value), "true")
		}
	}
	return false
}

func isHTTPErrorSpan(span *jaegerModels.Span) bool {
	if span == nil {
		return false
	}
	for _, kv := range span.Tags {
		if kv.Key != "http.status_code" {
			continue
		}
		switch v := kv.Value.(type) {
		case float64:
			return int(v) >= 400
		case int:
			return v >= 400
		case int64:
			return v >= 400
		case uint64:
			return v >= 400
		case string:
			i, err := strconv.Atoi(strings.TrimSpace(v))
			return err == nil && i >= 400
		default:
			i, err := strconv.Atoi(strings.TrimSpace(asString(v)))
			return err == nil && i >= 400
		}
	}
	return false
}

func isGRPCErrorSpan(span *jaegerModels.Span) bool {
	if span == nil {
		return false
	}
	for _, kv := range span.Tags {
		if kv.Key != "grpc.status_code" {
			continue
		}
		switch v := kv.Value.(type) {
		case float64:
			return int(v) != 0
		case int:
			return v != 0
		case int64:
			return v != 0
		case uint64:
			return v != 0
		case string:
			s := strings.TrimSpace(v)
			if s == "" {
				return false
			}
			// Common string forms: "OK", "0", "Unknown", "2", etc.
			if strings.EqualFold(s, "ok") || s == "0" {
				return false
			}
			if i, err := strconv.Atoi(s); err == nil {
				return i != 0
			}
			return true
		default:
			s := strings.TrimSpace(asString(v))
			if strings.EqualFold(s, "ok") || s == "0" {
				return false
			}
			if i, err := strconv.Atoi(s); err == nil {
				return i != 0
			}
			return s != ""
		}
	}
	return false
}

func hasNonEmptyTag(span *jaegerModels.Span, key string) bool {
	if span == nil {
		return false
	}
	for _, kv := range span.Tags {
		if kv.Key == key && strings.TrimSpace(asString(kv.Value)) != "" {
			return true
		}
	}
	return false
}

func hasTagValueEqualFold(span *jaegerModels.Span, key, want string) bool {
	if span == nil {
		return false
	}
	for _, kv := range span.Tags {
		if kv.Key == key && strings.EqualFold(strings.TrimSpace(asString(kv.Value)), want) {
			return true
		}
	}
	return false
}

func interestingTags(span *jaegerModels.Span) map[string]string {
	if span == nil {
		return nil
	}

	allow := map[string]bool{
		"component":        true,
		"error":            true,
		"grpc.status_code": true,
		"http.method":      true,
		"http.status_code": true,
		"node_id":          true,
		"peer.service":     true,
		"response_flags":   true,
		"status":           true,
		"upstream_cluster": true,
	}

	out := map[string]string{}
	for _, kv := range span.Tags {
		if !allow[kv.Key] {
			continue
		}
		out[kv.Key] = asString(kv.Value)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func takeFirst[T any](in []T, n int) []T {
	if n <= 0 || len(in) == 0 {
		return nil
	}
	if len(in) <= n {
		return in
	}
	return in[:n]
}

func asString(v interface{}) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case []byte:
		return string(t)
	case fmt.Stringer:
		return t.String()
	case float64:
		// Common for JSON numbers.
		return strconv.FormatFloat(t, 'f', -1, 64)
	case int:
		return strconv.Itoa(t)
	case int64:
		return strconv.FormatInt(t, 10)
	case uint64:
		return strconv.FormatUint(t, 10)
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", t))
	}
}

func asBool(v interface{}) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		b, err := strconv.ParseBool(strings.TrimSpace(t))
		return err == nil && b
	default:
		return false
	}
}

func asInt(v interface{}) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	case string:
		i, err := strconv.Atoi(strings.TrimSpace(t))
		if err == nil {
			return i
		}
		return 0
	default:
		return 0
	}
}
