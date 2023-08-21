package model

import (
	jaegerModels "github.com/kiali/kiali/tracing/model/json"
	"time"
)

type structuredError struct {
	Code    int    `json:"code,omitempty"`
	Msg     string `json:"msg"`
	TraceID string `json:"traceID,omitempty"`
}

type TracingServices struct {
	Data []string `json:"data"`
}

// Trace is a list of spans
type OTelTrace struct {
	TraceID           string        `json:"traceID"`
	RootServiceName   string        `json:"RootServiceName"`
	StartTimeUnixNano string        `json:"startTimeUnixNano"`
	DurationMs        time.Duration `json:"durationMs"`
}

type TracingResponse struct {
	Data               []jaegerModels.Trace `json:"data"`
	Errors             []structuredError    `json:"errors"`
	TracingServiceName string               `json:"tracingServiceName"`
}

type OTelTracingResponse struct {
	Traces []OTelTrace `json:"traces"`
}

type TracingSingleTrace struct {
	Data   jaegerModels.Trace `json:"data"`
	Errors []structuredError  `json:"errors"`
}

type TracingSpan struct {
	jaegerModels.Span
	TraceSize int `json:"traceSize"`
}
