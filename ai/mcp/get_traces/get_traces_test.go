package get_traces

import (
	"testing"

	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

func TestSummarizeTrace_BottlenecksAndErrorChain(t *testing.T) {
	trace := jaegerModels.Trace{
		TraceID: "trace-1",
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"p1": {ServiceName: "frontend"},
			"p2": {ServiceName: "backend"},
		},
		Spans: []jaegerModels.Span{
			{
				SpanID:        "root-a",
				OperationName: "GET /",
				ProcessID:     "p1",
				StartTime:     1000,
				Duration:      1000,
			},
			{
				SpanID:        "child-b",
				OperationName: "SELECT",
				ProcessID:     "p2",
				StartTime:     1200,
				Duration:      500,
				References: []jaegerModels.Reference{
					{RefType: jaegerModels.ChildOf, SpanID: "root-a"},
				},
				Tags: []jaegerModels.KeyValue{
					{Key: "error", Type: "bool", Value: true},
					{Key: "http.status_code", Type: "string", Value: "500"},
				},
			},
			{
				SpanID:        "root-c",
				OperationName: "POST /checkout",
				ProcessID:     "p1",
				StartTime:     2000,
				Duration:      2500,
			},
		},
	}

	s := summarizeTrace(trace, 10)

	if s.TotalSpans != 3 {
		t.Fatalf("expected TotalSpans=3, got %d", s.TotalSpans)
	}
	if len(s.Bottlenecks) == 0 || s.Bottlenecks[0].SpanID != "root-c" {
		t.Fatalf("expected bottleneck root-c first, got %+v", s.Bottlenecks)
	}
	if len(s.ErrorSpans) != 1 || s.ErrorSpans[0].SpanID != "child-b" {
		t.Fatalf("expected exactly one error span child-b, got %+v", s.ErrorSpans)
	}
	if len(s.ErrorChain) != 2 || s.ErrorChain[0].SpanID != "root-a" || s.ErrorChain[1].SpanID != "child-b" {
		t.Fatalf("expected error chain root-a -> child-b, got %+v", s.ErrorChain)
	}
	if s.ErrorChain[1].Service != "backend" {
		t.Fatalf("expected error chain leaf service=backend, got %q", s.ErrorChain[1].Service)
	}
}
