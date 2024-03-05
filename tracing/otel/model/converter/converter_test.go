package converter

import (
	"testing"

	"github.com/stretchr/testify/assert"

	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	otelModels "github.com/kiali/kiali/tracing/otel/model/json"
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
