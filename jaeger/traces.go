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
)

func getTraces(client http.Client, endpoint *url.URL, namespace string, service string, rawQuery string) (response *JaegerResponse, err error) {
	u := endpoint
	queryService := service
	if config.Get().ExternalServices.Tracing.NamespaceSelector && namespace != config.Get().IstioNamespace {
		queryService = fmt.Sprintf("%s.%s", service, namespace)
	}
	u.Path = path.Join(u.Path, "/api/traces")
	q, err := url.ParseQuery(rawQuery)
	if err != nil {
		log.Errorf("Jaeger parse query error: %s", err)
		return
	}
	q.Add("service", queryService)
	u.RawQuery = q.Encode()
	return queryTraces(client, u)
}

func getTraceDetail(client http.Client, endpoint *url.URL, traceID string) (response *JaegerResponse, err error) {
	u := endpoint
	u.Path = path.Join(u.Path, "/api/traces/"+traceID)
	return queryTraces(client, u)
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
