package tempo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/store"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	otel "github.com/kiali/kiali/tracing/otel/model"
	"github.com/kiali/kiali/tracing/otel/model/converter"
	otelModels "github.com/kiali/kiali/tracing/otel/model/json"
	"github.com/kiali/kiali/util"
)

const (
	expirationCheckInterval = 1 * time.Minute
	TTL                     = 5 * time.Minute
)

type OtelHTTPClient struct {
	TempoCache store.Store[string, *model.TracingSingleTrace]
}

// New client
func NewOtelClient(ctx context.Context) (otelClient *OtelHTTPClient, err error) {

	otelHTTPClient := &OtelHTTPClient{}
	if config.Get().ExternalServices.Tracing.TempoConfig.CacheEnabled {
		s := store.New[string, *model.TracingSingleTrace]()
		fifoStore := store.NewFIFOStore(s, config.Get().ExternalServices.Tracing.TempoConfig.CacheCapacity, "tempo")
		otelHTTPClient.TempoCache = store.NewExpirationStore[string, *model.TracingSingleTrace](ctx, fifoStore, util.AsPtr(TTL), util.AsPtr(expirationCheckInterval))
	}

	return otelHTTPClient, nil
}

// GetAppTracesHTTP search traces
func (oc *OtelHTTPClient) GetAppTracesHTTP(client http.Client, baseURL *url.URL, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/search")
	if q.End.Before(q.Start) {
		return nil, fmt.Errorf("end time must be greater than start time")
	}
	oc.prepareTraceQL(&url, serviceName, q)

	r, err := oc.queryTracesHTTP(client, &url, q.Tags["error"])

	if r != nil {
		r.TracingServiceName = serviceName
	}
	return r, err
}

// GetTraceDetailHTTP get one trace by trace ID
func (oc *OtelHTTPClient) GetTraceDetailHTTP(client http.Client, endpoint *url.URL, traceID string) (*model.TracingSingleTrace, error) {
	u := *endpoint
	if config.Get().ExternalServices.Tracing.TempoConfig.CacheEnabled {
		if result, isCached := oc.TempoCache.Get(traceID); isCached {
			return result, nil
		}
	}
	u.Path = path.Join(u.Path, "/api/traces/", traceID)
	resp, code, reqError := makeRequest(client, u.String(), nil)
	if reqError != nil {
		log.Errorf("[HTTP Tempo] API Tempo query error: %s [code: %d, URL: %v]", reqError, code, u)
		return nil, reqError
	}
	if code != 200 {
		errorMsg := fmt.Sprintf("[HTTP Tempo] Error returning traces: %s", resp)
		log.Errorf("%s", errorMsg)
		var errorTrace []model.StructuredError
		errorTrace = append(errorTrace, model.StructuredError{TraceID: traceID, Code: code, Msg: errorMsg})
		return &model.TracingSingleTrace{Errors: errorTrace}, errors.New(errorMsg)
	}

	if len(resp) == 0 {
		return nil, errors.New("[HTTP Tempo] empty body response")
	}

	responseOtel, _ := unmarshalSingleTrace(resp, &u)

	response, err := convertSingleTrace(responseOtel, traceID)
	if err != nil {
		return nil, err
	}
	if len(response.Data) == 0 {
		return &model.TracingSingleTrace{Errors: response.Errors}, nil
	}
	if config.Get().ExternalServices.Tracing.TempoConfig.CacheEnabled {
		oc.TempoCache.Set(traceID, &model.TracingSingleTrace{
			Data:   response.Data[0],
			Errors: response.Errors,
		})
	}
	return &model.TracingSingleTrace{
		Data:   response.Data[0],
		Errors: response.Errors,
	}, nil
}

