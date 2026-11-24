package tempo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/url"
	"path"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/store"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/tracing/otel"
	otelModel "github.com/kiali/kiali/tracing/otel/model"
	"github.com/kiali/kiali/tracing/otel/model/converter"
	otelJson "github.com/kiali/kiali/tracing/otel/model/json"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/httputil"
)

const (
	expirationCheckInterval = 1 * time.Minute
	TTL                     = 5 * time.Minute
)

type OtelHTTPClient struct {
	HealthCheckURL string
	TempoCache     store.Store[string, *model.TracingSingleTrace]
}

// New client
func NewOtelClient(ctx context.Context) (otelClient *OtelHTTPClient, err error) {

	conf := config.Get()
	otelHTTPClient := &OtelHTTPClient{HealthCheckURL: conf.ExternalServices.Tracing.HealthCheckUrl}
	if conf.ExternalServices.Tracing.TempoConfig.CacheEnabled {
		s := store.New[string, *model.TracingSingleTrace]()
		fifoStore := store.NewFIFOStore(s, conf.ExternalServices.Tracing.TempoConfig.CacheCapacity, "tempo")
		otelHTTPClient.TempoCache = store.NewExpirationStore[string, *model.TracingSingleTrace](ctx, fifoStore, util.AsPtr(TTL), util.AsPtr(expirationCheckInterval))
	}

	return otelHTTPClient, nil
}

// GetAppTracesHTTP search traces
func (oc *OtelHTTPClient) GetAppTracesHTTP(ctx context.Context, client http.Client, baseURL *url.URL, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/search")
	if q.End.Before(q.Start) {
		return nil, fmt.Errorf("end time must be greater than start time")
	}
	oc.prepareTraceQL(ctx, &url, serviceName, q)

	r, err := oc.queryTracesHTTP(ctx, client, &url, q.Tags["error"])

	if r != nil {
		r.TracingServiceName = serviceName
	}
	return r, err
}

// GetTraceDetailHTTP get one trace by trace ID
func (oc *OtelHTTPClient) GetTraceDetailHTTP(ctx context.Context, client http.Client, endpoint *url.URL, traceID string) (*model.TracingSingleTrace, error) {
	u := *endpoint
	if config.Get().ExternalServices.Tracing.TempoConfig.CacheEnabled {
		if result, isCached := oc.TempoCache.Get(traceID); isCached {
			return result, nil
		}
	}

	zl := getLoggerFromContextHTTPTempo(ctx)

	u.Path = path.Join(u.Path, "/api/traces/", traceID)
	resp, code, reqError := otel.MakeRequest(ctx, client, u.String(), nil)
	if reqError != nil {
		zl.Error().Msgf("[HTTP Tempo] API Tempo query error: %s [code: %d, URL: %v]", reqError, code, u)
		return nil, reqError
	}
	if code != 200 {
		errorMsg := fmt.Sprintf("[HTTP Tempo] Error returning traces: %s", resp)
		zl.Error().Msg(errorMsg)
		var errorTrace []model.StructuredError
		errorTrace = append(errorTrace, model.StructuredError{TraceID: traceID, Code: code, Msg: errorMsg})
		return &model.TracingSingleTrace{Errors: errorTrace}, errors.New(errorMsg)
	}

	if len(resp) == 0 {
		return nil, errors.New("[HTTP Tempo] empty body response")
	}

	responseOtel, _ := unmarshalSingleTrace(ctx, resp, &u)

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

// ReadinessResult records the status and whether the request was credential-free.
type ReadinessResult struct {
	Anonymous  bool
	StatusCode int
}

func (r ReadinessResult) RequiresAuthentication() bool {
	return r.Anonymous && (r.StatusCode == http.StatusUnauthorized || r.StatusCode == http.StatusForbidden)
}

// ProbeReadinessHTTP keeps tracing credentials scoped to the query API's origin.
func (oc *OtelHTTPClient) ProbeReadinessHTTP(ctx context.Context, conf *config.Config, client http.Client, baseURL *url.URL) (ReadinessResult, error) {
	target := *baseURL
	if oc.HealthCheckURL == "" {
		target.Path = path.Join(target.Path, "/api/echo")
	} else {
		u, err := url.Parse(oc.HealthCheckURL)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
			return ReadinessResult{}, errors.New("invalid Tempo readiness URL")
		}
		target = *u
	}

	if client.Timeout <= 0 {
		client.Timeout = httputil.DefaultTimeout
	}
	client.CheckRedirect = httputil.SameOriginRedirect
	result := ReadinessResult{Anonymous: !httputil.SameOrigin(baseURL, &target)}
	if result.Anonymous {
		// A separate transport also excludes client certificates and custom headers.
		anonymous, err := httputil.NewProbeHTTPClient(conf, nil, client.Timeout, nil, httputil.AnonymousDiscoveryRedirect)
		if err != nil {
			return result, err
		}
		client = anonymous
	}

	// Readiness depends on the status, so discard the response without reading its body.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return result, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()
	result.StatusCode = resp.StatusCode
	return result, nil
}

