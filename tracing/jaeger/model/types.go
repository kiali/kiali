package model

import (
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

type structuredError struct {
	Code    int    `json:"code,omitempty"`
	Msg     string `json:"msg"`
	TraceID string `json:"traceID,omitempty"`
}

type TracingServices struct {
	Data []string `json:"data"`
}

type TracingResponse struct {
	Data               []jaegerModels.Trace `json:"data"`
	Errors             []structuredError    `json:"errors"`
	FromAllClusters    bool                 `json:"fromAllClusters"`
	TracingServiceName string               `json:"tracingServiceName"`
}

type TracingSingleTrace struct {
	Data   jaegerModels.Trace `json:"data"`
	Errors []structuredError  `json:"errors"`
}

type TracingSpan struct {
	jaegerModels.Span
	TraceSize int `json:"traceSize"`
}

type Services struct {
	Data []string `json:"data"`
}
