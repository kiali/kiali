package get_trace_details

// GetTraceDetailResponse is the response for a single trace detail (hierarchy view).
type GetTraceDetailResponse struct {
	TraceID   string         `json:"trace_id"`
	TotalMs   float64        `json:"total_ms"`
	Hierarchy *HierarchyNode `json:"hierarchy,omitempty"`
}

// HierarchyNode is a node in the trace call tree (root or child).
// When the same service appears twice in a row (e.g. productpage -> productpage -> details),
// direction indicates the sidecar proxy hop: outbound = proxy sending, inbound = service receiving.
type HierarchyNode struct {
	Service    string            `json:"service"`
	Op         string            `json:"op"`
	DurationMs float64           `json:"duration_ms"`
	Status     int               `json:"status"`              // HTTP/GRPC status; 0 if unknown
	Direction  string            `json:"direction,omitempty"` // "inbound" | "outbound" from span.kind (server|client); clarifies sidecar hops
	Calls      []HierarchyNode   `json:"calls,omitempty"`
	OffsetMs   float64           `json:"offset_ms,omitempty"` // Start offset from trace start
	Tags       map[string]string `json:"tags,omitempty"`      // Optional; often on leaf spans
}
