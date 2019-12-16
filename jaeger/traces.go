package jaeger

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"time"

	jaegerModels "github.com/jaegertracing/jaeger/model/json"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

func getTraces(client http.Client, endpoint *url.URL, namespace string, service string, rawQuery string) (traces []jaegerModels.Trace, code int, err error) {
	code = 0
	u := endpoint
	if config.Get().ExternalServices.Tracing.NamespaceSelector {
		service = service + "." + namespace
	}
	u.Path = path.Join(u.Path, "/api/traces")
	q, err := url.ParseQuery(rawQuery)
	if err != nil {
		log.Errorf("Jaeger parse query error: %s", err)
		return
	}
	q.Add("service", service)
	u.RawQuery = q.Encode()
	return queryTraces(client, u)
}

func getTraceDetail(client http.Client, endpoint *url.URL, traceID string) (trace []jaegerModels.Trace, code int, err error) {
	u := endpoint
	u.Path = path.Join(u.Path, "/api/traces/"+traceID)
	return queryTraces(client, u)
}

func getErrorTraces(client http.Client, endpoint *url.URL, namespace string, service string) (errorTraces int, err error) {
	errorTraces = 0
	err = nil
	u := endpoint
	u.Path = path.Join(u.Path, "/api/traces")

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
	traces, _, err := queryTraces(client, u)
	if err != nil {
		return -1, err
	}
	return len(traces), err
}

func queryTraces(client http.Client, u *url.URL) ([]jaegerModels.Trace, int, error) {
	resp, code, reqError := makeRequest(client, u.String(), nil)
	if reqError != nil {
		log.Errorf("Jaeger query error: %s [URL: %v]", reqError, u)
		return []jaegerModels.Trace{}, code, reqError
	}
	if code != http.StatusOK {
		return []jaegerModels.Trace{}, code, fmt.Errorf("Jaeger query failed, response code: %d", code)
	}
	var response struct {
		Data []jaegerModels.Trace `json:"data"`
	}
	if errMarshal := json.Unmarshal([]byte(resp), &response); errMarshal != nil {
		log.Errorf("Error unmarshalling Jaeger response: %s [URL: %v]", errMarshal, u)
		return []jaegerModels.Trace{}, code, errMarshal
	}
	return response.Data, code, nil
}
