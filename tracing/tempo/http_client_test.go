package tempo

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	"github.com/kiali/kiali/tracing/jaeger/model/json"
	otelJson "github.com/kiali/kiali/tracing/otel/model/json"
)

const (
	responseFile        = "../tracingtest/response.json"
	responseAmbientFile = "../tracingtest/responseAmbient.json"
	responseTrace       = "../tracingtest/responseTrace.json"
	tracingUrl          = "http://tracing.tempo"
	serviceName         = "productpage.bookinfo"
	ambientServiceName  = "waypoint.bookinfo"
)

type RoundTripFunc func(req *http.Request) *http.Response

func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

func getBaseUrl() *url.URL {
	baseUrl, _ := url.Parse(tracingUrl)
	return baseUrl
}

func TestGetTraces(t *testing.T) {
	baseUrl := getBaseUrl()

	resp, err := os.Open(responseFile)
	assert.Nil(t, err)
	defer resp.Close()

	byteValue, _ := io.ReadAll(resp)

	httpClient := http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(string(byteValue))),
		}
	})}

	tempoClient, err := NewOtelClient(context.TODO())
	assert.Nil(t, err)
	assert.NotNil(t, tempoClient)

	q := models.TracingQuery{
		Start:       time.Time{},
		End:         time.Time{},
		Tags:        nil,
		MinDuration: 0,
		Limit:       0,
		Cluster:     "",
	}
	response, err := tempoClient.GetAppTracesHTTP(context.Background(), httpClient, baseUrl, serviceName, q)
	assert.Nil(t, err)
	assert.NotNil(t, response)
	assert.Equal(t, response.TracingServiceName, serviceName)
	assert.Nil(t, response.Errors)
	assert.NotNil(t, response.Data)
	assert.Equal(t, response.Data[0].TraceID, json.TraceID("100cb753c787ed5657c8d88dafc176ed"))
	assert.Equal(t, len(response.Data[0].Spans), 3)
	assert.Equal(t, response.Data[0].Spans[0].OperationName, "productpage.bookinfo.svc.cluster.local:9080/productpage")
	assert.Equal(t, response.Data[0].Spans[0].Tags[0].Key, "node_id")
	assert.Equal(t, response.Data[0].Spans[0].Tags[0].Value, "sidecar~10.244.0.20~reviews-v1-667b5cc65d-4m24g.bookinfo~bookinfo.svc.cluster.local")
}

func TestGetAmbientTraces(t *testing.T) {
	baseUrl := getBaseUrl()

	resp, err := os.Open(responseAmbientFile)
	assert.Nil(t, err)
	defer resp.Close()

	byteValue, _ := io.ReadAll(resp)

	httpClient := http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(string(byteValue))),
		}
	})}

	tempoClient, err := NewOtelClient(context.TODO())
	assert.Nil(t, err)
	assert.NotNil(t, tempoClient)

	q := models.TracingQuery{
		Start:       time.Time{},
		End:         time.Time{},
		Tags:        nil,
		MinDuration: 0,
		Limit:       0,
		Cluster:     "",
	}
	response, err := tempoClient.GetAppTracesHTTP(context.Background(), httpClient, baseUrl, ambientServiceName, q)
	assert.Nil(t, err)
	assert.NotNil(t, response)
	assert.Equal(t, response.TracingServiceName, ambientServiceName)
	assert.Nil(t, response.Errors)
	assert.NotNil(t, response.Data)
	assert.Equal(t, response.Data[0].TraceID, json.TraceID("2e299711ce47710289dc6640727404f"))
	assert.Equal(t, len(response.Data[0].Spans), 4)
	assert.Equal(t, response.Data[0].Spans[1].OperationName, "reviews.bookinfo.svc.cluster.local:9080/*")
	assert.Equal(t, response.Data[0].Spans[1].Tags[2].Key, "node_id")
	assert.Equal(t, response.Data[0].Spans[1].Tags[2].Value, "waypoint~10.244.0.28~waypoint-5b7c754ccb-55jwk.bookinfo~bookinfo.svc.cluster.local")
}

