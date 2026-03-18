package list_traces

// GetTracesListResponse is the response for listing traces by namespace/service.
type GetTracesListResponse struct {
	Summary *TracesListSummary `json:"summary,omitempty"`
	Traces  []TraceListItem    `json:"traces,omitempty"`
}

// TracesListSummary aggregates list-level stats.
type TracesListSummary struct {
	Namespace     string  `json:"namespace"`
	Service       string  `json:"service"`
	TotalFound    int     `json:"total_found"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
}

// TraceListItem is a lightweight entry in the trace list (list_traces response).
type TraceListItem struct {
	ID             string  `json:"id"`
	DurationMs     float64 `json:"duration_ms"`
	SpansCount     int     `json:"spans_count"`
	RootOp         string  `json:"root_op"`
	SlowestService string  `json:"slowest_service"`
	HasErrors      bool    `json:"has_errors"`
}

// GetTracesArgs are the input parameters for list_traces (list by service only).
type GetTracesArgs struct {
	ClusterName     string `json:"cluster_name,omitempty"`
	ErrorOnly       bool   `json:"error_only,omitempty"`
	Limit           int    `json:"limit,omitempty"`
	LookbackSeconds int    `json:"lookback_seconds,omitempty"`
	Namespace       string `json:"namespace,omitempty"`
	ServiceName     string `json:"service_name,omitempty"`
}

// TraceSummary is the internal summary used to build TraceListItem for list_traces.
type TraceSummary struct {
	TraceID         string      `json:"trace_id,omitempty"`
	TotalDurationMs float64     `json:"total_duration_ms"`
	TotalSpans      int         `json:"total_spans"`
	Bottlenecks     []SpanBrief `json:"bottlenecks,omitempty"`
	ErrorSpans      []SpanBrief `json:"error_spans,omitempty"`
	RootSpans       []SpanBrief `json:"root_spans,omitempty"`
}

type SpanBrief struct {
	DurationMs    float64           `json:"duration_ms"`
	Operation     string            `json:"operation"`
	ParentSpanID  string            `json:"parent_span_id,omitempty"`
	Service       string            `json:"service,omitempty"`
	SpanID        string            `json:"span_id"`
	StartOffsetMs float64           `json:"start_offset_ms"`
	Tags          map[string]string `json:"tags,omitempty"`
}
