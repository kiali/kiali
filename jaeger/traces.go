package jaeger

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

func getAppTraces(client http.Client, baseURL *url.URL, namespace, app string, q models.TracingQuery) (response *JaegerResponse, err error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/traces")
	jaegerServiceName := buildJaegerServiceName(namespace, app)
	prepareQuery(&url, jaegerServiceName, q)
	r, err := queryTraces(client, &url)
	if r != nil {
		r.JaegerServiceName = jaegerServiceName
	}
	return r, err
}

func getTraceDetail(client http.Client, endpoint *url.URL, traceID string) (*JaegerSingleTrace, error) {
	u := endpoint
	u.Path = path.Join(u.Path, "/api/traces/"+traceID)
	resp, code, reqError := makeRequest(client, u.String(), nil)
	if reqError != nil {
		log.Errorf("Jaeger query error: %s [code: %d, URL: %v]", reqError, code, u)
		return nil, reqError
	}
	// Jaeger would return "200 OK" when trace is not found, with an empty response
	if len(resp) == 0 {
		return nil, nil
	}
	response, err := unmarshal(resp, u)
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
	return unmarshal(resp, u)
}

func unmarshal(r []byte, u *url.URL) (*JaegerResponse, error) {
	var response JaegerResponse
	if errMarshal := json.Unmarshal(r, &response); errMarshal != nil {
		log.Errorf("Error unmarshalling Jaeger response: %s [URL: %v]", errMarshal, u)
		return nil, errMarshal
	}
	return &response, nil
}
