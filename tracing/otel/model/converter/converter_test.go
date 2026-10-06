package converter

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	otel "github.com/kiali/kiali/tracing/otel/model"
	otelModels "github.com/kiali/kiali/tracing/otel/model/json"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
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

// TestConvertSpansDuration checks the duration arithmetic on the trace detail path. The subtraction
// is between two unsigned nanosecond timestamps, so an end that is not after the start wraps round:
// the end four milliseconds early below reports 18446744073705551us, which is 584 years, and one
// microsecond early reports 18446744073709550us. A span whose end cannot be read at all is still
// dropped: there is no duration to report for it.
//
// No span of the captured responses in ../../../tracingtest has an end before its start. The shape
// is one the OTLP proto permits - it says only that the end is expected to be at or after the start
// - rather than one a backend here was seen to send.
func TestConvertSpansDuration(t *testing.T) {
	const start = "1693389472310270000"

	cases := map[string]struct {
		end              string
		expectedDuration uint64
		expectedDropped  bool
	}{
		"an ordinary span":                  {end: "1693389472310916000", expectedDuration: 646},
		"an end equal to the start":         {end: start, expectedDuration: 0},
		"an end four milliseconds early":    {end: "1693389472306270000", expectedDuration: 0},
		"an end one microsecond early":      {end: "1693389472310269000", expectedDuration: 0},
		"an end that cannot be read at all": {end: "", expectedDropped: true},
		"an end that is not a number":       {end: "soon", expectedDropped: true},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			spans := getSpans()
			spans[0].EndTimeUnixNano = tc.end

			converted := ConvertSpans(spans, "reviews.bookinfo", getId())
			if tc.expectedDropped {
				assert.Empty(t, converted)
				return
			}

			require.Len(t, converted, 1)
			assert.Equal(t, tc.expectedDuration, converted[0].Duration)
		})
	}
}

// TestConvertSpanSetDuration covers the duration of a span matched by Tempo's search API, which
// Tempo computes itself and sends as one number. The subtraction behind it is unsigned too, so a
// span whose end precedes its start arrives already wrapped - and this path cannot recompute it,
// because it never receives the end time. Anything at or above 2^63 nanoseconds is a wrap: the
// longest duration an honest span can have is bounded by the time since the epoch, which is
// under 2^61.
func TestConvertSpanSetDuration(t *testing.T) {
	cases := map[string]struct {
		duration         string
		expectedDuration uint64
	}{
		"an ordinary span":               {duration: "646000", expectedDuration: 646},
		"an end four milliseconds early": {duration: "18446744073705551616", expectedDuration: 0},
		"the largest wrap there is":      {duration: strconv.FormatUint(1<<64-1, 10), expectedDuration: 0},
		"just under the threshold":       {duration: strconv.FormatUint(1<<63-1, 10), expectedDuration: (1<<63 - 1) / 1000},
		"a duration that cannot be read": {duration: "", expectedDuration: 0},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			span := otel.Span{
				SpanID:            "2e6ca056f5fc6fdc",
				StartTimeUnixNano: "1693389472310270000",
				DurationNanos:     tc.duration,
				Name:              "reviews.bookinfo.svc.cluster.local:9080/*",
			}

			converted := ConvertSpanSet(span, "reviews.bookinfo", getId(), "root")
			require.Len(t, converted, 1)
			assert.Equal(t, tc.expectedDuration, converted[0].Duration)
		})
	}
}

// TestConvertTraceMetadataDuration checks the duration rule on the gRPC search path, where the value
// arrives as a number Tempo has already computed.
func TestConvertTraceMetadataDuration(t *testing.T) {
	cases := map[string]struct {
		duration         uint64
		expectedDuration uint64
	}{
		"an ordinary span":          {duration: 646000, expectedDuration: 646},
		"a wrapped negative":        {duration: 18446744073705551616, expectedDuration: 0},
		"the largest wrap there is": {duration: 1<<64 - 1, expectedDuration: 0},
		"just under the threshold":  {duration: 1<<63 - 1, expectedDuration: (1<<63 - 1) / 1000},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			trace := tempopb.TraceSearchMetadata{
				TraceID:       getId(),
				RootTraceName: "reviews.bookinfo.svc.cluster.local:9080/*",
				SpanSet: &tempopb.SpanSet{
					Spans: []*tempopb.Span{{
						SpanID:            "2e6ca056f5fc6fdc",
						Name:              "reviews.bookinfo.svc.cluster.local:9080/*",
						StartTimeUnixNano: 1693389472310270000,
						DurationNanos:     tc.duration,
					}},
				},
			}

			converted, err := ConvertTraceMetadata(trace, "reviews.bookinfo")
			require.NoError(t, err)
			require.Len(t, converted.Spans, 1)
			assert.Equal(t, tc.expectedDuration, converted.Spans[0].Duration)
		})
	}
}

// TestConvertSpanSetNoStartTime covers a span that Tempo's search API answers with and that carries
// no start time. Reported with a start time of zero it is dated to the Unix epoch; ConvertSpans
// drops such a span on the trace detail path, and this is the same rule on the path that feeds the
// traces list and the Metrics-tab span overlay.
//
// Kiali's frontend drops a span with no start time in both places that read them, so the backend
// agrees with the frontend.
func TestConvertSpanSetNoStartTime(t *testing.T) {
	for name, startTime := range map[string]string{"absent": "", "written as zero": "0", "not a number": "now"} {
		t.Run(name, func(t *testing.T) {
			span := otel.Span{SpanID: "2e6ca056f5fc6fdc", StartTimeUnixNano: startTime, DurationNanos: "646000"}
			assert.Empty(t, ConvertSpanSet(span, "reviews.bookinfo", getId(), "root"))
		})
	}
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