// GetServiceStatusHTTP get service status
func (oc *OtelHTTPClient) GetServiceStatusHTTP(client http.Client, baseURL *url.URL) (bool, error) {
	var u url.URL
	healthCheckUrl := config.Get().ExternalServices.Tracing.HealthCheckUrl
	if healthCheckUrl != "" {
		url, err := u.Parse(healthCheckUrl)
		if err != nil {
			return false, fmt.Errorf("[HTTP Tempo] Error %s incorrect healthCheckUrl", err)
		}
		u = *url
	} else {
		u = *baseURL
		u.Path = path.Join(u.Path, "/status/services")
	}

	_, status, reqError := makeRequest(client, u.String(), nil)
	if status != 200 {
		return false, fmt.Errorf("[HTTP Tempo] Error %d getting status services", status)
	}
	return reqError == nil, reqError
}

// queryTracesHTTP
func (oc *OtelHTTPClient) queryTracesHTTP(client http.Client, u *url.URL, error string) (*model.TracingResponse, error) {
	// HTTP and GRPC requests co-exist, but when minDuration is present, for HTTP it requires a unit (ms)
	// https://github.com/kiali/kiali/issues/3939
	minDuration := u.Query().Get("minDuration")
	if minDuration != "" && !strings.HasSuffix(minDuration, "ms") {
		query := u.Query()
		query.Set("minDuration", minDuration)
		u.RawQuery = query.Encode()
	}
	resp, code, reqError := makeRequest(client, u.String(), nil)
	if reqError != nil {
		log.Errorf("Tempo API query error: %s [code: %d, URL: %v]", reqError, code, u)
		return &model.TracingResponse{}, reqError
	}
	if code != 200 {
		errorMsg := fmt.Sprintf("[HTTP Tempo] Tempo API query error: %s [code: %d, URL: %v]", resp, code, u)
		log.Errorf("%s", errorMsg)
		return &model.TracingResponse{}, errors.New(errorMsg)
	}
	limit, err := strconv.Atoi(u.Query().Get("limit"))
	if err != nil {
		limit = 0
	}
	response, _ := unmarshal(resp, u)

	return oc.transformTrace(response, error, limit)
}

// transformTrace processes every trace ID and make a request to get all the spans for that trace
func (oc *OtelHTTPClient) transformTrace(traces *otel.Traces, error string, limit int) (*model.TracingResponse, error) {
	var response model.TracingResponse
	serviceName := ""

	if traces != nil {
		for i, trace := range traces.Traces {
			if limit != 0 && i >= limit {
				break
			}
			serviceName = getServiceName(trace.SpanSet.Spans[0].Attributes)
			if error == "true" {
				if !hasErrors(trace) {
					continue
				}
			}
			batchTrace, err := convertBatchTrace(trace, serviceName)
			if err != nil {
				log.Errorf("[HTTP Tempo] Error getting trace detail for %s: %s", trace.TraceID, err.Error())
			} else {
				response.Data = append(response.Data, batchTrace)
			}
		}
	}

	response.TracingServiceName = serviceName
	return &response, nil
}

func unmarshal(r []byte, u *url.URL) (*otel.Traces, error) {
	var response otel.Traces
	if errMarshal := json.Unmarshal(r, &response); errMarshal != nil {
		log.Errorf("[HTTP Tempo] Error unmarshalling Tempo API response: %s [URL: %v]", errMarshal, u)
		return nil, errMarshal
	}

	return &response, nil
}

func unmarshalSingleTrace(r []byte, u *url.URL) (*otelModels.Data, error) {
	var response otelModels.Data
	if errMarshal := json.Unmarshal(r, &response); errMarshal != nil {
		log.Errorf("[HTTP Tempo] Error unmarshalling Tempo API Single trace response: %s [URL: %v]", errMarshal, u)
		return nil, errMarshal
	}

	return &response, nil
}

// convertBatchTrace Convert a trace returned by TraceQL query into a jaeger Trace
func convertBatchTrace(trace otel.Trace, serviceName string) (jaegerModels.Trace, error) {

	var jaegerModel jaegerModels.Trace

	jaegerModel.TraceID = converter.ConvertId(trace.TraceID)
	for _, span := range trace.SpanSet.Spans {
		jaegerModel.Spans = append(jaegerModel.Spans, converter.ConvertSpanSet(span, serviceName, trace.TraceID, trace.RootTraceName)...)
	}
	jaegerModel.Matched = trace.SpanSet.Matched
	jaegerModel.Processes = map[jaegerModels.ProcessID]jaegerModels.Process{}
	jaegerModel.Warnings = []string{}

	return jaegerModel, nil
}

