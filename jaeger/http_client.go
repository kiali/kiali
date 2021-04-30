package jaeger

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

func getAppTracesHTTP(client http.Client, baseURL *url.URL, namespace, app string, q models.TracingQuery) (response *JaegerResponse, err error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/traces")
	jaegerServiceName := buildJaegerServiceName(namespace, app)
	prepareQuery(&url, jaegerServiceName, q)
	r, err := queryTracesHTTP(client, &url)
	if r != nil {
		r.JaegerServiceName = jaegerServiceName
	}
	return r, err
}

func getTraceDetailHTTP(client http.Client, endpoint *url.URL, traceID string) (*JaegerSingleTrace, error) {
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

func queryTracesHTTP(client http.Client, u *url.URL) (*JaegerResponse, error) {
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

func prepareQuery(u *url.URL, jaegerServiceName string, query models.TracingQuery) {
	q := url.Values{}
	q.Set("service", jaegerServiceName)
	q.Set("start", fmt.Sprintf("%d", query.Start.Unix()*time.Second.Microseconds()))
	q.Set("end", fmt.Sprintf("%d", query.End.Unix()*time.Second.Microseconds()))
	if len(query.Tags) > 0 {
		// Tags must be json encoded
		tags, err := json.Marshal(query.Tags)
		if err != nil {
			log.Errorf("Jager query: error while marshalling tags to json: %v", err)
		}
		q.Set("tags", string(tags))
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
	response, err = ioutil.ReadAll(resp.Body)
	status = resp.StatusCode
	return
}
