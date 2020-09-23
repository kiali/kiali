package business

import (
	"fmt"
	"sort"
	"strings"
	"time"

	jaegerModels "github.com/jaegertracing/jaeger/model/json"

	"github.com/kiali/kiali/jaeger"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

type JaegerLoader = func() (jaeger.ClientInterface, error)
type SpanFilter = func(span *jaegerModels.Span) bool

type JaegerService struct {
	loader        JaegerLoader
	loaderErr     error
	jaeger        jaeger.ClientInterface
	businessLayer *Layer
}

func (in *JaegerService) client() (jaeger.ClientInterface, error) {
	if in.jaeger != nil {
		return in.jaeger, nil
	} else if in.loaderErr != nil {
		return nil, in.loaderErr
	}
	in.jaeger, in.loaderErr = in.loader()
	return in.jaeger, in.loaderErr
}

func (in *JaegerService) getFilteredSpans(ns, app string, query models.TracingQuery, filter SpanFilter) ([]jaeger.JaegerSpan, error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	r, err := client.GetAppTraces(ns, app, query)
	if err != nil {
		return []jaeger.JaegerSpan{}, err
	}

	spans := tracesToSpans(app, r, filter)
	if len(r.Data) == query.Limit && len(spans) > 0 {
		// Reached the limit, trying to be smart enough to show more and get the most relevant ones
		log.Trace("Limit of traces was reached, trying to find more relevant spans...")
		return findRelevantSpans(client, spans, ns, app, query, filter)
	}

	return spans, nil
}

func (in *JaegerService) GetAppSpans(ns, app string, query models.TracingQuery) ([]jaeger.JaegerSpan, error) {
	return in.getFilteredSpans(ns, app, query, nil /*no post-filtering for apps*/)
}

func (in *JaegerService) GetServiceSpans(ns, service string, query models.TracingQuery) ([]jaeger.JaegerSpan, error) {
	app, err := in.businessLayer.Svc.GetServiceAppName(ns, service)
	if err != nil {
		return nil, err
	}
	return in.getFilteredSpans(ns, app, query, svcSpanFilter(ns, service))
}

func svcSpanFilter(ns, service string) SpanFilter {
	// Filter out app spans based on operation name.
	// For envoy traces, operation name is like "service-name.namespace.svc.cluster.local:8000/*"
	return func(span *jaegerModels.Span) bool {
		return strings.HasPrefix(span.OperationName, service+"."+ns)
	}
}

func (in *JaegerService) GetWorkloadSpans(ns, workload string, query models.TracingQuery) ([]jaeger.JaegerSpan, error) {
	app, err := in.businessLayer.Workload.GetWorkloadAppName(ns, workload)
	if err != nil {
		return nil, err
	}
	return in.getFilteredSpans(ns, app, query, wkdSpanFilter(ns, workload))
}

func wkdSpanFilter(ns, workload string) SpanFilter {
	// Filter out app traces based on the node_id tag, that contains workload information.
	return func(span *jaegerModels.Span) bool {
		return spanMatchesWorkload(span, ns, workload)
	}
}

func (in *JaegerService) GetAppTraces(ns, app string, query models.TracingQuery) (*jaeger.JaegerResponse, error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	return client.GetAppTraces(ns, app, query)
}

func (in *JaegerService) GetServiceTraces(ns, service string, query models.TracingQuery) (*jaeger.JaegerResponse, error) {
	app, err := in.businessLayer.Svc.GetServiceAppName(ns, service)
	if err != nil {
		return nil, err
	}
	// Artificial increase of limit (see explanation in GetWorkloadTraces)
	reqLimit := query.Limit
	query.Limit *= 2
	r, err := in.GetAppTraces(ns, app, query)
	// Filter out app traces based on operation name.
	// For envoy traces, operation name is like "service-name.namespace.svc.cluster.local:8000/*"
	filter := svcSpanFilter(ns, service)
	if r != nil && err == nil {
		traces := []jaegerModels.Trace{}
		for _, trace := range r.Data {
			for _, span := range trace.Spans {
				if filter(&span) {
					traces = append(traces, trace)
					break
				}
			}
			if reqLimit > 0 && len(traces) == reqLimit {
				break
			}
		}
		r.Data = traces
	}
	return r, err
}

func (in *JaegerService) GetWorkloadTraces(ns, workload string, query models.TracingQuery) (*jaeger.JaegerResponse, error) {
	app, err := in.businessLayer.Workload.GetWorkloadAppName(ns, workload)
	if err != nil {
		return nil, err
	}
	// Because Traces are fetched per App and not Workloads, the 'limit' query param will apply to app's traces, not workloads,
	// so it will not be consistent with the final result. In other words, we ask for 15 traces but could very well end up with
	// only 3 traces for the workload even if there's more.
	// To try to attenuate this effect, we will artificially increase the limit, then cut it down after workload filtering.
	reqLimit := query.Limit
	query.Limit *= 5
	r, err := in.GetAppTraces(ns, app, query)
	// Filter out app traces based on the node_id tag, that contains workload information.
	if r != nil && err == nil {
		traces := []jaegerModels.Trace{}
		for _, trace := range r.Data {
			if matchesWorkload(&trace, ns, workload) {
				traces = append(traces, trace)
				if reqLimit > 0 && len(traces) == reqLimit {
					break
				}
			}
		}
		r.Data = traces
	}
	return r, err
}

func (in *JaegerService) GetJaegerTraceDetail(traceID string) (trace *jaeger.JaegerSingleTrace, err error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	return client.GetTraceDetail(traceID)
}

func (in *JaegerService) GetErrorTraces(ns, app string, duration time.Duration) (errorTraces int, err error) {
	client, err := in.client()
	if err != nil {
		return 0, err
	}
	return client.GetErrorTraces(ns, app, duration)
}

func matchesWorkload(trace *jaegerModels.Trace, namespace, workload string) bool {
	for _, span := range trace.Spans {
		if process, ok := trace.Processes[span.ProcessID]; ok {
			span.Process = &process
		}
		if spanMatchesWorkload(&span, namespace, workload) {
			return true
		}
	}
	return false
}

func spanMatchesWorkload(span *jaegerModels.Span, namespace, workload string) bool {
	// For envoy traces, with a workload named "ai-locals", node_id is like:
	// sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local
	for _, tag := range span.Tags {
		if tag.Key == "node_id" {
			if v, ok := tag.Value.(string); ok {
				parts := strings.Split(v, "~")
				if len(parts) >= 3 && strings.HasPrefix(parts[2], workload) && strings.HasSuffix(parts[2], namespace) {
					return true
				}
			}
		}
	}
	// Tag not found => try with 'hostname' in process' tags
	if span.Process != nil {
		for _, tag := range span.Process.Tags {
			if tag.Key == "hostname" {
				if v, ok := tag.Value.(string); ok {
					if strings.HasPrefix(v, workload) {
						return true
					}
				}
			}
		}
	}
	return false
}

func tracesToSpans(app string, r *jaeger.JaegerResponse, filter SpanFilter) []jaeger.JaegerSpan {
	spans := []jaeger.JaegerSpan{}
	for _, trace := range r.Data {
		// First, get the desired processes for our service
		processes := make(map[jaegerModels.ProcessID]jaegerModels.Process)
		for pId, process := range trace.Processes {
			if process.ServiceName == app || process.ServiceName == r.JaegerServiceName {
				processes[pId] = process
			}
		}
		// Second, find spans for these processes
		for _, span := range trace.Spans {
			if p, ok := processes[span.ProcessID]; ok {
				span.Process = &p
				if filter == nil || filter(&span) {
					spans = append(spans, jaeger.JaegerSpan{
						Span:      span,
						TraceSize: len(trace.Spans),
					})
				}
			}
		}
	}
	log.Tracef("Found %d spans in the %d traces for app %s", len(spans), len(r.Data), app)
	return spans
}

func findRelevantSpans(client jaeger.ClientInterface, spansSample []jaeger.JaegerSpan, ns, app string, query models.TracingQuery, filter SpanFilter) ([]jaeger.JaegerSpan, error) {
	spansMap := make(map[jaegerModels.SpanID]jaeger.JaegerSpan)
	if query.Tags == "" {
		// Query for errors
		q := query
		q.Tags = "{\"error\":\"true\"}"
		response, _ := client.GetAppTraces(ns, app, query)
		errSpans := tracesToSpans(app, response, filter)
		for _, span := range errSpans {
			spansMap[span.SpanID] = span
		}
	}

	// Find 90th percentile; sort per duration
	sort.Slice(spansSample, func(i, j int) bool {
		return spansSample[i].Span.Duration < spansSample[j].Span.Duration
	})
	idx90 := int(9 * len(spansSample) / 10)
	duration90th := time.Duration(spansSample[idx90].Duration) * time.Microsecond
	log.Tracef("90th percentile duration: %s", duration90th)
	for _, span := range spansSample[idx90:] {
		spansMap[span.SpanID] = span
	}

	// Query 90th percentile
	// %.1gms would print for instance 0.00012456 as 0.0001ms
	q := query
	q.MinDuration = fmt.Sprintf("%.1gms", float64(duration90th.Nanoseconds())/1000000)
	response, _ := client.GetAppTraces(ns, app, query)
	// TODO / Question: if limit is reached again we might limit to 99th percentile instead?
	pct90Spans := tracesToSpans(app, response, filter)
	for _, span := range pct90Spans {
		spansMap[span.SpanID] = span
	}

	// Map to list
	ret := []jaeger.JaegerSpan{}
	for _, span := range spansMap {
		ret = append(ret, span)
	}
	log.Tracef("Found %d relevant spans", len(ret))
	return ret, nil
}
