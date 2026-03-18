package get_trace_details

import (
	"net/http"
	"testing"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/config"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

func TestExecute_Validation(t *testing.T) {
	conf := config.NewConfig()
	req, _ := http.NewRequest("GET", "/", nil)

	// Missing trace_id
	argsEmpty := map[string]interface{}{}
	res, code := Execute(&mcputil.KialiInterface{Request: req, Conf: conf}, argsEmpty)
	if code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, code)
	}
	if res != "trace_id is required" {
		t.Errorf("expected validation message, got %v", res)
	}

}

func TestBuildHierarchy_EmptyTrace(t *testing.T) {
	trace := jaegerModels.Trace{Spans: nil}
	totalMs, root := buildHierarchy(trace)
	if totalMs != 0 || root != nil {
		t.Errorf("empty trace: expected totalMs=0 and root=nil, got totalMs=%f root=%+v", totalMs, root)
	}

	trace2 := jaegerModels.Trace{Spans: []jaegerModels.Span{}}
	totalMs2, root2 := buildHierarchy(trace2)
	if totalMs2 != 0 || root2 != nil {
		t.Errorf("empty spans: expected totalMs=0 and root=nil, got totalMs=%f root=%+v", totalMs2, root2)
	}
}

func TestBuildHierarchy_SingleSpan(t *testing.T) {
	trace := jaegerModels.Trace{
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"p1": {ServiceName: "productpage"},
		},
		Spans: []jaegerModels.Span{
			{
				SpanID:        "s1",
				OperationName: "GET /",
				ProcessID:     "p1",
				StartTime:     1000,
				Duration:      5000,
				Tags:          []jaegerModels.KeyValue{{Key: "http.status_code", Type: "string", Value: "200"}},
			},
		},
	}
	totalMs, root := buildHierarchy(trace)
	if totalMs != 5.0 {
		t.Errorf("expected totalMs=5.0, got %f", totalMs)
	}
	if root == nil {
		t.Fatal("expected non-nil root")
	}
	if root.Service != "productpage" || root.Op != "GET /" || root.DurationMs != 5.0 || root.Status != 200 {
		t.Errorf("unexpected root: service=%s op=%s duration_ms=%f status=%d", root.Service, root.Op, root.DurationMs, root.Status)
	}
	if root.OffsetMs != 0 {
		t.Errorf("root offset should be 0, got %f", root.OffsetMs)
	}
	if len(root.Calls) != 0 {
		t.Errorf("single span should have no calls, got %d", len(root.Calls))
	}
}

func TestBuildHierarchy_RootAndChildren(t *testing.T) {
	trace := jaegerModels.Trace{
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"p1": {ServiceName: "productpage-v1"},
			"p2": {ServiceName: "details-v1"},
			"p3": {ServiceName: "reviews-v3"},
		},
		Spans: []jaegerModels.Span{
			{
				SpanID:        "root",
				OperationName: "GET /productpage",
				ProcessID:     "p1",
				StartTime:     1000,
				Duration:      25480,
				Tags:          []jaegerModels.KeyValue{{Key: "http.status_code", Type: "string", Value: "200"}},
			},
			{
				SpanID:        "child1",
				OperationName: "GET",
				ProcessID:     "p2",
				StartTime:     3210,
				Duration:      1760,
				References:    []jaegerModels.Reference{{RefType: jaegerModels.ChildOf, SpanID: "root"}},
				Tags:          []jaegerModels.KeyValue{{Key: "http.status_code", Type: "string", Value: "200"}},
			},
			{
				SpanID:        "child2",
				OperationName: "GET",
				ProcessID:     "p3",
				StartTime:     7730,
				Duration:      15240,
				References:    []jaegerModels.Reference{{RefType: jaegerModels.ChildOf, SpanID: "root"}},
				Tags:          []jaegerModels.KeyValue{{Key: "http.status_code", Type: "string", Value: "200"}},
			},
		},
	}
	totalMs, root := buildHierarchy(trace)
	if totalMs < 25.0 || totalMs > 26.0 {
		t.Errorf("expected totalMs ~25.48, got %f", totalMs)
	}
	if root == nil {
		t.Fatal("expected non-nil root")
	}
	if root.Service != "productpage-v1" || root.Op != "GET /productpage" || root.Status != 200 {
		t.Errorf("unexpected root: %+v", root)
	}
	if len(root.Calls) != 2 {
		t.Fatalf("expected 2 children, got %d", len(root.Calls))
	}
	// Children sorted by start time: child1 (3.21ms) then child2 (7.73ms)
	if root.Calls[0].Service != "details-v1" || root.Calls[0].OffsetMs < 2.0 || root.Calls[0].OffsetMs < 0 {
		t.Errorf("first call: expected details-v1 with offset ~2.21, got service=%s offset_ms=%f", root.Calls[0].Service, root.Calls[0].OffsetMs)
	}
	if root.Calls[1].Service != "reviews-v3" || root.Calls[1].DurationMs < 15.0 {
		t.Errorf("second call: expected reviews-v3 duration ~15.24, got service=%s duration_ms=%f", root.Calls[1].Service, root.Calls[1].DurationMs)
	}
}

