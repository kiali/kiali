package get_traces

import (
	"net/http"
	"testing"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/config"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

func TestParseArgs_Defaults(t *testing.T) {
	conf := config.NewConfig()
	args := map[string]interface{}{}

	parsed := parseArgs(args, conf)

	if parsed.LookbackSeconds != mcputil.DefaultLookbackSeconds {
		t.Errorf("expected LookbackSeconds=%d, got %d", mcputil.DefaultLookbackSeconds, parsed.LookbackSeconds)
	}
	if parsed.Limit != mcputil.DefaultTracesLimit {
		t.Errorf("expected Limit=%d, got %d", mcputil.DefaultTracesLimit, parsed.Limit)
	}
	if parsed.MaxSpans != mcputil.DefaultMaxSpans {
		t.Errorf("expected MaxSpans=%d, got %d", mcputil.DefaultMaxSpans, parsed.MaxSpans)
	}
}

func TestExecute_Validation(t *testing.T) {
	conf := config.NewConfig()

	// Test 1: Empty traceId, namespace, and serviceName
	args1 := map[string]interface{}{}
	req1, _ := http.NewRequest("GET", "/", nil)
	res1, code1 := Execute(req1, args1, nil, nil, nil, nil, conf, nil, nil, nil)

	if code1 != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, code1)
	}
	if res1 != "Either trace_id or (namespace + service_name) is required" {
		t.Errorf("expected validation error message, got %v", res1)
	}

	// Test 1b: traceId empty, namespace provided, serviceName empty
	args1b := map[string]interface{}{
		"namespace": "bookinfo",
	}
	_, code1b := Execute(req1, args1b, nil, nil, nil, nil, conf, nil, nil, nil)
	if code1b != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, code1b)
	}

	// Test 1c: traceId empty, namespace empty, serviceName provided
	args1c := map[string]interface{}{
		"service_name": "ratings",
	}
	_, code1c := Execute(req1, args1c, nil, nil, nil, nil, conf, nil, nil, nil)
	if code1c != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, code1c)
	}

	// Test 2: traceId provided, namespace and serviceName empty (should not hit the validation error)
	args2_correct := map[string]interface{}{
		"trace_id": "12345",
	}
	parsed2 := parseArgs(args2_correct, conf)
	// mcputil.GetStringArg might not be getting the snake_case properly if we didn't update it in get_traces.go
	if parsed2.TraceID != "12345" {
		t.Errorf("expected traceId 12345, got %s", parsed2.TraceID)
	}
	if parsed2.TraceID == "" && (parsed2.Namespace == "" || parsed2.ServiceName == "") {
		t.Errorf("should have passed validation")
	}

	// Test 3: namespace and serviceName provided, traceId empty (should not hit the validation error)
	args3 := map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "ratings",
	}
	parsed3 := parseArgs(args3, conf)
	if parsed3.Namespace != "bookinfo" || parsed3.ServiceName != "ratings" {
		t.Errorf("expected namespace bookinfo and service_name ratings, got %s and %s", parsed3.Namespace, parsed3.ServiceName)
	}
	if parsed3.TraceID == "" && (parsed3.Namespace == "" || parsed3.ServiceName == "") {
		t.Errorf("should have passed validation")
	}
}

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
