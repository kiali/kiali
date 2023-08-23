package model

import "time"

// Trace is a list of spans
type Trace struct {
	TraceID           string        `json:"traceID"`
	RootServiceName   string        `json:"RootServiceName"`
	StartTimeUnixNano string        `json:"startTimeUnixNano"`
	DurationMs        time.Duration `json:"durationMs"`
}

type TracingResponse struct {
	Traces []Trace `json:"traces"`
}
