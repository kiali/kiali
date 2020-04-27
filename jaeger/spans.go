package jaeger

import (
	"fmt"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"time"

	jaegerModels "github.com/jaegertracing/jaeger/model/json"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

// TODO / Question: make limit configurable? Selected from UI?
const tracesLimit = 100

type Span struct {
	jaegerModels.Span
	TraceSize int `json:"traceSize"`
}

func getSpans(client http.Client, endpoint *url.URL, namespace, service, startMicros, endMicros string) ([]Span, error) {
	u := endpoint
	queryService := service
	if config.Get().ExternalServices.Tracing.NamespaceSelector {
		queryService = service + "." + namespace
	}
	u.Path = path.Join(u.Path, "/api/traces")
	q := u.Query()
	q.Set("service", queryService)
	q.Set("start", startMicros)
	q.Set("end", endMicros)
	q.Set("limit", strconv.Itoa(tracesLimit))

	u.RawQuery = q.Encode()
	response, err := queryTraces(client, u)
	if err != nil {
		return []Span{}, err
	}

	spans := tracesToSpans(response.Data, service, namespace)
	if len(response.Data) == tracesLimit {
		// Reached the limit, trying to be smart enough to show more and get the most relevant ones
		log.Trace("Limit of traces was reached, trying to find more relevant spans...")
		return findRelevantSpans(client, spans, u, q, service, namespace)
	}

	return spans, nil
}

func tracesToSpans(traces []jaegerModels.Trace, service, namespace string) []Span {
	spans := []Span{}
	for _, trace := range traces {
		// First, get the desired processes for our service
		processes := make(map[jaegerModels.ProcessID]bool)
		for pId, process := range trace.Processes {
			if process.ServiceName == service || process.ServiceName == service+"."+namespace {
				processes[pId] = true
			}
		}
		// Second, find spans for these processes
		for _, span := range trace.Spans {
			if ok := processes[span.ProcessID]; ok {
				spans = append(spans, Span{
					Span:      span,
					TraceSize: len(trace.Spans),
				})
			}
		}
	}
	log.Tracef("Found %d spans in the %d traces for service %s", len(spans), len(traces), service)
	return spans
}

func findRelevantSpans(client http.Client, spansSample []Span, u *url.URL, q url.Values, service, namespace string) ([]Span, error) {
	spansMap := make(map[jaegerModels.SpanID]Span)

	// Query for errors
	q.Set("tags", "{\"error\":\"true\"}")
	u.RawQuery = q.Encode()
	response, _ := queryTraces(client, u)
	errSpans := tracesToSpans(response.Data, service, namespace)
	for _, span := range errSpans {
		spansMap[span.SpanID] = span
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
	q.Del("tags")
	// %.1gms would print for instance 0.00012456 as 0.0001ms
	q.Set("minDuration", fmt.Sprintf("%.1gms", float64(duration90th.Nanoseconds())/1000000))
	u.RawQuery = q.Encode()
	response, _ = queryTraces(client, u)
	// TODO / Question: if limit is reached again we might limit to 99th percentile instead?
	pct90Spans := tracesToSpans(response.Data, service, namespace)
	for _, span := range pct90Spans {
		spansMap[span.SpanID] = span
	}

	// Map to list
	ret := []Span{}
	for _, span := range spansMap {
		ret = append(ret, span)
	}
	log.Tracef("Found %d relevant spans", len(ret))
	return ret, nil
}
