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

func getTraces(client http.Client, endpoint *url.URL, namespace string, service string, rawQuery string) (traces []*jaegerModels.Trace, code int, err error) {
	code = 0
	u := endpoint
	if config.Get().ExternalServices.Tracing.NamespaceSelector {
		service = service + "." + namespace
	}
	u.Path = path.Join(u.Path, "/api/traces")
	q, _ := url.ParseQuery(rawQuery)
	q.Add("service", service)
	u.RawQuery = q.Encode()
	resp, code, err := makeRequest(client, u.String(), nil)
	if err != nil {
		log.Errorf("Error request Jaeger URL : %s", err)
		return
	}
	var jaegerResponse struct {
		Data []*jaegerModels.Trace `json:"data"`
	}
	if err = json.Unmarshal([]byte(resp), &jaegerResponse); err != nil {
		log.Errorf("Error Unmarshal Jaeger Response fetching Services: %s", err)
		return
	}
	traces = jaegerResponse.Data
	code = 200
	return
}

func getTraceDetail(client http.Client, endpoint *url.URL, traceID string) (trace []*jaegerModels.Trace, code int, err error) {
	code = 0
	u := endpoint
	u.Path = path.Join(u.Path, "/api/traces/"+traceID)

	resp, code, err := makeRequest(client, u.String(), nil)
	if err != nil {
		log.Errorf("Error request Jaeger URL : %s", err)
		return
	}
	var jaegerResponse struct {
		Data []*jaegerModels.Trace `json:"data"`
	}
	if err = json.Unmarshal([]byte(resp), &jaegerResponse); err != nil {
		log.Errorf("Error Unmarshal Jaeger Response fetching Services: %s", err)
		return
	}
	trace = jaegerResponse.Data
	code = 200
	return
}

func getErrorTraces(client http.Client, endpoint *url.URL, namespace string, service string) (errorTraces int, err error) {
	errorTraces = 0
	err = nil
	// Be sure to copy config.Auth and not modify the existing
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
	resp, code, err := makeRequest(client, u.String(), nil)
	if err != nil {
		log.Errorf("Error fetching Jaeger Error Traces (%d): %s", code, err)
		return -1, err
	} else {
		if code != http.StatusOK {
			return -1, fmt.Errorf("error from Jaeger (%d)", code)
		}
		var traces struct {
			Data []*jaegerModels.Trace `json:"data"`
		}

		if errMarshal := json.Unmarshal([]byte(resp), &traces); errMarshal != nil {
			log.Errorf("Error Unmarshal Jaeger Response fetching Error Traces: %s", errMarshal)
			err = errMarshal
			return -1, err
		}
		errorTraces = len(traces.Data)
	}
	return errorTraces, err
}
