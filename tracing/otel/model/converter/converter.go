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
		if span.Kind == "SPAN_KIND_CLIENT" {
			atb_val = "client"
		} else if span.Kind == "SPAN_KIND_SERVER" {
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

	modelSpan := jaegerModels.Span{
		SpanID:    jaegerModels.SpanID(span.SpanID),
		TraceID:   jaegerModels.TraceID(traceID),
		Duration:  span.DurationNanos / 1000,
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
		log.Errorf("Error converting start time.")
	}
	duration, err := strconv.ParseUint(span.DurationNanos, 10, 64)
	if err != nil {
		log.Errorf("Error converting duration.")
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
		//OperationName: span.Name,
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
	// nano to micro
	return (endInt - startInt) / 1000, nil
}

func convertReferences(traceId jaegerModels.TraceID, parentSpanId jaegerModels.SpanID) []jaegerModels.Reference {
	var references []jaegerModels.Reference

	if parentSpanId == "" {
		return references
	}

	var ref = jaegerModels.Reference{
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
