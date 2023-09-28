package converter

import (
	"strconv"

	"github.com/kiali/kiali/log"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	otel "github.com/kiali/kiali/tracing/otel/model"
	otelModels "github.com/kiali/kiali/tracing/otel/model/json"
)

// convertID
func ConvertId(id string) jaegerModels.TraceID {
	return jaegerModels.TraceID(id)
}

// convertID
func convertSpanId(id string) jaegerModels.SpanID {
	return jaegerModels.SpanID(id)
}

// ConvertSpans
// https://opentelemetry.io/docs/specs/otel/trace/sdk_exporters/jaeger
func ConvertSpans(spans []otelModels.Span, serviceName string) []jaegerModels.Span {
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

		jaegerSpan := jaegerModels.Span{
			TraceID:   ConvertId(span.TraceID),
			SpanID:    convertSpanId(span.SpanID),
			Duration:  duration,
			StartTime: startTime / 1000,
			// No more mapped data
			Flags:         0,
			OperationName: span.Name,
			References:    []jaegerModels.Reference{},
			Tags:          convertAttributes(span.Attributes, span.Status),
			Logs:          []jaegerModels.Log{},
			ProcessID:     "",
			Process:       &jaegerModels.Process{Tags: []jaegerModels.KeyValue{}, ServiceName: serviceName},
			Warnings:      []string{},
		}

		toRet = append(toRet, jaegerSpan)
	}
	return toRet
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

	jaegerSpan := jaegerModels.Span{
		TraceID:   ConvertId(traceId),
		SpanID:    convertSpanId(span.SpanID),
		Duration:  duration / 1000, // Provided in ns, Tracing uses ms
		StartTime: startTime / 1000,
		// No more mapped data
		Flags: 0,
		//OperationName: span.Name,
		References:    []jaegerModels.Reference{},
		Tags:          convertAttributes(span.Attributes, span.Status),
		Logs:          []jaegerModels.Log{},
		OperationName: rootName,
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
