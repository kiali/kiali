package json

// OTEL

type ValueString struct {
	StringValue string `json:"stringValue"`
}

type Attribute struct {
	Key   string      `json:"key"`
	Value ValueString `json:"value"`
}

type Event struct {
	TimeUnixNano string `json:"timeUnixNano"`
	Name         string `json:"name"`
}

type Status struct {
	Code string `json:"code"`
}

type Span struct {
	TraceID           string      `json:"traceId"`
	SpanID            string      `json:"spanId"`
	Name              string      `json:"name"`
	Kind              string      `json:"kind"`
	StartTimeUnixNano string      `json:"startTimeUnixNano"`
	EndTimeUnixNano   string      `json:"endTimeUnixNano"`
	Attributes        []Attribute `json:"attributes"`
	Events            []Event     `json:"events"`
	Status            Status      `json:"status"`
	ParentSpanId      string      `json:"parentSpanId"`
}

type ScopeSpan struct {
	Scope struct{} `json:"scope"`
	Spans []Span   `json:"spans"`
}

type Resource struct {
	Attributes []Attribute `json:"attributes"`
}

type Batch struct {
	Resource   Resource    `json:"resource"`
	ScopeSpans []ScopeSpan `json:"scopeSpans"`
}

type Data struct {
	Batches []Batch `json:"batches"`
}
