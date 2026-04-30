package list_traces

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing"
	tracingModel "github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/util"
)

type fakeTracingClient struct {
	appTraces   *tracingModel.TracingResponse
	appErr      error
	traceDetail *tracingModel.TracingSingleTrace
	detailErr   error
}

func (f *fakeTracingClient) GetAppTraces(_ context.Context, _, _ string, _ models.TracingQuery) (*tracingModel.TracingResponse, error) {
	return f.appTraces, f.appErr
}

func (f *fakeTracingClient) GetTraceDetail(_ context.Context, _ string) (*tracingModel.TracingSingleTrace, error) {
	return f.traceDetail, f.detailErr
}

func (f *fakeTracingClient) GetErrorTraces(_ context.Context, _, _ string, _ time.Duration) (int, error) {
	return 0, nil
}

func (f *fakeTracingClient) GetServiceStatus(_ context.Context) (bool, error) {
	return true, nil
}

func (f *fakeTracingClient) GetServices(_ context.Context) ([]string, error) {
	return nil, nil
}

func newTestKialiInterface(t *testing.T, conf *config.Config, fake tracing.ClientInterface, extraObjs ...runtime.Object) *mcputil.KialiInterface {
	t.Helper()
	util.Clock = util.RealClock{}
	config.Set(conf)

	objs := []runtime.Object{kubetest.FakeNamespace("bookinfo")}
	objs = append(objs, extraObjs...)
	k8s := kubetest.NewFakeK8sClient(objs...)

	layer := business.NewLayerBuilder(t, conf).
		WithClient(k8s).
		WithTraceLoader(func() tracing.ClientInterface { return fake }).
		Build()
	req, _ := http.NewRequest("GET", "/", nil)
	return &mcputil.KialiInterface{
		Request:       req,
		BusinessLayer: layer,
		Conf:          conf,
	}
}

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
}

func TestParseArgs_ErrorOnlySnakeCase(t *testing.T) {
	conf := config.NewConfig()
	parsed := parseArgs(map[string]interface{}{"error_only": true}, conf)
	if !parsed.ErrorOnly {
		t.Error("expected ErrorOnly true when error_only is set")
	}
}

func TestExecute_Validation(t *testing.T) {
	conf := config.NewConfig()
	req1, _ := http.NewRequest("GET", "/", nil)

	// Missing namespace and service_name
	args1 := map[string]interface{}{}
	res1, code1 := Execute(&mcputil.KialiInterface{Request: req1, Conf: conf}, args1)
	if code1 != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, code1)
	}
	if res1 != "namespace and serviceName are required" {
		t.Errorf("expected validation error message, got %v", res1)
	}

	// Only namespace
	args1b := map[string]interface{}{"namespace": "bookinfo"}
	_, code1b := Execute(&mcputil.KialiInterface{Request: req1, Conf: conf}, args1b)
	if code1b != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, code1b)
	}

	// Only service_name
	args1c := map[string]interface{}{"service_name": "ratings"}
	_, code1c := Execute(&mcputil.KialiInterface{Request: req1, Conf: conf}, args1c)
	if code1c != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, code1c)
	}

	// namespace and serviceName provided
	args3 := map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "ratings",
	}
	parsed3 := parseArgs(args3, conf)
	if parsed3.Namespace != "bookinfo" || parsed3.ServiceName != "ratings" {
		t.Errorf("expected namespace bookinfo and service_name ratings, got %s and %s", parsed3.Namespace, parsed3.ServiceName)
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
	if s.ErrorSpans[0].Service != "backend" {
		t.Fatalf("expected error span service=backend, got %q", s.ErrorSpans[0].Service)
	}
}