// convertSingleTrace Convert a single trace returned by the TraceQL search endpoint
func convertSingleTrace(traces *otelModels.Data, id string) (*model.TracingResponse, error) {
	var response model.TracingResponse
	var jaegerModel jaegerModels.Trace
	tracingServiceName := ""

	jaegerModel.TraceID = converter.ConvertId(id)
	if traces != nil {
		tracingServiceName = getServiceName(traces.Batches[0].Resource.Attributes)
		for _, batch := range traces.Batches {
			serviceName := getServiceName(batch.Resource.Attributes)
			jaegerModel.Spans = append(jaegerModel.Spans, converter.ConvertSpans(batch.ScopeSpans[0].Spans, serviceName, id)...)
		}
		jaegerModel.Matched = len(jaegerModel.Spans)
		jaegerModel.Processes = map[jaegerModels.ProcessID]jaegerModels.Process{}
		jaegerModel.Warnings = []string{}

	}

	response.Data = append(response.Data, jaegerModel)

	response.TracingServiceName = tracingServiceName
	return &response, nil
}

// prepareTraceQL set the query in TraceQL format
func (oc *OtelHTTPClient) prepareTraceQL(u *url.URL, tracingServiceName string, query models.TracingQuery) {
	q := url.Values{}
	q.Set("start", fmt.Sprintf("%d", query.Start.Unix()))
	q.Set("end", fmt.Sprintf("%d", query.End.Unix()))

	// For Ambient, the service name is the waypoint
	serviceName := tracingServiceName
	// The Waypoint reports traces using its name as service name
	if query.Waypoint.Name != "" {
		c := config.Get()
		if c.ExternalServices.Tracing.NamespaceSelector {
			serviceName = fmt.Sprintf("%s.%s", query.Waypoint.Name, query.Waypoint.Namespace)
		} else {
			serviceName = query.Waypoint.Name
		}
	}
	queryPart := TraceQL{operator1: ".service.name", operand: EQUAL, operator2: serviceName}

	if len(query.Tags) > 0 {
		for k, v := range query.Tags {
			tag := TraceQL{operator1: "." + k, operand: EQUAL, operator2: v}
			queryPart = TraceQL{operator1: queryPart, operand: AND, operator2: tag}
		}
	}

	selects := []string{"status", ".service_name", ".node_id", ".component", ".upstream_cluster", ".http.method", ".response_flags", "resource.hostname", "name"}
	trace := TraceQL{operator1: Subquery{queryPart}, operand: AND, operator2: Subquery{}}
	queryQL := fmt.Sprintf("%s| %s", printOperator(trace), printSelect(selects))

	q.Set("q", queryQL)
	if query.MinDuration > 0 {
		q.Set("minDuration", fmt.Sprintf("%dms", query.MinDuration.Milliseconds()))
	}
	// By default, the number of spans returned is 3. All are needed to calculate avg and heatmap
	q.Set("spss", "10")
	if query.Limit > 0 {
		q.Set("limit", strconv.Itoa(query.Limit))
	}
	u.RawQuery = q.Encode()
	log.Debugf("[HTTP Tempo] Prepared Tempo API query: %v", u)
}

// GetTraceQLQuery returns the raw query in TraceQL format
func (oc *OtelHTTPClient) GetTraceQLQuery(u *url.URL, tracingServiceName string, query models.TracingQuery) string {
	oc.prepareTraceQL(u, tracingServiceName, query)
	return u.RawQuery
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

func hasErrors(trace otel.Trace) bool {
	for _, span := range trace.SpanSet.Spans {
		for _, atb := range span.Attributes {
			if atb.Key == "status" && atb.Value.StringValue == "error" {
				return true
			}
		}
		if span.Status.Code == "STATUS_CODE_ERROR" {
			return true
		}
	}
	return false
}

func getServiceName(attributes []otelModels.Attribute) string {
	for _, attb := range attributes {
		if attb.Key == "service.name" {
			return attb.Value.StringValue
		}
	}
	return ""
}
