package get_traces

// GetTracesResponse is a human-oriented summary of traces intended for LLM consumption.
// When searching by trace_id, returns a single trace summary.
// When searching by service, returns multiple trace summaries (up to limit).
type GetTracesResponse struct {
	Found   bool           `json:"found"`
	Query   GetTracesArgs  `json:"query"`
	Summary *TraceSummary  `json:"summary,omitempty"`  // Single trace (when trace_id provided)
	Traces  []TraceSummary `json:"traces,omitempty"`   // Multiple traces (when searching by service)
	TraceID string         `json:"trace_id,omitempty"` // Single trace ID (when trace_id provided)
}

// GetTracesArgs are the supported input parameters. This is echoed back in the response for transparency.
type GetTracesArgs struct {
	ClusterName     string `json:"cluster_name,omitempty"`
	ErrorOnly       bool   `json:"error_only,omitempty"`
	Limit           int    `json:"limit,omitempty"`
	LookbackSeconds int    `json:"lookback_seconds,omitempty"`
	MaxSpans        int    `json:"max_spans,omitempty"`
	Namespace       string `json:"namespace,omitempty"`
	ServiceName     string `json:"service_name,omitempty"`
	TraceID         string `json:"trace_id,omitempty"`
}

type TraceSummary struct {
	TraceID         string      `json:"trace_id,omitempty"`
	TotalDurationMs float64     `json:"total_duration_ms"`
	TotalSpans      int         `json:"total_spans"`
	Bottlenecks     []SpanBrief `json:"bottlenecks,omitempty"`
	ErrorChain      []SpanBrief `json:"error_chain,omitempty"`
	ErrorSpans      []SpanBrief `json:"error_spans,omitempty"`
	RootSpans       []SpanBrief `json:"root_spans,omitempty"`
	Warnings        []string    `json:"warnings,omitempty"`
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
