package get_traces

// GetTracesResponse is a human-oriented summary of a trace intended for LLM consumption.
// It is intentionally compact: the model can request the full trace via trace_id if needed.
type GetTracesResponse struct {
	Found   bool          `json:"found"`
	Query   GetTracesArgs `json:"query"`
	Summary *TraceSummary `json:"summary,omitempty"`
	TraceID string        `json:"trace_id,omitempty"`
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