func (oc *OtelHTTPClient) GetServiceStatusHTTP(ctx context.Context, client http.Client, baseURL *url.URL) (bool, error) {
	result, err := oc.ProbeReadinessHTTP(ctx, config.Get(), client, baseURL)
	if err != nil {
		return false, err
	}
	if result.RequiresAuthentication() {
		// Preserve the status check for deployments whose readiness endpoint
		// was authenticated. Query only the configured tracing API.
		err := oc.VerifySearchHTTP(ctx, client, baseURL)
		return err == nil, err
	}
	if result.StatusCode != http.StatusOK {
		return false, fmt.Errorf("[HTTP Tempo] Error %d getting readiness status", result.StatusCode)
	}
	return true, nil
}

// VerifySearchHTTP checks the configured query API with a bounded search.
func (oc *OtelHTTPClient) VerifySearchHTTP(ctx context.Context, client http.Client, baseURL *url.URL) error {
	target := *baseURL
	target.Path = path.Join(target.Path, "/api/search")
	end := time.Now()
	query := target.Query()
	query.Set("q", "{}")
	query.Set("limit", "1")
	query.Set("start", strconv.FormatInt(end.Add(-5*time.Minute).Unix(), 10))
	query.Set("end", strconv.FormatInt(end.Unix(), 10))
	target.RawQuery = query.Encode()

	client.CheckRedirect = httputil.SameOriginRedirect
	if client.Timeout <= 0 {
		client.Timeout = httputil.DefaultTimeout
	}
	resp, status, err := otel.MakeRequest(ctx, client, target.String(), nil)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		return fmt.Errorf("[HTTP Tempo] Search returned HTTP %d", status)
	}
	_, err = unmarshal(ctx, resp, baseURL)
	return err
}

// GetServices returns the services reported by Tempo.
func (oc *OtelHTTPClient) GetServices(ctx context.Context, client http.Client, baseURL *url.URL) (serviceList []string, err error) {
	var u url.URL
	servicesList := []string{}

	u = *baseURL
	u.Path = path.Join(u.Path, "/status/services")

	r, _, reqError := otel.MakeRequest(ctx, client, u.String(), nil)
	if errMarshal := json.Unmarshal(r, &servicesList); errMarshal != nil {
		getLoggerFromContextHTTPTempo(ctx).Error().Msgf("Error unmarshalling Jaeger response: %s", errMarshal)
		return nil, errMarshal
	}
	return servicesList, reqError
}

