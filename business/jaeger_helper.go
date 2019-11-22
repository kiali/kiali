package business

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"

	jaeger "github.com/jaegertracing/jaeger/model/json"

	"github.com/kiali/kiali/appstate"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

type RequestTrace struct {
	Traces []jaeger.Trace `json:"data"`
}

type JaegerServices struct {
	Services []string `json:"data"`
}

type TracingQuery struct {
	Namespace    string
	Service      string
	RequestToken string
	StartMicros  string
	EndMicros    string
}

type Span struct {
	jaeger.Span
	TraceSize int `json:"traceSize"`
}

// TODO / Question: make limit configurable? Selected from UI?
const tracesLimit = 100

func getErrorTracesFromJaeger(namespace string, service string, requestToken string) (errorTraces int, err error) {
	errorTraces = 0
	err = nil
	if !config.Get().ExternalServices.Tracing.Enabled {
		return -1, errors.New("jaeger is not available")
	}
	if appstate.JaegerEnabled {
		// Be sure to copy config.Auth and not modify the existing
		auth := config.Get().ExternalServices.Tracing.Auth
		if auth.UseKialiToken {
			auth.Token = requestToken
		}

		u, errParse := GetJaegerInternalURL("/api/traces")
		if !config.Get().InCluster {
			u, errParse = url.Parse(config.Get().ExternalServices.Tracing.URL + "/api/traces")
		}

		if errParse != nil {
			log.Errorf("Error parse Jaeger URL fetching Error Traces: %s", err)
			return -1, errParse
		} else {
			q := u.Query()
			q.Set("lookback", "1h")
			queryService := fmt.Sprintf("%s.%s", service, namespace)
			if !config.Get().ExternalServices.Tracing.NamespaceSelector {
				queryService = service
			}
			q.Set("service", queryService)
			t := time.Now().UnixNano() / 1000
			q.Set("start", fmt.Sprintf("%d", t-60*60*1000*1000))
			q.Set("end", fmt.Sprintf("%d", t))
			q.Set("tags", "{\"error\":\"true\"}")

			u.RawQuery = q.Encode()

			body, code, reqError := httputil.HttpGet(u.String(), &auth, time.Second)
			if reqError != nil {
				log.Errorf("Error fetching Jaeger Error Traces (%d): %s", code, reqError)
				return -1, reqError
			} else {
				if code != http.StatusOK {
					return -1, fmt.Errorf("error from Jaeger (%d)", code)
				}
				var traces RequestTrace
				if errMarshal := json.Unmarshal([]byte(body), &traces); errMarshal != nil {
					log.Errorf("Error Unmarshal Jaeger Response fetching Error Traces: %s", errMarshal)
					err = errMarshal
					return -1, err
				}
				errorTraces = len(traces.Traces)
			}
		}
	}
	return errorTraces, err
}

func GetSpans(q *TracingQuery) ([]Span, error) {
	if !config.Get().ExternalServices.Tracing.Enabled {
		return []Span{}, errors.New("jaeger is not available")
	}
	if !appstate.JaegerEnabled {
		return []Span{}, nil
	}

	// Be sure to copy config.Auth and not modify the existing
	auth := config.Get().ExternalServices.Tracing.Auth
	if auth.UseKialiToken {
		auth.Token = q.RequestToken
	}

	u, errParse := GetJaegerInternalURL("/api/traces")
	if !config.Get().InCluster {
		u, errParse = url.Parse(config.Get().ExternalServices.Tracing.URL + "/api/traces")
	}

	if errParse != nil {
		log.Errorf("Error parsing Jaeger URL: %s", errParse)
		return []Span{}, errParse
	}

	jaegerQ := u.Query()
	queryService := q.Service
	if config.Get().ExternalServices.Tracing.NamespaceSelector {
		queryService = fmt.Sprintf("%s.%s", q.Service, q.Namespace)
	}
	jaegerQ.Set("service", queryService)
	jaegerQ.Set("start", q.StartMicros)
	jaegerQ.Set("end", q.EndMicros)
	jaegerQ.Set("limit", strconv.Itoa(tracesLimit))

	traces, errQ := queryTraces(u, auth, jaegerQ)
	if errQ != nil {
		return []Span{}, errQ
	}

	spans := tracesToSpans(traces, q.Service, q.Namespace)
	if len(traces) == tracesLimit {
		// Reached the limit, trying to be smart enough to show more and get the most relevant ones
		log.Info("Limit of traces was reached, trying to find more relevant spans...")
		return findRelevantSpans(spans, u, auth, jaegerQ, q.Service, q.Namespace)
	}

	return spans, nil
}