func TestGetTrace(t *testing.T) {
	baseUrl := getBaseUrl()

	resp, err := os.Open(responseTrace)
	assert.Nil(t, err)
	defer resp.Close()

	byteValue, _ := io.ReadAll(resp)

	httpClient := http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(string(byteValue))),
		}
	})}

	tempoClient, err := NewOtelClient(context.TODO())
	assert.Nil(t, err)
	assert.NotNil(t, tempoClient)

	response, err := tempoClient.GetTraceDetailHTTP(context.Background(), httpClient, baseUrl, "3ba55609c3cde49649cd77d1f9dcd936")
	assert.Nil(t, err)
	assert.NotNil(t, response)
	assert.Equal(t, response.Data.TraceID, json.TraceID("3ba55609c3cde49649cd77d1f9dcd936"))
	assert.Nil(t, response.Errors)
	assert.NotNil(t, response.Data)
	assert.Equal(t, len(response.Data.Spans), 8)
	assert.Equal(t, response.Data.Matched, 8)
}

func TestErrorResponse(t *testing.T) {
	baseUrl := getBaseUrl()

	httpClient := http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusInternalServerError,
			Body:       io.NopCloser(strings.NewReader(`invalid TraceQL query: parse error at line 1, col 99: syntax error: unexpected IDENTIFIER`)),
		}
	})}

	tempoClient, err := NewOtelClient(context.TODO())
	assert.Nil(t, err)
	assert.NotNil(t, tempoClient)

	q := models.TracingQuery{
		Start:       time.Time{},
		End:         time.Time{},
		Tags:        nil,
		MinDuration: 0,
		Limit:       0,
		Cluster:     "",
	}
	response, err := tempoClient.GetAppTracesHTTP(context.Background(), httpClient, baseUrl, serviceName, q)
	assert.NotNil(t, err)
	assert.NotNil(t, response)
	assert.Nil(t, response.Data)
	assert.Equal(t, response.TracingServiceName, serviceName)
}

// Test prepare query method
func TestQuery(t *testing.T) {
	baseUrl := getBaseUrl()

	tempoClient, err := NewOtelClient(context.TODO())
	assert.Nil(t, err)
	assert.NotNil(t, tempoClient)

	q := models.TracingQuery{
		Start:       time.Time{},
		End:         time.Time{},
		Tags:        nil,
		MinDuration: 0,
		Limit:       0,
		Cluster:     "",
	}
	query := tempoClient.GetTraceQLQuery(context.Background(), baseUrl, serviceName, q)
	assert.NotNil(t, query)
	rawQuery, err := url.QueryUnescape(query)
	assert.Nil(t, err)
	assert.Contains(t, rawQuery, fmt.Sprintf(".service.name = \"%s\"", serviceName))
	// Verify it contains all the selects
	assert.Contains(t, rawQuery, "select(status, .service_name, .node_id, .component, .upstream_cluster, .http.method, .response_flags, .istio.destination_workload, .istio.destination_namespace, .istio.destination_instance_name, .istio.destination_canonical_service, .istio.source_workload, .istio.source_namespace, .istio.source_instance_name, .istio.source_canonical_service, resource.hostname, .istio.namespace, .istio.cluster_id, resource.k8s.namespace.name, resource.k8s.cluster.name, name)")
	// Verify it doesn't contain the cluster tag as a query predicate (the
	// authorization attribute may still appear among the selects).
	assert.NotContains(t, rawQuery, models.IstioClusterTag+" =")
	// Verify it contains spans limit
	assert.Contains(t, rawQuery, "spss=10")
	// Verify it contains start
	assert.Contains(t, rawQuery, "start=")
	// Verify it contains end
	assert.Contains(t, rawQuery, "end=")

	// Test tags
	q2 := models.TracingQuery{
		Start: time.Time{},
		End:   time.Time{},
		Tags: map[string]string{
			"istio.mesh_id":    "mesh_hack",
			"istio.cluster_id": "east",
			"custom":           "value",
		},
		MinDuration: 0,
		Limit:       0,
		Cluster:     "",
	}
	query2 := tempoClient.GetTraceQLQuery(context.Background(), baseUrl, serviceName, q2)
	assert.NotNil(t, query2)
	rawQuery2, err2 := url.QueryUnescape(query2)
	assert.Nil(t, err2)
	assert.Contains(t, rawQuery2, fmt.Sprintf(".service.name = \"%s\"", serviceName))
	assert.Contains(t, rawQuery2, ".istio.mesh_id = \"mesh_hack\"")
	assert.Contains(t, rawQuery2, ".custom = \"value\"")
	// Should contain Cluster tag
	assert.Contains(t, rawQuery2, ".istio.cluster_id = \"east\"")

	query3 := tempoClient.GetTraceQLQuery(context.Background(), baseUrl, serviceName, q2)
	assert.NotNil(t, query3)
	rawQuery3, err3 := url.QueryUnescape(query3)
	assert.Nil(t, err3)
	assert.Contains(t, rawQuery3, fmt.Sprintf(".service.name = \"%s\"", serviceName))
	assert.Contains(t, rawQuery3, ".istio.mesh_id = \"mesh_hack\"")
	assert.Contains(t, rawQuery3, ".custom = \"value\"")
	assert.Contains(t, rawQuery3, ".istio.cluster_id = \"east\"")
}

