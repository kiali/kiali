package otel

import (
	"encoding/json"
	"fmt"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/model"
	jaegerModels "github.com/kiali/kiali/tracing/model/json"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
)

type OtelHTTPClient struct {
}

func (oc OtelHTTPClient) GetAppTracesHTTP(client http.Client, baseURL *url.URL, namespace, app string, q models.TracingQuery) (response *model.TracingResponse, err error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/search")
	tracingServiceName := buildJaegerServiceName(namespace, app)
	prepareQuery(&url, tracingServiceName, q)
	r, err := queryTracesHTTP(client, &url)
	if r != nil {
		r.TracingServiceName = tracingServiceName
	}
	return r, err
}

func (oc OtelHTTPClient) GetTraceDetailHTTP(client http.Client, endpoint *url.URL, traceID string) (*model.TracingSingleTrace, error) {
	u := *endpoint
	u.Path = path.Join(u.Path, "/api/search"+traceID)
	resp, code, reqError := makeRequest(client, u.String(), nil)
	if reqError != nil {
		log.Errorf("Jaeger query error: %s [code: %d, URL: %v]", reqError, code, u)
		return nil, reqError
	}
	// Jaeger would return "200 OK" when trace is not found, with an empty response
	if len(resp) == 0 {
		return nil, nil
	}
	response, err := unmarshal(resp, &u, "")
	if err != nil {
		return nil, err
	}
	if len(response.Data) == 0 {
		return &model.TracingSingleTrace{Errors: response.Errors}, nil
	}
	return &model.TracingSingleTrace{
		Data:   response.Data[0],
		Errors: response.Errors,
	}, nil
}

func (oc OtelHTTPClient) GetServiceStatusHTTP(client http.Client, baseURL *url.URL) (bool, error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/services")
	_, _, reqError := makeRequest(client, url.String(), nil)
	return reqError == nil, reqError
}

func queryTracesHTTP(client http.Client, u *url.URL) (*model.TracingResponse, error) {
	// HTTP and GRPC requests co-exist, but when minDuration is present, for HTTP it requires a unit (ms)
	// https://github.com/kiali/kiali/issues/3939
	minDuration := u.Query().Get("minDuration")
	if minDuration != "" && !strings.HasSuffix(minDuration, "ms") {
		query := u.Query()
		query.Set("minDuration", minDuration+"ms")
		u.RawQuery = query.Encode()
	}
	resp, code, reqError := makeRequest(client, u.String(), nil)
	if reqError != nil {
		log.Errorf("Jaeger query error: %s [code: %d, URL: %v]", reqError, code, u)
		return &model.TracingResponse{}, reqError
	}
	return unmarshal(resp, u, "")
}

func unmarshal(r []byte, u *url.URL, service string) (*model.TracingResponse, error) {
	var response model.OTelTracingResponse
	if errMarshal := json.Unmarshal(r, &response); errMarshal != nil {
		log.Errorf("Error unmarshalling Jaeger response: %s [URL: %v]", errMarshal, u)
		return nil, errMarshal
	}

	return convertTraces(&response, service), nil
}

func convertTraces(traces *model.OTelTracingResponse, service string) *model.TracingResponse {
	var response model.TracingResponse
	for _, trace := range traces.Traces {
		i, _ := strconv.ParseInt(trace.TraceID, 10, 64)
		t := jaegerModels.Trace{TraceID: jaegerModels.TraceID(i)}
		response.Data = append(response.Data, t)
	}
	response.TracingServiceName = service
	return &response
}

func prepareQuery(u *url.URL, tracingServiceName string, query models.TracingQuery) {
	q := url.Values{}
	//q.Set("tags", tracingServiceName)
	//q.Set("start", fmt.Sprintf("%d", query.Start.Unix()))
	//q.Set("end", fmt.Sprintf("%d", query.End.Unix()))
	q.Set("tags", "service.name="+tracingServiceName)
	//query.Tags["root.service.name"] = tracingServiceName
	//query.Tags["startTimeUnixNano"] = fmt.Sprintf("%d", query.Start.Unix()*time.Second.Nanoseconds())
	//query.Tags["root.service.name"] = tracingServiceName
	/*
		if len(query.Tags) > 0 {
			// Tags must be json encoded
			tags, err := json.Marshal(query.Tags)
			if err != nil {
				log.Errorf("Jager query: error while marshalling tags to json: %v", err)
			}
			q.Set("tags", string(tags))
		} */
	if query.MinDuration > 0 {
		q.Set("minDuration", fmt.Sprintf("%d", query.MinDuration.Seconds()))
	}
	if query.Limit > 0 {
		q.Set("limit", strconv.Itoa(query.Limit))
	}
	u.RawQuery = q.Encode()
	//log.Debugf("Prepared Jaeger query: %v", u)
	log.Infof("Prepared Jaeger query: %v", u)
}

func makeRequest(client http.Client, endpoint string, body io.Reader) (response []byte, status int, err error) {
	response = nil
	status = 0

	req, err := http.NewRequest(http.MethodGet, endpoint, body)
	if err != nil {
		return
	}
	req.Header.Add("Accept", "application/json")
	req.Header.Add("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	response, err = io.ReadAll(resp.Body)
	status = resp.StatusCode
	return
}
