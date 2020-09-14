package jaeger

import (
	jaegerModels "github.com/jaegertracing/jaeger/model/json"
)

type structuredError struct {
	Code    int    `json:"code,omitempty"`
	Msg     string `json:"msg"`
	TraceID string `json:"traceID,omitempty"`
}

type JaegerServices struct {
	Data []string `json:"data"`
}

type JaegerResponse struct {
	Data              []jaegerModels.Trace `json:"data"`
	Errors            []structuredError    `json:"errors"`
	JaegerServiceName string               `json:"jaegerServiceName"`
}

type JaegerSingleTrace struct {
	Data   jaegerModels.Trace `json:"data"`
	Errors []structuredError  `json:"errors"`
}

type JaegerSpan struct {
	jaegerModels.Span
	TraceSize int `json:"traceSize"`
}