// TestConvertSingleTraceSurfacesNamespaceResourceTags pins the converter
// extension that span-namespace authorization depends on: the OTel
// converters only use resource attributes for the service name, so the
// namespace-bearing ones must be surfaced as Jaeger process tags — otherwise
// traces whose only namespace information lives in resource attributes
// (k8s.namespace.name) would be denied by business.traceNamespaces.
func TestConvertSingleTraceSurfacesNamespaceResourceTags(t *testing.T) {
	data := &otelJson.Data{
		Batches: []otelJson.Batch{{
			Resource: otelJson.Resource{
				Attributes: []otelJson.Attribute{
					{Key: "service.name", Value: otelJson.ValueString{StringValue: "my-app"}},
					{Key: "k8s.namespace.name", Value: otelJson.ValueString{StringValue: "my-ns"}},
					{Key: "unrelated.attr", Value: otelJson.ValueString{StringValue: "x"}},
				},
			},
			ScopeSpans: []otelJson.ScopeSpan{{
				Spans: []otelJson.Span{{
					TraceID:           "abcdef1234567890",
					SpanID:            "s1",
					Name:              "GET /",
					Kind:              "SPAN_KIND_SERVER",
					StartTimeUnixNano: "1700000000000000000",
					EndTimeUnixNano:   "1700000001000000000",
				}},
			}},
		}},
	}

	resp, err := convertSingleTrace(data, "abcdef1234567890")
	require.NoError(t, err)
	require.Len(t, resp.Data, 1)

	spans := resp.Data[0].Spans
	require.Len(t, spans, 1)
	require.NotNil(t, spans[0].Process, "the converted span must carry a process")

	var found bool
	for _, tag := range spans[0].Process.Tags {
		if tag.Key == "k8s.namespace.name" {
			found = true
			require.Equal(t, "my-ns", tag.Value)
		}
		if tag.Key == "unrelated.attr" {
			t.Errorf("unrelated resource attributes must not be surfaced: %v", tag)
		}
	}
	require.True(t, found, "k8s.namespace.name must be surfaced as a process tag")
	assert.Equal(t, "my-app", spans[0].Process.ServiceName)
}

// TestConvertSingleTraceSurfacesClusterResourceTags pins the converter
// extension the cluster-aware trace authorization depends on: the
// cluster-bearing OTel resource attribute (k8s.cluster.name) must be
// surfaced as a Jaeger process tag — otherwise Tempo traces lose their
// cluster attribution and their namespaces fall back to name-only
// authorization in CheckTraceAccess.
func TestConvertSingleTraceSurfacesClusterResourceTags(t *testing.T) {
	data := &otelJson.Data{
		Batches: []otelJson.Batch{{
			Resource: otelJson.Resource{
				Attributes: []otelJson.Attribute{
					{Key: "service.name", Value: otelJson.ValueString{StringValue: "my-app"}},
					{Key: "k8s.cluster.name", Value: otelJson.ValueString{StringValue: "cluster-b"}},
					{Key: "unrelated.attr", Value: otelJson.ValueString{StringValue: "x"}},
				},
			},
			ScopeSpans: []otelJson.ScopeSpan{{
				Spans: []otelJson.Span{{
					TraceID:           "abcdef1234567890",
					SpanID:            "s1",
					Name:              "GET /",
					Kind:              "SPAN_KIND_SERVER",
					StartTimeUnixNano: "1700000000000000000",
					EndTimeUnixNano:   "1700000001000000000",
				}},
			}},
		}},
	}

	resp, err := convertSingleTrace(data, "abcdef1234567890")
	require.NoError(t, err)
	require.Len(t, resp.Data, 1)

	spans := resp.Data[0].Spans
	require.Len(t, spans, 1)
	require.NotNil(t, spans[0].Process, "the converted span must carry a process")

	var found bool
	for _, tag := range spans[0].Process.Tags {
		if tag.Key == "k8s.cluster.name" {
			found = true
			require.Equal(t, "cluster-b", tag.Value)
		}
		if tag.Key == "unrelated.attr" {
			t.Errorf("unrelated resource attributes must not be surfaced: %v", tag)
		}
	}
	require.True(t, found, "k8s.cluster.name must be surfaced as a process tag")
}

