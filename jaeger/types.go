package jaeger

import (
	jaegerModels "github.com/jaegertracing/jaeger/model/json"
)

type structuredError struct {
	Code    int    `json:"code,omitempty"`
	Msg     string `json:"msg"`
	TraceID string `json:"traceID,omitempty"`
}

type JaegerResponse struct {
	Data   []jaegerModels.Trace `json:"data"`
	Errors []structuredError    `json:"errors"`
}