// queryTracesHTTP
func (oc *OtelHTTPClient) queryTracesHTTP(ctx context.Context, client http.Client, u *url.URL, error string) (*model.TracingResponse, error) {

	zl := getLoggerFromContextHTTPTempo(ctx)

	// HTTP and GRPC requests co-exist, but when minDuration is present, for HTTP it requires a unit (ms)
	// https://github.com/kiali/kiali/issues/3939
	minDuration := u.Query().Get("minDuration")
	if minDuration != "" && !strings.HasSuffix(minDuration, "ms") {
		query := u.Query()
		query.Set("minDuration", minDuration)
		u.RawQuery = query.Encode()
	}
	resp, code, reqError := otel.MakeRequest(ctx, client, u.String(), nil)
	if reqError != nil {
		zl.Error().Msgf("Tempo API query error: %s [code: %d, URL: %v]", reqError, code, u)
		return &model.TracingResponse{}, reqError
	}
	if code != 200 {
		errorMsg := fmt.Sprintf("[HTTP Tempo] Tempo API query error: %s [code: %d, URL: %v]", resp, code, u)
		zl.Error().Msg(errorMsg)
		return &model.TracingResponse{}, errors.New(errorMsg)
	}
	limit, err := strconv.Atoi(u.Query().Get("limit"))
	if err != nil {
		limit = 0
	}
	// Handle a failed unmarshal rather than dropping it, so a backend that is not Tempo gives a
	// meaningful error.
	response, errUnmarshal := unmarshal(ctx, resp, u)
	if errUnmarshal != nil {
		return &model.TracingResponse{}, errUnmarshal
	}

	return oc.transformTrace(ctx, response, error, limit)
}

// transformTrace processes every trace ID and make a request to get all the spans for that trace
func (oc *OtelHTTPClient) transformTrace(ctx context.Context, traces *otelModel.Traces, error string, limit int) (*model.TracingResponse, error) {
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
				zl := getLoggerFromContextHTTPTempo(ctx)
				zl.Error().Msgf("[HTTP Tempo] Error getting trace detail for %s: %v", trace.TraceID, err)
			} else {
				response.Data = append(response.Data, batchTrace)
			}
		}
	}

	response.TracingServiceName = serviceName
	return &response, nil
}

// The keys a Tempo search answer carries. It always has at least one of them, including when it
// matched nothing.
const (
	keyTraces  = "traces"
	keyMetrics = "metrics"
)

func unmarshal(ctx context.Context, r []byte, u *url.URL) (*otelModel.Traces, error) {
	response, err := DecodeSearchResponse(r)
	if err != nil {
		getLoggerFromContextHTTPTempo(ctx).Error().Msgf("[HTTP Tempo] Invalid search response: %s [address: %s]", err, u.Host)
	}
	return response, err
}

// DecodeSearchResponse requires a Tempo search envelope, including for empty results.
func DecodeSearchResponse(body []byte) (*otelModel.Traces, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, err
	}
	if envelope[keyTraces] == nil && envelope[keyMetrics] == nil {
		return nil, fmt.Errorf("[HTTP Tempo] not a Tempo search response: it has none of %q and %q, only %q",
			keyTraces, keyMetrics, slices.Sorted(maps.Keys(envelope)))
	}

	var response otelModel.Traces
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func unmarshalSingleTrace(ctx context.Context, r []byte, u *url.URL) (*otelJson.Data, error) {
	var response otelJson.Data
	if errMarshal := json.Unmarshal(r, &response); errMarshal != nil {
		getLoggerFromContextHTTPTempo(ctx).Error().Msgf("[HTTP Tempo] Error unmarshalling Tempo API Single trace response: %s [URL: %v]", errMarshal, u)
		return nil, errMarshal
	}

	return &response, nil
}

