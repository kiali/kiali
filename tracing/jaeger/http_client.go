package jaeger

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	"github.com/kiali/kiali/util"
)

type JaegerHTTPClient struct {
}

// New client
func NewJaegerClient(client http.Client, baseURL *url.URL) (jaegerClient *JaegerHTTPClient, err error) {
	return &JaegerHTTPClient{}, nil
}

func (jc JaegerHTTPClient) GetAppTracesHTTP(client http.Client, baseURL *url.URL, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/traces")

	// if cluster exists in tags, use it
	prepareQuery(&url, serviceName, q)
	r, err := queryTracesHTTP(client, &url)

	if r != nil {
		r.TracingServiceName = serviceName

	}

	return r, err
}

func (jc JaegerHTTPClient) GetTraceDetailHTTP(client http.Client, endpoint *url.URL, traceID string) (*model.TracingSingleTrace, error) {
	u := *endpoint
	// /querier/api/traces/<traceid>?mode=xxxx&blockStart=0000&blockEnd=FFFF&start=<start>&end=<end>
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
	response, err := unmarshal(resp, &u)
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

func (jc JaegerHTTPClient) GetServiceStatusHTTP(client http.Client, baseURL *url.URL) (bool, error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/services")
	_, _, reqError := makeRequest(client, url.String(), nil)
	return reqError == nil, reqError
}

func queryTracesHTTP(client http.Client, u *url.URL) (*model.TracingResponse, error) {
	// HTTP and GRPC requests co-exist, but when minDuration is present, for HTTP it requires a unit (us)
	// https://github.com/kiali/kiali/issues/3939
	minDuration := u.Query().Get("minDuration")
	if minDuration != "" && !strings.HasSuffix(minDuration, "us") {
		query := u.Query()
		query.Set("minDuration", minDuration+"us")
		u.RawQuery = query.Encode()
	}
	resp, code, reqError := makeRequest(client, u.String(), nil)
	if reqError != nil {
		log.Errorf("Jaeger query error: %s [code: %d, URL: %v]", reqError, code, u)
		return &model.TracingResponse{}, reqError
	}
	return unmarshal(resp, u)
}

func unmarshal(r []byte, u *url.URL) (*model.TracingResponse, error) {
	var response model.TracingResponse
	if errMarshal := json.Unmarshal(r, &response); errMarshal != nil {
		log.Errorf("Error unmarshalling Jaeger response: %s [URL: %v]", errMarshal, u)
		return nil, errMarshal
	}
	return &response, nil
}

func prepareQuery(u *url.URL, jaegerServiceName string, query models.TracingQuery) {
	q := url.Values{}

	q.Set("service", jaegerServiceName)
	q.Set("start", fmt.Sprintf("%d", query.Start.Unix()*time.Second.Microseconds()))
	q.Set("end", fmt.Sprintf("%d", query.End.Unix()*time.Second.Microseconds()))
	var tags = util.CopyStringMap(query.Tags)

	if len(tags) > 0 {
		// Tags must be json encoded
		tagsJson, err := json.Marshal(tags)
		if err != nil {
			log.Errorf("Jaeger query: error while marshalling tags to json: %v", err)
		}
		q.Set("tags", string(tagsJson))
	}
	if query.MinDuration > 0 {
		q.Set("minDuration", fmt.Sprintf("%d", query.MinDuration.Microseconds()))
	}
	if query.Limit > 0 {
		q.Set("limit", strconv.Itoa(query.Limit))
	}
	u.RawQuery = q.Encode()
	log.Debugf("Prepared Jaeger query: %v", u)
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
