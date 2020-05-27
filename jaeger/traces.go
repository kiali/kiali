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

func getTraces(client http.Client, endpoint *url.URL, namespace, service string, query models.TracingQuery) (response *JaegerResponse, err error) {
	endpoint.Path = path.Join(endpoint.Path, "/api/traces")
	prepareQuery(endpoint, namespace, service, query)
	return queryTraces(client, endpoint)
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

func getErrorTraces(client http.Client, endpoint *url.URL, namespace, service string, duration time.Duration) (errorTraces int, err error) {
	errorTraces = 0
	err = nil
	u := endpoint
	u.Path = path.Join(u.Path, "/api/traces")
	q := u.Query()
	queryService := service
	if config.Get().ExternalServices.Tracing.NamespaceSelector && namespace != config.Get().IstioNamespace {
		queryService = fmt.Sprintf("%s.%s", service, namespace)
	}
	q.Set("service", queryService)
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
