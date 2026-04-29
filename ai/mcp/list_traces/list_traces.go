package list_traces

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/util"
)

func Execute(
	kialiInterface *mcputil.KialiInterface,
	args map[string]interface{},
) (interface{}, int) {
	parsed := parseArgs(args, kialiInterface.Conf)
	ctx := kialiInterface.Request.Context()

	if parsed.Namespace == "" || parsed.ServiceName == "" {
		return "namespace and serviceName are required", http.StatusBadRequest
	}

	if nsErrMsg, nsCode := mcputil.ValidateNamespaceAccess(ctx, kialiInterface.BusinessLayer, parsed.Namespace, parsed.ClusterName); nsErrMsg != "" {
		return nsErrMsg + fmt.Sprintf(" Cannot retrieve traces for service %q.", parsed.ServiceName), nsCode
	}

	conf := kialiInterface.Conf
	q := buildServiceQuery(parsed, conf, true)
	traces, err := kialiInterface.BusinessLayer.Tracing.GetServiceTraces(ctx, parsed.Namespace, parsed.ServiceName, q)

	if err != nil {
		return err.Error(), http.StatusServiceUnavailable
	}

	if (traces == nil || len(traces.Data) == 0) && parsed.ErrorOnly {
		q2 := buildServiceQuery(parsed, conf, false)
		traces2, err2 := kialiInterface.BusinessLayer.Tracing.GetServiceTraces(ctx, parsed.Namespace, parsed.ServiceName, q2)
		if err2 != nil {
			return err2.Error(), http.StatusServiceUnavailable
		}
		if traces2 != nil && len(traces2.Data) > 0 {
			traces2.Data = filterTracesWithErrorIndicators(traces2.Data)
			traces = traces2
		}
	}

	if traces == nil || len(traces.Data) == 0 {
		return GetTracesListResponse{
			Summary: &TracesListSummary{Namespace: parsed.Namespace, Service: parsed.ServiceName, TotalFound: 0},
			Traces:  nil,
		}, http.StatusOK
	}

	summaries := make([]TraceSummary, 0, len(traces.Data))
	for _, t := range traces.Data {
		traceDetail, err := kialiInterface.BusinessLayer.Tracing.GetTraceDetail(ctx, string(t.TraceID))
		if err != nil || traceDetail == nil {
			continue
		}
		if len(traceDetail.Data.Spans) == 0 {
			continue
		}
		summary := summarizeTrace(traceDetail.Data, 10)
		summary.TraceID = string(t.TraceID)
		summaries = append(summaries, summary)
	}

	if len(summaries) == 0 {
		return GetTracesListResponse{
			Summary: &TracesListSummary{Namespace: parsed.Namespace, Service: parsed.ServiceName, TotalFound: 0},
			Traces:  nil,
		}, http.StatusOK
	}

	items := make([]TraceListItem, 0, len(summaries))
	var sumDuration float64
	for _, s := range summaries {
		item := traceSummaryToListItem(s, parsed.Namespace)
		items = append(items, item)
		sumDuration += s.TotalDurationMs
	}
	avgMs := sumDuration / float64(len(summaries))
	return GetTracesListResponse{
		Summary: &TracesListSummary{
			Namespace:     parsed.Namespace,
			Service:       parsed.ServiceName,
			TotalFound:    len(items),
			AvgDurationMs: avgMs,
		},
		Traces: items,
	}, http.StatusOK
}

func traceSummaryToListItem(s TraceSummary, namespace string) TraceListItem {
	rootOp := ""
	if len(s.RootSpans) > 0 {
		r := s.RootSpans[0]
		status := ""
		if r.Tags != nil {
			if v := r.Tags["http.status_code"]; v != "" {
				status = v
			} else if v := r.Tags["grpc.status_code"]; v != "" {
				status = v
			}
		}
		rootOp = r.Service + " " + r.Operation
		if status != "" {
			rootOp += " " + status
		}
	}
	slowestService := ""
	if len(s.Bottlenecks) > 0 {
		b := s.Bottlenecks[0]
		// Avoid repeating namespace when service name already contains it (e.g. "productpage.bookinfo")
		label := b.Service
		if namespace != "" && !strings.Contains(b.Service, ".") {
			label = b.Service + "." + namespace
		}
		slowestService = label + " (" + strconv.FormatFloat(b.DurationMs, 'f', 1, 64) + "ms)"
	}
	return TraceListItem{
		ID:             s.TraceID,
		DurationMs:     s.TotalDurationMs,
		SpansCount:     s.TotalSpans,
		RootOp:         rootOp,
		SlowestService: slowestService,
		HasErrors:      len(s.ErrorSpans) > 0,
	}
}

func parseArgs(args map[string]interface{}, conf *config.Config) GetTracesArgs {
	out := GetTracesArgs{}

	out.Namespace = mcputil.GetStringArg(args, "namespace")
	out.ServiceName = mcputil.GetStringArg(args, "service_name", "serviceName")
	out.ClusterName = mcputil.GetStringOrDefault(args, conf.KubernetesConfig.ClusterName, "cluster_name", "clusterName")
	out.ErrorOnly = mcputil.AsBoolFromArgs(args, "errorOnly", "error_only")

	out.Limit = mcputil.AsIntOrDefault(args, mcputil.DefaultTracesLimit, "limit")
	if out.Limit > models.MaxTracingLimit {
		out.Limit = models.MaxTracingLimit
	}
	out.LookbackSeconds = mcputil.AsIntOrDefault(args, mcputil.DefaultLookbackSeconds, "lookback_seconds", "lookbackSeconds")

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

	totalDurationMs := 0.0
	if maxEnd >= minStart {
		totalDurationMs = float64(maxEnd-minStart) / 1000.0
	}

	return TraceSummary{
		TotalDurationMs: totalDurationMs,
		TotalSpans:      len(trace.Spans),
		Bottlenecks:     bottlenecks,
		ErrorSpans:      errorSpans,
		RootSpans:       takeFirst(rootSpans, maxSpans),
	}
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
			return strings.EqualFold(mcputil.AsString(kv.Value), "true")
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
			i, err := strconv.Atoi(strings.TrimSpace(mcputil.AsString(v)))
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
			s := strings.TrimSpace(mcputil.AsString(v))
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
		if kv.Key == key && strings.TrimSpace(mcputil.AsString(kv.Value)) != "" {
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
		if kv.Key == key && strings.EqualFold(strings.TrimSpace(mcputil.AsString(kv.Value)), want) {
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
		out[kv.Key] = mcputil.AsString(kv.Value)
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
