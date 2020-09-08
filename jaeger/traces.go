package jaeger

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	jaegerModels "github.com/jaegertracing/jaeger/model/json"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

func getAppTraces(client http.Client, endpoint *url.URL, namespace, app string, query models.TracingQuery) (response *JaegerResponse, err error) {
	endpoint.Path = path.Join(endpoint.Path, "/api/traces")
	jaegerServiceName := buildJaegerServiceName(namespace, app)
	prepareQuery(endpoint, jaegerServiceName, query)
	r, err := queryTraces(client, endpoint)
	if r != nil {
		r.JaegerServiceName = jaegerServiceName
	}
	return r, err
}

func getServiceTraces(client http.Client, endpoint *url.URL, namespace, app, service string, query models.TracingQuery) (*JaegerResponse, error) {
	r, err := getAppTraces(client, endpoint, namespace, app, query)
	// Filter out app traces based on operation name.
	// For envoy traces, operation name is like "service-name.namespace.svc.cluster.local:8000/*"
	svcNs := service + "." + namespace
	if r != nil && err == nil {
		traces := []jaegerModels.Trace{}
		for _, trace := range r.Data {
			for _, span := range trace.Spans {
				if strings.HasPrefix(span.OperationName, svcNs) {
					traces = append(traces, trace)
					break
				}
			}
		}
		r.Data = traces
	}
	return r, err
}

func getWorkloadTraces(client http.Client, endpoint *url.URL, namespace, app, workload string, query models.TracingQuery) (*JaegerResponse, error) {
	r, err := getAppTraces(client, endpoint, namespace, app, query)
	// Filter out app traces based on the node_id tag, that contains workload information.
	if r != nil && err == nil {
		traces := []jaegerModels.Trace{}
		for _, trace := range r.Data {
			if matchesWorkload(trace, namespace, workload) {
				traces = append(traces, trace)
			}
		}
		r.Data = traces
	}
	return r, err
}

func matchesWorkload(trace jaegerModels.Trace, namespace, workload string) bool {
	// For envoy traces, with a workload named "ai-locals", node_id is like:
	// sidecar~172.17.0.20~ai-locals-6d8996bff-ztg6z.default~default.svc.cluster.local
	for _, span := range trace.Spans {
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
		if process, ok := trace.Processes[span.ProcessID]; ok {
			// Tag not found => try with 'hostname' in process' tags
			for _, tag := range process.Tags {
				if tag.Key == "hostname" {
					if v, ok := tag.Value.(string); ok {
						if strings.HasPrefix(v, workload) {
							return true
						}
					}
				}
			}
		}
	}
	return false
}

func getTraceDetail(client http.Client, endpoint *url.URL, traceID string) (*JaegerSingleTrace, error) {
	u := endpoint
	u.Path = path.Join(u.Path, "/api/traces/"+traceID)
	response, err := queryTraces(client, u)
	if err != nil {
		return nil, err
	}
	if len(response.Data) == 0 {
		return &JaegerSingleTrace{Errors: response.Errors}, nil
	}
	return &JaegerSingleTrace{
		Data:   response.Data[0],
		Errors: response.Errors,
	}, nil
}

func getErrorTraces(client http.Client, endpoint *url.URL, namespace, app string, duration time.Duration) (errorTraces int, err error) {
	errorTraces = 0
	err = nil
	u := endpoint
	u.Path = path.Join(u.Path, "/api/traces")
	q := u.Query()
	queryApp := app
	if config.Get().ExternalServices.Tracing.NamespaceSelector && namespace != config.Get().IstioNamespace {
		queryApp = fmt.Sprintf("%s.%s", app, namespace)
	}
	q.Set("service", queryApp)
	t := time.Now().UnixNano() / 1000
	q.Set("start", fmt.Sprintf("%d", t-(duration.Nanoseconds()/1000)))
	q.Set("end", fmt.Sprintf("%d", t))
	q.Set("tags", "{\"error\":\"true\"}")

	u.RawQuery = q.Encode()
	response, err := queryTraces(client, u)
	if err != nil {
		return -1, err
	}
	return len(response.Data), err
}

func queryTraces(client http.Client, u *url.URL) (*JaegerResponse, error) {
	resp, code, reqError := makeRequest(client, u.String(), nil)
	if reqError != nil {
		log.Errorf("Jaeger query error: %s [code: %d, URL: %v]", reqError, code, u)
		return &JaegerResponse{}, reqError
	}
	var response JaegerResponse
	if errMarshal := json.Unmarshal([]byte(resp), &response); errMarshal != nil {
		log.Errorf("Error unmarshalling Jaeger response: %s [URL: %v]", errMarshal, u)
		return &JaegerResponse{}, errMarshal
	}
	return &response, nil
}
