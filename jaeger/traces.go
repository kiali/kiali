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
	jsn := buildJaegerServiceName(namespace, app)
	prepareQuery(endpoint, jsn, query)
	r, err := queryTraces(client, endpoint)
	if r != nil {
		r.App = jsn
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
