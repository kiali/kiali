package get_trace_details

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/models"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

func Execute(
	kialiInterface *mcputil.KialiInterface,
	args map[string]interface{},
) (interface{}, int) {
	traceID := mcputil.GetStringArg(args, "trace_id", "traceId")
	if traceID == "" {
		return "trace_id is required", http.StatusBadRequest
	}
	if !models.ValidTraceIDRe.MatchString(traceID) {
		return "Invalid trace_id format: must be 1-32 hex characters", http.StatusBadRequest
	}

	ctx := kialiInterface.Request.Context()
	trace, err := kialiInterface.BusinessLayer.Tracing.GetTraceDetail(ctx, traceID)
	if err != nil {
		return err.Error(), http.StatusServiceUnavailable
	}
	if trace == nil {
		return "Trace not found", http.StatusNotFound
	}
	if len(trace.Data.Spans) == 0 && len(trace.Errors) > 0 {
		return "Trace not found", http.StatusNotFound
	}

	totalMs, hierarchy := buildHierarchy(trace.Data)
	return GetTraceDetailResponse{
		TraceID:   traceID,
		TotalMs:   totalMs,
		Hierarchy: hierarchy,
	}, http.StatusOK
}

func buildHierarchy(trace jaegerModels.Trace) (totalMs float64, root *HierarchyNode) {
	if len(trace.Spans) == 0 {
		return 0, nil
	}

	byID := make(map[string]*jaegerModels.Span, len(trace.Spans))
	for i := range trace.Spans {
		byID[string(trace.Spans[i].SpanID)] = &trace.Spans[i]
	}

	childrenByParent := make(map[string][]*jaegerModels.Span)
	for i := range trace.Spans {
		s := &trace.Spans[i]
		parentID := getParentSpanID(s)
		childrenByParent[parentID] = append(childrenByParent[parentID], s)
	}

	var minStart, maxEnd uint64
	minStart = trace.Spans[0].StartTime
	maxEnd = trace.Spans[0].StartTime + trace.Spans[0].Duration
	for _, s := range trace.Spans {
		if s.StartTime < minStart {
			minStart = s.StartTime
		}
		if end := s.StartTime + s.Duration; end > maxEnd {
			maxEnd = end
		}
	}
	if maxEnd >= minStart {
		totalMs = float64(maxEnd-minStart) / 1000.0
	}

	roots := childrenByParent[""]
	if len(roots) == 0 {
		return totalMs, nil
	}
	// Single root or pick first by start time
	rootSpan := roots[0]
	for _, s := range roots[1:] {
		if s.StartTime < rootSpan.StartTime {
			rootSpan = s
		}
	}

	root = spanToNode(trace, rootSpan, minStart, byID, childrenByParent)
	return totalMs, root
}

func getParentSpanID(s *jaegerModels.Span) string {
	for _, ref := range s.References {
		if ref.RefType == jaegerModels.ChildOf && string(ref.SpanID) != "" {
			return string(ref.SpanID)
		}
	}
	if string(s.ParentSpanID) != "" {
		return string(s.ParentSpanID)
	}
	return ""
}

func spanToNode(trace jaegerModels.Trace, s *jaegerModels.Span, baseStart uint64, byID map[string]*jaegerModels.Span, childrenByParent map[string][]*jaegerModels.Span) *HierarchyNode {
	service := spanServiceName(trace, s)
	op := s.OperationName
	durationMs := float64(s.Duration) / 1000.0
	offsetMs := float64(s.StartTime-baseStart) / 1000.0
	status := spanStatus(s)
	direction := spanKindToDirection(s)

	node := &HierarchyNode{
		Service:    service,
		Op:         op,
		DurationMs: durationMs,
		OffsetMs:   offsetMs,
		Status:     status,
		Direction:  direction,
	}

	childSpans := childrenByParent[string(s.SpanID)]
	if len(childSpans) > 0 {
		// Sort by start time
		for i := 0; i < len(childSpans); i++ {
			for j := i + 1; j < len(childSpans); j++ {
				if childSpans[j].StartTime < childSpans[i].StartTime {
					childSpans[i], childSpans[j] = childSpans[j], childSpans[i]
				}
			}
		}
		node.Calls = make([]HierarchyNode, 0, len(childSpans))
		for _, ch := range childSpans {
			chNode := spanToNode(trace, ch, baseStart, byID, childrenByParent)
			node.Calls = append(node.Calls, *chNode)
		}
	} else {
		// Leaf: optionally add interesting tags
		tags := interestingTags(s)
		if len(tags) > 0 {
			node.Tags = tags
		}
	}
	return node
}

// spanKindToDirection maps OpenTracing/Envoy span.kind (client/server) to inbound/outbound
// so the AI can tell sidecar hops: same service with outbound then inbound = proxy -> app.
func spanKindToDirection(span *jaegerModels.Span) string {
	if span == nil {
		return ""
	}
	for _, kv := range span.Tags {
		if kv.Key != "span.kind" {
			continue
		}
		s := strings.TrimSpace(strings.ToLower(mcputil.AsString(kv.Value)))
		switch s {
		case "server":
			return "inbound"
		case "client":
			return "outbound"
		}
	}
	return ""
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

func spanStatus(span *jaegerModels.Span) int {
	if span == nil {
		return 0
	}
	for _, kv := range span.Tags {
		if kv.Key == "http.status_code" {
			return tagToInt(kv.Value)
		}
	}
	for _, kv := range span.Tags {
		if kv.Key == "grpc.status_code" {
			return tagToInt(kv.Value)
		}
	}
	return 0
}

func tagToInt(v interface{}) int {
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	case int64:
		return int(x)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(x))
		return i
	default:
		i, _ := strconv.Atoi(strings.TrimSpace(mcputil.AsString(v)))
		return i
	}
}

func interestingTags(span *jaegerModels.Span) map[string]string {
	if span == nil {
		return nil
	}
	allow := map[string]bool{
		"db.type": true, "sql.query": true, "db.statement": true,
		"http.method": true, "http.status_code": true,
		"grpc.status_code": true, "component": true,
	}
	out := make(map[string]string)
	for _, kv := range span.Tags {
		if allow[kv.Key] {
			out[kv.Key] = mcputil.AsString(kv.Value)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