func TestResponseStructure_ListResponse(t *testing.T) {
	// List response has summary and traces slice.
	resp := GetTracesListResponse{
		Summary: &TracesListSummary{
			Namespace:     "bookinfo",
			Service:       "reviews",
			TotalFound:    2,
			AvgDurationMs: 12.5,
		},
		Traces: []TraceListItem{
			{ID: "21a90b5531039d94", DurationMs: 25.48, SpansCount: 7, RootOp: "productpage-v1 GET 200", SlowestService: "reviews.bookinfo (15.2ms)", HasErrors: false},
			{ID: "fb7a48fdaf5bd369", DurationMs: 9.65, SpansCount: 5, RootOp: "productpage-v1 GET 200", SlowestService: "details.bookinfo (1.7ms)", HasErrors: false},
		},
	}

	if resp.Summary == nil || resp.Summary.Namespace != "bookinfo" || resp.Summary.Service != "reviews" || resp.Summary.TotalFound != 2 {
		t.Errorf("unexpected summary: %+v", resp.Summary)
	}
	if len(resp.Traces) != 2 {
		t.Fatalf("expected 2 traces, got %d", len(resp.Traces))
	}
	if resp.Traces[0].ID != "21a90b5531039d94" || resp.Traces[0].SpansCount != 7 {
		t.Errorf("unexpected first trace: %+v", resp.Traces[0])
	}
}

func TestTraceSummaryToListItem(t *testing.T) {
	s := TraceSummary{
		TraceID:         "abc",
		TotalDurationMs: 10.5,
		TotalSpans:      3,
		RootSpans:       []SpanBrief{{Service: "svc-a", Operation: "GET /", Tags: map[string]string{"http.status_code": "200"}}},
		Bottlenecks:     []SpanBrief{{Service: "reviews", DurationMs: 5.2}},
		ErrorSpans:      nil,
	}
	item := traceSummaryToListItem(s, "bookinfo")
	if item.ID != "abc" || item.DurationMs != 10.5 || item.SpansCount != 3 || item.RootOp != "svc-a GET / 200" {
		t.Errorf("unexpected item: %+v", item)
	}
	if item.SlowestService != "reviews.bookinfo (5.2ms)" {
		t.Errorf("unexpected slowest_service: %s", item.SlowestService)
	}
	if item.HasErrors {
		t.Error("expected HasErrors false")
	}
}

// TestTraceSummaryToListItem_ServiceAlreadyHasNamespace ensures we don't double-append namespace
// (e.g. productpage.bookinfo -> productpage.bookinfo.bookinfo).
func TestTraceSummaryToListItem_ServiceAlreadyHasNamespace(t *testing.T) {
	s := TraceSummary{
		TraceID:     "tid",
		TotalSpans:  1,
		Bottlenecks: []SpanBrief{{Service: "productpage.bookinfo", DurationMs: 10.0}},
	}
	item := traceSummaryToListItem(s, "bookinfo")
	if item.SlowestService != "productpage.bookinfo (10.0ms)" {
		t.Errorf("expected service name as-is when it already contains a dot, got %q", item.SlowestService)
	}
}

func TestTraceSummaryToListItem_EmptyRootOp(t *testing.T) {
	s := TraceSummary{
		TraceID:         "tid",
		TotalDurationMs: 1.0,
		TotalSpans:      1,
		RootSpans:       nil,
		Bottlenecks:     []SpanBrief{{Service: "x", DurationMs: 1.0}},
	}
	item := traceSummaryToListItem(s, "ns")
	if item.RootOp != "" {
		t.Errorf("expected empty root_op when no root spans, got %q", item.RootOp)
	}
	if item.ID != "tid" {
		t.Errorf("expected id tid, got %s", item.ID)
	}
}

func TestTraceSummaryToListItem_EmptySlowestService(t *testing.T) {
	s := TraceSummary{
		TraceID:         "tid",
		TotalDurationMs: 1.0,
		TotalSpans:      1,
		RootSpans:       []SpanBrief{{Service: "a", Operation: "op"}},
		Bottlenecks:     nil,
	}
	item := traceSummaryToListItem(s, "default")
	if item.SlowestService != "" {
		t.Errorf("expected empty slowest_service when no bottlenecks, got %q", item.SlowestService)
	}
}

func TestTraceSummaryToListItem_HasErrors(t *testing.T) {
	s := TraceSummary{
		TraceID:    "tid",
		TotalSpans: 2,
		ErrorSpans: []SpanBrief{{SpanID: "e1", Service: "svc", Operation: "fail"}},
	}
	item := traceSummaryToListItem(s, "ns")
	if !item.HasErrors {
		t.Error("expected HasErrors true when ErrorSpans non-empty")
	}
}

