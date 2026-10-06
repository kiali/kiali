package converter

import (
	"strconv"

	"github.com/kiali/kiali/log"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	otel "github.com/kiali/kiali/tracing/otel/model"
	otelModels "github.com/kiali/kiali/tracing/otel/model/json"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
	v1 "github.com/kiali/kiali/tracing/tempo/tempopb/common/v1"
	v11 "github.com/kiali/kiali/tracing/tempo/tempopb/resource/v1"
)

// convertID
func ConvertId(id string) jaegerModels.TraceID {
	return jaegerModels.TraceID(id)
}

// convertSpanId
func convertSpanId(id string) jaegerModels.SpanID {
	return jaegerModels.SpanID(id)
}

// ConvertSpans
// https://opentelemetry.io/docs/specs/otel/trace/sdk_exporters/jaeger
func ConvertSpans(spans []otelModels.Span, serviceName string, traceID string) []jaegerModels.Span {
	var toRet []jaegerModels.Span
	for _, span := range spans {

		startTime, err := strconv.ParseUint(span.StartTimeUnixNano, 10, 64)
		if err != nil {
			log.Errorf("Error converting start time. Skipping trace")
			continue
		}

		duration, err := getDuration(span.EndTimeUnixNano, span.StartTimeUnixNano)
		if err != nil {
			log.Errorf("Error converting duration. Skipping trace")
			continue
		}
		jaegerTraceId := ConvertId(traceID) // The traceID from the SpanID doesn't look to match (ex. Q3xfr1lMsbi2OX9CxUbYug==)
		jaegerSpanId := convertSpanId(span.SpanID)
		parentSpanId := convertSpanId(span.ParentSpanId)

		jaegerSpan := jaegerModels.Span{
			TraceID:   jaegerTraceId,
			SpanID:    jaegerSpanId,
			Duration:  duration,
			StartTime: startTime / 1000,
			// No more mapped data
			Flags:         0,
			OperationName: span.Name,
			References:    convertReferences(jaegerTraceId, parentSpanId),
			Tags:          convertAttributes(span.Attributes, span.Status),
			Logs:          []jaegerModels.Log{},
			ProcessID:     "",
			Process:       &jaegerModels.Process{Tags: []jaegerModels.KeyValue{}, ServiceName: serviceName},
			Warnings:      []string{},
		}

		// This is how Jaeger reports it
		// Used to determine the envoy direction
		atb_val := ""
		switch span.Kind {
		case "SPAN_KIND_CLIENT":
			atb_val = "client"
		case "SPAN_KIND_SERVER":
			atb_val = "server"
		}
		if atb_val != "" {
			atb := jaegerModels.KeyValue{Key: "span.kind", Value: atb_val, Type: "string"}
			jaegerSpan.Tags = append(jaegerSpan.Tags, atb)
		}

		toRet = append(toRet, jaegerSpan)
	}
	return toRet
}

// ConvertTraceMetadata used by the GRPC Client
func ConvertTraceMetadata(trace tempopb.TraceSearchMetadata, serviceName string) (*jaegerModels.Trace, error) {
	jaegerTrace := jaegerModels.Trace{
		TraceID:   ConvertId(trace.TraceID),
		Processes: map[jaegerModels.ProcessID]jaegerModels.Process{},
		Warnings:  []string{},
	}
	for _, span := range trace.SpanSet.Spans {
		spanSet := convertOtelSpan(span, serviceName, trace.TraceID, trace.RootTraceName)
		jaegerTrace.Spans = append(jaegerTrace.Spans, spanSet)
	}
	jaegerTrace.Matched = len(jaegerTrace.Spans)
	return &jaegerTrace, nil
}

// convertOtelSpan used for GRPC format Spans
func convertOtelSpan(span *tempopb.Span, serviceName, traceID, rootTrace string) jaegerModels.Span {
	// Tempo subtracts this duration itself and the subtraction is unsigned, so a span whose end
	// precedes its start arrives already wrapped round. The rule is the same as on the HTTP search
	// path: at or above 2^63 nanoseconds the value is a wrap rather than a duration.
	duration := span.DurationNanos
	if duration >= 1<<63 {
		log.Warningf("Span [%s] of trace [%s] reports a duration of [%d]ns, which is a wrapped negative; reporting a zero duration",
			span.SpanID, traceID, duration)
		duration = 0
	}

	modelSpan := jaegerModels.Span{
		SpanID:    jaegerModels.SpanID(span.SpanID),
		TraceID:   jaegerModels.TraceID(traceID),
		Duration:  duration / 1000,
		StartTime: span.StartTimeUnixNano / 1000,
		// No more mapped data
		Flags:         0,
		References:    []jaegerModels.Reference{}, // convertReferences(traceID, rootTrace),
		Tags:          convertModelAttributes(span.Attributes),
		Logs:          []jaegerModels.Log{},
		OperationName: rootTrace,
		ProcessID:     "",
		Process:       &jaegerModels.Process{Tags: []jaegerModels.KeyValue{}, ServiceName: serviceName},
		Warnings:      []string{},
	}

	return modelSpan
}