// TestTraceSelectsCoverAuthorizationAttributes pins the contract between
// the TraceQL select list and the per-trace list authorization
// (business.traceInNamespace): every namespace- or cluster-bearing attribute
// the extraction recognizes must be selected by the search query, in the
// form Tempo reports it (span attributes unqualified, OTel resource
// attributes selected as resource.<name> and reported unqualified). A trace
// whose namespace exists only as a resource attribute is accessible through
// the details (the full trace carries resource attributes) and must stay in
// the lists too.
func TestTraceSelectsCoverAuthorizationAttributes(t *testing.T) {
	assert := assert.New(t)

	// The attributes that live at the resource level in the OTel data model
	// (the k8s.* enrichment); every other key is a span attribute.
	resourceAttributes := map[string]bool{
		"k8s.cluster.name":   true,
		"k8s.namespace.name": true,
	}

	for _, key := range append(slices.Clone(model.NamespaceTagKeys), model.ClusterTagKeys...) {
		if resourceAttributes[key] {
			assert.Contains(traceSelects, "resource."+key, "the resource attribute %s must be selected", key)
		} else {
			assert.Contains(traceSelects, "."+key, "the span attribute %s must be selected", key)
		}
	}
}

// TestConvertBatchTracePreservesAuthorizationAttributes pins the
// search-response conversion side of the same contract: attributes selected
// by the query (including the OTel resource attributes, which Tempo reports
// unqualified) must survive into the Jaeger span tags that
// business.traceInNamespace reads. Without them, a resource-attributed trace
// would be dropped from the trace lists while remaining accessible through
// the trace details.
func TestConvertBatchTracePreservesAuthorizationAttributes(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// A Tempo search answer whose spans carry the authorization attributes:
	// namespace only as the (resource) k8s.namespace.name, plus cluster
	// attribution. This is the shape traceSelects asks the backend for.
	searchResponse := `{
		"traces": [{
			"traceID": "abcdef1234567890abcdef1234567890",
			"rootServiceName": "my-app",
			"rootTraceName": "GET /",
			"startTimeUnixNano": "1700000000000000000",
			"durationMs": 42,
			"spanSet": {
				"matched": 1,
				"spans": [{
					"spanID": "s1",
					"startTimeUnixNano": "1700000000000000000",
					"durationNanos": "42000000",
					"attributes": [
						{"key": "service.name", "value": {"stringValue": "my-app"}},
						{"key": "k8s.namespace.name", "value": {"stringValue": "bookinfo"}},
						{"key": "k8s.cluster.name", "value": {"stringValue": "cluster-a"}}
					]
				}]
			}
		}]
	}`

	httpClient := http.Client{Transport: RoundTripFunc(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(searchResponse)),
			Header:     http.Header{"Content-Type": []string{"application/json"}},
		}
	})}

	tempoClient, err := NewOtelClient(context.TODO())
	require.NoError(err)

	q := models.TracingQuery{Start: time.Time{}, End: time.Time{}, Limit: 0, Cluster: ""}
	response, err := tempoClient.GetAppTracesHTTP(context.Background(), httpClient, getBaseUrl(), "my-app", q)
	require.NoError(err)
	require.Len(response.Data, 1)

	spans := response.Data[0].Spans
	require.NotEmpty(t, spans)
	tags := make(map[string]string)
	for _, tag := range spans[0].Tags {
		if v, ok := tag.Value.(string); ok {
			tags[tag.Key] = v
		}
	}
	assert.Equal("bookinfo", tags["k8s.namespace.name"], "the namespace resource attribute must survive conversion as a span tag")
	assert.Equal("cluster-a", tags["k8s.cluster.name"], "the cluster resource attribute must survive conversion as a span tag")
}