func queryTraces(u *url.URL, auth config.Auth, jaegerQ url.Values) ([]jaeger.Trace, error) {
	u.RawQuery = jaegerQ.Encode()
	log.Infof("Jaeger query: %s", u)
	body, code, reqError := httputil.HttpGet(u.String(), &auth, 5*time.Second)
	if reqError != nil {
		log.Errorf("Error fetching Jaeger Error Traces (%d): %s", code, reqError)
		return []jaeger.Trace{}, reqError
	}

	if code != http.StatusOK {
		return []jaeger.Trace{}, fmt.Errorf("error from Jaeger (%d)", code)
	}

	var traces RequestTrace
	if errMarshal := json.Unmarshal(body, &traces); errMarshal != nil {
		log.Errorf("Error unmarshalling Jaeger response: %s", errMarshal)
		return []jaeger.Trace{}, errMarshal
	}

	return traces.Traces, nil
}

func tracesToSpans(traces []jaeger.Trace, service, namespace string) []Span {
	spans := []Span{}
	for _, trace := range traces {
		// First, get the desired processes for our service
		processes := make(map[jaeger.ProcessID]bool)
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
	log.Infof("Found %d spans in the %d traces for service %s", len(spans), len(traces), service)
	return spans
}

func findRelevantSpans(spansSample []Span, u *url.URL, auth config.Auth, jaegerQ url.Values, service, namespace string) ([]Span, error) {
	spansMap := make(map[jaeger.SpanID]Span)

	// Query for errors
	jaegerQ.Set("tags", "{\"error\":\"true\"}")
	traces, _ := queryTraces(u, auth, jaegerQ)
	errSpans := tracesToSpans(traces, service, namespace)
	for _, span := range errSpans {
		spansMap[span.SpanID] = span
	}

	// Find 90th percentile; sort per duration
	sort.Slice(spansSample, func(i, j int) bool {
		return spansSample[i].Span.Duration < spansSample[j].Span.Duration
	})
	idx90 := int(9 * len(spansSample) / 10)
	duration90th := time.Duration(spansSample[idx90].Duration) * time.Microsecond
	log.Infof("90th percentile duration: %s", duration90th)
	for _, span := range spansSample[idx90:] {
		spansMap[span.SpanID] = span
	}

	// Query 90th percentile
	jaegerQ.Del("tags")
	// %.1gms would print for instance 0.00012456 as 0.0001ms
	jaegerQ.Set("minDuration", fmt.Sprintf("%.1gms", float64(duration90th.Nanoseconds())/1000000))
	traces, _ = queryTraces(u, auth, jaegerQ)
	// TODO / Question: if limit is reached again we might limit to 99th percentile instead?
	pct90Spans := tracesToSpans(traces, service, namespace)
	for _, span := range pct90Spans {
		spansMap[span.SpanID] = span
	}

	// Map to list
	ret := []Span{}
	for _, span := range spansMap {
		ret = append(ret, span)
	}
	log.Infof("Found %d relevant spans", len(ret))
	return ret, nil
}

func GetJaegerInternalURL(path string) (*url.URL, error) {
	return url.Parse(fmt.Sprintf("%s%s%s", appstate.JaegerConfig.InClusterURL, appstate.JaegerConfig.Path, path))
}

func GetJaegerServices() (services JaegerServices, err error) {
	services = JaegerServices{Services: []string{}}
	err = nil
	u, err := url.Parse(fmt.Sprintf("http://%s%s/api/services", appstate.JaegerConfig.Service, appstate.JaegerConfig.Path))
	if err != nil {
		log.Errorf("Error parse Jaeger URL fetching Services: %s", err)
		return services, err
	}
	timeout := time.Duration(1000 * time.Millisecond)
	client := http.Client{
		Timeout: timeout,
	}
	resp, reqError := client.Get(u.String())
	if reqError != nil {
		err = reqError
	} else {
		defer resp.Body.Close()
		body, errRead := ioutil.ReadAll(resp.Body)
		if errRead != nil {
			log.Errorf("Error Reading Jaeger Response fetching Services: %s", errRead)
			err = errRead
			return services, err
		}
		if errMarshal := json.Unmarshal([]byte(body), &services); errMarshal != nil {
			log.Errorf("Error Unmarshal Jaeger Response fetching Services: %s", errRead)
			err = errMarshal
			return services, err
		}
	}
	return services, err
}
