package converter

import (
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
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
func ConvertSpans(spans []otelModels.Span) []jaegerModels.Span {
	var toRet []jaegerModels.Span
	for _, span := range spans {
		jaegerSpan := jaegerModels.Span{TraceID: ConvertId(span.TraceID), SpanID: convertSpanId(span.SpanID)}
		toRet = append(toRet, jaegerSpan)
	}
	return toRet
}