func ConvertSpanSet(span otel.Span, serviceName string, traceId string, rootName string) []jaegerModels.Span {
	var toRet []jaegerModels.Span

	startTime, err := strconv.ParseUint(span.StartTimeUnixNano, 10, 64)
	if err != nil {
		log.Errorf("Could not read the start time %q of span [%s] in trace [%s], skipping span: %s",
			span.StartTimeUnixNano, span.SpanID, traceId, err)
		return nil
	}
	// A span with no start time is not placed anywhere on a timeline, and reporting it with a
	// start time of zero places it at the Unix epoch instead - in the trace list, in the
	// heatmap and in the Metrics-tab span overlay, all of which read this path.
	if startTime == 0 {
		log.Errorf("Span [%s] of trace [%s] on service [%s] has no start time. Skipping span",
			span.SpanID, traceId, serviceName)
		return nil
	}
	duration, err := strconv.ParseUint(span.DurationNanos, 10, 64)
	if err != nil {
		log.Errorf("Could not read the duration %q of span [%s] in trace [%s]: %s",
			span.DurationNanos, span.SpanID, traceId, err)
	}
	// Tempo computes this duration itself, as an unsigned subtraction, so a span whose end precedes
	// its start arrives already wrapped round rather than as two timestamps this function can compare:
	// 18446744073705551616ns, for instance, is 584 years. Any nanosecond duration at or above 2^63 is
	// such a wrap and not a duration, because the longest honest one is bounded by the time since the
	// epoch, which is under 2^61.
	if duration >= 1<<63 {
		log.Warningf("Span [%s] of trace [%s] reports a duration of [%d]ns, which is a wrapped negative; reporting a zero duration",
			span.SpanID, traceId, duration)
		duration = 0
	}

	jaegerTraceId := ConvertId(traceId)
	jaegerSpanId := convertSpanId(span.SpanID)
	operationName := rootName
	if span.Name != "" {
		operationName = span.Name
	}

	jaegerSpan := jaegerModels.Span{
		TraceID:   jaegerTraceId,
		SpanID:    jaegerSpanId,
		Duration:  duration / 1000, // Provided in ns, Jaeger uses ms
		StartTime: startTime / 1000,
		// No more mapped data
		Flags: 0,
		// OperationName: span.Name,
		References:    []jaegerModels.Reference{},
		Tags:          convertAttributes(span.Attributes, span.Status),
		Logs:          []jaegerModels.Log{},
		OperationName: operationName,
		ProcessID:     "",
		Process:       &jaegerModels.Process{Tags: []jaegerModels.KeyValue{}, ServiceName: serviceName},
		Warnings:      []string{},
	}

	toRet = append(toRet, jaegerSpan)

	return toRet
}

func getDuration(end string, start string) (uint64, error) {
	endInt, err := strconv.ParseUint(end, 10, 64)
	if err != nil {
		log.Errorf("Error converting end date: %s", err.Error())
		return 0, err
	}
	startInt, err := strconv.ParseUint(start, 10, 64)
	if err != nil {
		log.Errorf("Error converting start date: %s", err.Error())
		return 0, err
	}
	// The subtraction is unsigned, and the OTLP proto only says that the end time is expected to
	// be at or after the start time. An end before the start wraps the result round to several
	// hundred years. A zero duration says the span's end cannot be believed and keeps the span,
	// which is better than dropping it: it still carries its name, its service and its tags.
	if endInt < startInt {
		log.Warningf("Span end time [%d] is before its start time [%d], reporting a zero duration", endInt, startInt)
		return 0, nil
	}
	// nano to micro
	return (endInt - startInt) / 1000, nil
}

func convertReferences(traceId jaegerModels.TraceID, parentSpanId jaegerModels.SpanID) []jaegerModels.Reference {
	var references []jaegerModels.Reference

	if parentSpanId == "" {
		return references
	}

	ref := jaegerModels.Reference{
		RefType: jaegerModels.ReferenceType("CHILD_OF"),
		TraceID: traceId,
		SpanID:  parentSpanId,
	}

	references = append(references, ref)
	return references
}

func convertAttributes(attributes []otelModels.Attribute, status otelModels.Status) []jaegerModels.KeyValue {
	var tags []jaegerModels.KeyValue
	for _, atb := range attributes {
		if atb.Key == "status" && atb.Value.StringValue == "error" {
			tag := jaegerModels.KeyValue{Key: "error", Value: true, Type: "bool"}
			tags = append(tags, tag)
		} else {
			tag := jaegerModels.KeyValue{Key: atb.Key, Value: atb.Value.StringValue, Type: "string"}
			tags = append(tags, tag)
		}
	}
	// When Span Status is set to ERROR, an error span tag MUST be added with the Boolean value of true
	if status.Code == "STATUS_CODE_ERROR" {
		tag := jaegerModels.KeyValue{Key: "error", Value: true, Type: "bool"}
		tags = append(tags, tag)
	}
	return tags
}

func convertModelAttributes(attributes []*v1.KeyValue) []jaegerModels.KeyValue {
	var tags []jaegerModels.KeyValue
	for _, atb := range attributes {
		if atb.Key == "status" {
			if atb.Value.GetStringValue() == "error" {
				tag := jaegerModels.KeyValue{Key: "error", Value: true, Type: "bool"}
				tags = append(tags, tag)
			}
		} else {
			tag := jaegerModels.KeyValue{Key: atb.Key, Value: atb.Value.GetStringValue(), Type: "string"}
			tags = append(tags, tag)
		}
	}
	return tags
}

func ConvertResource(resourceSpans *v11.Resource) jaegerModels.Span {
	span := jaegerModels.Span{}
	return span
}
