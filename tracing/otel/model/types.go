package model

import (
	"time"

	"github.com/kiali/kiali/tracing/otel/model/json"
)

// Trace is a list of spans
type TraceMetadata struct {
	TraceID           string        `json:"traceID"`
	RootServiceName   string        `json:"RootServiceName"`
	StartTimeUnixNano string        `json:"startTimeUnixNano"`
	DurationMs        time.Duration `json:"durationMs"`
}

type TracingResponse struct {
	Traces []TraceMetadata `json:"traces"`
}

type TagsResponse struct {
	TagNames []string `json:"tagNames"`
}

type Span struct {
	SpanID            string           `json:"spanID"`
	StartTimeUnixNano string           `json:"startTimeUnixNano"`
	DurationNanos     string           `json:"durationNanos"`
	Attributes        []json.Attribute `json:"attributes"`
	Status            json.Status      `json:"status"`
}

type SpanSet struct {
	Spans   []Span `json:"spans"`
	Matched int    `json:"matched"` // Tempo returns the number of total spans matched in this field
}

type Trace struct {
	TraceID           string  `json:"traceID"`
	RootServiceName   string  `json:"rootServiceName"`
	RootTraceName     string  `json:"rootTraceName,omitempty"`
	StartTimeUnixNano string  `json:"startTimeUnixNano"`
	DurationMs        int     `json:"durationMs"`
	SpanSet           SpanSet `json:"spanSet"`
}

type Traces struct {
	Traces  []Trace  `json:"traces"`
	Metrics struct{} `json:"metrics"`
}
