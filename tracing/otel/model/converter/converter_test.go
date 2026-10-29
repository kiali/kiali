package converter

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	otelModels "github.com/kiali/kiali/tracing/otel/model/json"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
	v1 "github.com/kiali/kiali/tracing/tempo/tempopb/common/v1"
)

func TestConvertId(t *testing.T) {
	assert := assert.New(t)

	id := getId()
	jaegerId := ConvertId(id)
	assert.Equal(jaegerModels.TraceID(id), jaegerId)
}

func TestConvertSpanId(t *testing.T) {
	assert := assert.New(t)

	id := getId()
	jaegerId := convertSpanId(id)
	assert.Equal(jaegerModels.SpanID(id), jaegerId)
}

func TestConvertSpans(t *testing.T) {
	assert := assert.New(t)

	spans := getSpans()
	id := getId()
	serviceName := "kiali-traffic-generator.bookinfo"

	jaegerSpans := ConvertSpans(spans, serviceName, id)
	assert.Equal(jaegerModels.SpanID(id), jaegerSpans[0].SpanID)
	assert.Equal(serviceName, jaegerSpans[0].Process.ServiceName)
	assert.Equal("reviews.bookinfo.svc.cluster.local:9080/*", jaegerSpans[0].OperationName)
}

func getId() string {
	id := "727a0d200236314473666c051e6f65f4"
	return id
}

func getSpans() []otelModels.Span {
	var spans []otelModels.Span

	attbs := getAttributes()

	span := otelModels.Span{
		TraceID:           getId(),
		SpanID:            getId(),
		Name:              "reviews.bookinfo.svc.cluster.local:9080/*",
		Kind:              "SPAN_KIND_SERVER",
		StartTimeUnixNano: "1693389472310270000",
		EndTimeUnixNano:   "1693389472310916000",
		Attributes:        attbs,
		Events:            []otelModels.Event{},
		Status:            otelModels.Status{},
	}

	spans = append(spans, span)

	return spans
}

func getAttributes() []otelModels.Attribute {
	var attbs []otelModels.Attribute
	atb1 := otelModels.Attribute{Key: "guid:x-request-id", Value: otelModels.ValueString{StringValue: "48c7189e-1e39-9984-9556-20a8f2e8be45"}}
	atb2 := otelModels.Attribute{Key: "ttp.protocol\"", Value: otelModels.ValueString{StringValue: "HTTP/1.1"}}

	attbs = append(attbs, atb1)
	attbs = append(attbs, atb2)

	return attbs
}

// TestConvertTraceMetadataAttributes pins the gRPC search path's attribute
// shape: the authorization-bearing attributes (the namespace and cluster tag
// keys business.traceNamespaces reads, and the sidecar node_id) must survive
// the tempopb → Jaeger conversion verbatim as span tags, or every trace
// served through the gRPC client would be denied by the trace access check
// (fail closed). The status=error attribute maps to the boolean error tag.
func TestConvertTraceMetadataAttributes(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	strAttr := func(key, value string) *v1.KeyValue {
		return &v1.KeyValue{Key: key, Value: &v1.AnyValue{Value: &v1.AnyValue_StringValue{StringValue: value}}}
	}

	trace := tempopb.TraceSearchMetadata{
		TraceID:       getId(),
		RootTraceName: "reviews.bookinfo.svc.cluster.local:9080/*",
		SpanSet: &tempopb.SpanSet{
			Spans: []*tempopb.Span{{
				SpanID:            "2e6ca056f5fc6fdc",
				Name:              "reviews.bookinfo.svc.cluster.local:9080/*",
				StartTimeUnixNano: 1693389472310270000,
				DurationNanos:     646000,
				Attributes: []*v1.KeyValue{
					strAttr("istio.namespace", "bookinfo"),
					strAttr("istio.source_namespace", "bookinfo"),
					strAttr("k8s.namespace.name", "bookinfo"),
					strAttr("istio.cluster_id", "kiali"),
					strAttr("node_id", "sidecar~1.2.3.4~productpage-v1-abc~bookinfo~a.b.c"),
					strAttr("status", "error"),
				},
			}},
		},
	}

	converted, err := ConvertTraceMetadata(trace, "reviews.bookinfo")
	require.NoError(err)
	require.Len(converted.Spans, 1)

	tags := map[string]any{}
	for _, tag := range converted.Spans[0].Tags {
		tags[tag.Key] = tag.Value
	}
	assert.Equal("bookinfo", tags["istio.namespace"])
	assert.Equal("bookinfo", tags["istio.source_namespace"])
	assert.Equal("bookinfo", tags["k8s.namespace.name"])
	assert.Equal("kiali", tags["istio.cluster_id"])
	assert.Equal("sidecar~1.2.3.4~productpage-v1-abc~bookinfo~a.b.c", tags["node_id"])
	assert.Equal(true, tags["error"], "the status=error attribute must map to the boolean error tag")
	assert.NotContains(tags, "status", "the raw status attribute must not surface as its own tag")
}