// convertBatchTrace Convert a trace returned by TraceQL query into a jaeger Trace
func convertBatchTrace(trace otelModel.Trace, serviceName string) (jaegerModels.Trace, error) {

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
func convertSingleTrace(traces *otelJson.Data, id string) (*model.TracingResponse, error) {
	var response model.TracingResponse
	var jaegerModel jaegerModels.Trace
	tracingServiceName := ""

	jaegerModel.TraceID = converter.ConvertId(id)
	if traces != nil {
		tracingServiceName = getServiceName(traces.Batches[0].Resource.Attributes)
		for _, batch := range traces.Batches {
			serviceName := getServiceName(batch.Resource.Attributes)
			spans := converter.ConvertSpans(batch.ScopeSpans[0].Spans, serviceName, id)
			// The OTel converters only use resource attributes for the service
			// name; surface the namespace- and cluster-bearing ones as process
			// tags so span authorization (business.traceNamespaces and the
			// cluster-aware CheckTraceAccess) can see them.
			nsTags := authorizationResourceTags(batch.Resource.Attributes)
			for _, span := range spans {
				span.Process.Tags = append(span.Process.Tags, nsTags...)
			}
			jaegerModel.Spans = append(jaegerModel.Spans, spans...)
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
func (oc *OtelHTTPClient) prepareTraceQL(ctx context.Context, u *url.URL, tracingServiceName string, query models.TracingQuery) {
	q := url.Values{}
	q.Set("start", fmt.Sprintf("%d", query.Start.Unix()))
	q.Set("end", fmt.Sprintf("%d", query.End.Unix()))

	// For Ambient, the service name is the waypoint
	queryPart := TraceQL{operator1: ".service.name", operand: EQUAL, operator2: tracingServiceName}

	if len(query.Tags) > 0 {
		for k, v := range query.Tags {
			var tag TraceQL
			if k == "error" {
				tag = TraceQL{operator1: ".http.status_code", operand: NOTEQUAL, operator2: "200"}
			} else {
				tag = TraceQL{operator1: "." + k, operand: EQUAL, operator2: v}
			}
			queryPart = TraceQL{operator1: queryPart, operand: AND, operator2: tag}
		}
	}

	selects := traceSelects
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

	getLoggerFromContextHTTPTempo(ctx).Debug().Msgf("[HTTP Tempo] Prepared Tempo API query: %v", u)
}

// GetTraceQLQuery returns the raw query in TraceQL format
func (oc *OtelHTTPClient) GetTraceQLQuery(ctx context.Context, u *url.URL, tracingServiceName string, query models.TracingQuery) string {
	oc.prepareTraceQL(ctx, u, tracingServiceName, query)
	return u.RawQuery
}

func hasErrors(trace otelModel.Trace) bool {
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

// authorizationResourceTags extracts the OTel resource attributes used for
// span authorization as Jaeger process tags: the namespace-bearing keys
// (model.NamespaceTagKeys) and the cluster-bearing keys
// (model.ClusterTagKeys). The OTel converters drop resource attributes
// (they only use them for the service name), which would otherwise hide
// namespace and cluster information from the trace access check. The key
// lists are shared with the span extraction in business/tracing.go so the
// two cannot drift.
func authorizationResourceTags(attributes []otelJson.Attribute) []jaegerModels.KeyValue {
	var tags []jaegerModels.KeyValue
	for _, attr := range attributes {
		if slices.Contains(model.NamespaceTagKeys, attr.Key) || slices.Contains(model.ClusterTagKeys, attr.Key) {
			tags = append(tags, jaegerModels.KeyValue{Key: attr.Key, Value: attr.Value.StringValue})
		}
	}
	return tags
}

func getServiceName(attributes []otelJson.Attribute) string {
	for _, attb := range attributes {
		if attb.Key == "service.name" {
			return attb.Value.StringValue
		}
	}
	return ""
}

// ConstructTempoTenantURL constructs a tenant-specific URL for Tempo provider if needed.
// This function checks if the URL is just the base server URL (no path or minimal path)
// and if so, appends the tenant-specific path.
func ConstructTempoTenantURL(u *url.URL, cfgTracing *config.TracingConfig, isInternalURL bool) {
	if cfgTracing.Provider == config.TempoProvider && cfgTracing.TempoConfig.Tenant != "" && isInternalURL {
		// Check if the URL is just the base server URL (no path or minimal path)
		// If so, append the tenant-specific path
		if u.Path == "" || u.Path == "/" {
			u.Path = fmt.Sprintf("/api/traces/v1/%s/tempo", cfgTracing.TempoConfig.Tenant)
			log.Debugf("Constructed Tempo tenant URL for address [%s]", u.Host)
		}
	}
}