func TestTraceSummaryToListItem_EmptyNamespace(t *testing.T) {
	s := TraceSummary{
		TraceID:     "tid",
		TotalSpans:  1,
		Bottlenecks: []SpanBrief{{Service: "reviews", DurationMs: 3.5}},
	}
	item := traceSummaryToListItem(s, "")
	// When namespace is empty we format as "service (Xms)" without ".namespace"
	if item.SlowestService != "reviews (3.5ms)" {
		t.Errorf("expected slowest_service without namespace suffix when namespace empty, got %q", item.SlowestService)
	}
}

func TestParseArgs_LimitCap(t *testing.T) {
	conf := config.NewConfig()
	args := map[string]interface{}{"limit": 999999}
	parsed := parseArgs(args, conf)
	if parsed.Limit != models.MaxTracingLimit {
		t.Errorf("expected limit capped at %d, got %d", models.MaxTracingLimit, parsed.Limit)
	}
}

func TestParseArgs_LimitBelowCap(t *testing.T) {
	conf := config.NewConfig()
	args := map[string]interface{}{"limit": 50}
	parsed := parseArgs(args, conf)
	if parsed.Limit != 50 {
		t.Errorf("expected limit 50, got %d", parsed.Limit)
	}
}

func TestExecute_BackendError_Returns503(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true

	fake := &fakeTracingClient{appErr: errors.New("connection refused")}
	ki := newTestKialiInterface(t, conf, fake)

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "ratings",
	}
	res, code := Execute(ki, args)
	if code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d: %v", code, res)
	}
}

func TestExecute_EmptyTraces_Returns200WithZero(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true

	fake := &fakeTracingClient{
		appTraces: &tracingModel.TracingResponse{Data: nil},
	}
	svc := kubetest.FakeService("bookinfo", "ratings")
	ki := newTestKialiInterface(t, conf, fake, &svc)

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "ratings",
	}
	res, code := Execute(ki, args)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %v", code, res)
	}
	resp, ok := res.(GetTracesListResponse)
	if !ok {
		t.Fatalf("expected GetTracesListResponse, got %T", res)
	}
	if resp.Summary == nil || resp.Summary.TotalFound != 0 {
		t.Errorf("expected total_found=0, got %+v", resp.Summary)
	}
}

func TestExecute_WithTraces_Returns200WithSummary(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = true

	sampleTrace := jaegerModels.Trace{
		TraceID: "aabb",
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{
			"p1": {ServiceName: "ratings"},
		},
		Spans: []jaegerModels.Span{
			{
				SpanID:        "s1",
				OperationName: "GET /ratings",
				ProcessID:     "p1",
				StartTime:     1000,
				Duration:      5000,
				Tags:          []jaegerModels.KeyValue{{Key: "http.status_code", Type: "string", Value: "200"}},
			},
		},
	}

	fake := &fakeTracingClient{
		appTraces: &tracingModel.TracingResponse{
			Data: []jaegerModels.Trace{sampleTrace},
		},
		traceDetail: &tracingModel.TracingSingleTrace{
			Data: sampleTrace,
		},
	}
	svc := kubetest.FakeService("bookinfo", "ratings")
	ki := newTestKialiInterface(t, conf, fake, &svc)

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "ratings",
	}
	res, code := Execute(ki, args)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %v", code, res)
	}
	resp, ok := res.(GetTracesListResponse)
	if !ok {
		t.Fatalf("expected GetTracesListResponse, got %T", res)
	}
	if resp.Summary == nil || resp.Summary.TotalFound != 1 {
		t.Errorf("expected total_found=1, got %+v", resp.Summary)
	}
	if len(resp.Traces) != 1 {
		t.Fatalf("expected 1 trace, got %d", len(resp.Traces))
	}
	if resp.Traces[0].SpansCount != 1 {
		t.Errorf("expected spans_count=1, got %d", resp.Traces[0].SpansCount)
	}
}

func TestExecute_TracingDisabled_Returns503(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = false

	fake := &fakeTracingClient{}
	ki := newTestKialiInterface(t, conf, fake)

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "ratings",
	}
	_, code := Execute(ki, args)
	if code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 when tracing disabled, got %d", code)
	}
}