func TestBuildHierarchy_LeafWithTags(t *testing.T) {
	trace := jaegerModels.Trace{
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"p1": {ServiceName: "ratings"},
		},
		Spans: []jaegerModels.Span{
			{
				SpanID:        "root",
				OperationName: "GET",
				ProcessID:     "p1",
				StartTime:     1000,
				Duration:      1640,
				Tags: []jaegerModels.KeyValue{
					{Key: "db.type", Type: "string", Value: "mysql"},
					{Key: "db.statement", Type: "string", Value: "SELECT * FROM ratings"},
				},
			},
		},
	}
	_, root := buildHierarchy(trace)
	if root == nil {
		t.Fatal("expected non-nil root")
	}
	if root.Tags == nil {
		t.Fatal("leaf with db tags should have Tags set")
	}
	if root.Tags["db.type"] != "mysql" || root.Tags["db.statement"] != "SELECT * FROM ratings" {
		t.Errorf("unexpected tags: %+v", root.Tags)
	}
}

func TestBuildHierarchy_MultipleRoots_PicksEarliestByStartTime(t *testing.T) {
	// Two root spans; implementation picks the one with earliest StartTime
	trace := jaegerModels.Trace{
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"p1": {ServiceName: "later"},
			"p2": {ServiceName: "earlier"},
		},
		Spans: []jaegerModels.Span{
			{SpanID: "r2", OperationName: "OP2", ProcessID: "p1", StartTime: 5000, Duration: 1000},
			{SpanID: "r1", OperationName: "OP1", ProcessID: "p2", StartTime: 1000, Duration: 500},
		},
	}
	_, root := buildHierarchy(trace)
	if root == nil {
		t.Fatal("expected non-nil root")
	}
	if root.Service != "earlier" {
		t.Errorf("expected root to be earlier (earliest start time), got service=%s", root.Service)
	}
	if root.Op != "OP1" {
		t.Errorf("expected root op OP1, got %s", root.Op)
	}
}

func TestSpanKindToDirection(t *testing.T) {
	tests := []struct {
		tagValue string
		want     string
	}{
		{"server", "inbound"},
		{"Server", "inbound"},
		{"client", "outbound"},
		{"CLIENT", "outbound"},
		{"", ""},
		{"internal", ""},
	}
	for _, tt := range tests {
		s := &jaegerModels.Span{}
		if tt.tagValue != "" {
			s.Tags = []jaegerModels.KeyValue{{Key: "span.kind", Type: "string", Value: tt.tagValue}}
		}
		got := spanKindToDirection(s)
		if got != tt.want {
			t.Errorf("span.kind=%q: got %q, want %q", tt.tagValue, got, tt.want)
		}
	}
}

func TestBuildHierarchy_DirectionFromSpanKind(t *testing.T) {
	// Simulate sidecar: root (server/inbound), child (client/outbound) same service
	trace := jaegerModels.Trace{
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"p1": {ServiceName: "productpage"},
		},
		Spans: []jaegerModels.Span{
			{
				SpanID:        "root",
				OperationName: "GET /productpage",
				ProcessID:     "p1",
				StartTime:     1000,
				Duration:      10000,
				Tags:          []jaegerModels.KeyValue{{Key: "span.kind", Type: "string", Value: "server"}},
			},
			{
				SpanID:        "child",
				OperationName: "HTTP GET",
				ProcessID:     "p1",
				StartTime:     2000,
				Duration:      5000,
				References:    []jaegerModels.Reference{{RefType: jaegerModels.ChildOf, SpanID: "root"}},
				Tags:          []jaegerModels.KeyValue{{Key: "span.kind", Type: "string", Value: "client"}},
			},
		},
	}
	_, root := buildHierarchy(trace)
	if root == nil {
		t.Fatal("expected non-nil root")
	}
	if root.Direction != "inbound" {
		t.Errorf("root (server) expected direction=inbound, got %q", root.Direction)
	}
	if len(root.Calls) != 1 {
		t.Fatalf("expected 1 call, got %d", len(root.Calls))
	}
	if root.Calls[0].Direction != "outbound" {
		t.Errorf("child (client) expected direction=outbound, got %q", root.Calls[0].Direction)
	}
}

func TestGetParentSpanID(t *testing.T) {
	// Prefer References.ChildOf over ParentSpanID
	s1 := &jaegerModels.Span{
		ParentSpanID: "legacy",
		References:   []jaegerModels.Reference{{RefType: jaegerModels.ChildOf, SpanID: "ref"}},
	}
	if getParentSpanID(s1) != "ref" {
		t.Errorf("expected parent from References, got %s", getParentSpanID(s1))
	}

	s2 := &jaegerModels.Span{ParentSpanID: "legacy"}
	if getParentSpanID(s2) != "legacy" {
		t.Errorf("expected parent from ParentSpanID, got %s", getParentSpanID(s2))
	}

	s3 := &jaegerModels.Span{}
	if getParentSpanID(s3) != "" {
		t.Errorf("expected empty parent, got %s", getParentSpanID(s3))
	}
}
