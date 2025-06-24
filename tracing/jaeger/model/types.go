package model

import (
	"net/url"
	"time"

	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

type StructuredError struct {
	Code    int    `json:"code,omitempty"`
	Msg     string `json:"msg"`
	TraceID string `json:"traceID,omitempty"`
}

type TracingServices struct {
	Data []string `json:"data"`
}

type TracingResponse struct {
	Data               []jaegerModels.Trace `json:"data"`
	Errors             []StructuredError    `json:"errors"`
	TracingServiceName string               `json:"tracingServiceName"`
}

type TracingSingleTrace struct {
	Data   jaegerModels.Trace `json:"data"`
	Errors []StructuredError  `json:"errors"`
}

type TracingSpan struct {
	jaegerModels.Span
	TraceSize int `json:"traceSize"`
}

type Services struct {
	Data []string `json:"data"`
}

type ParsedUrl struct {
	BaseUrl string   `json:"baseUrl"`
	Host    string   `json:"host"`
	Path    string   `json:"path"`
	Port    string   `json:"port"`
	Scheme  string   `json:"scheme"`
	Url     *url.URL `json:"url,omitempty"`
}

type ValidConfig struct {
	AuthType          string `json:"authType,omitempty"`
	NamespaceSelector *bool  `json:"namespaceSelector"`
	Provider          string `json:"provider"`
	Url               string `json:"url"`
	UseGRPC           bool   `json:"useGRPC"`
	Warning           string `json:"warning"`
}

type TracingDiagnose struct {
	Code        int           `json:"code"`
	LogLine     []LogLine     `json:"logLine"`
	Message     string        `json:"message"`
	ValidConfig []ValidConfig `json:"validConfig"`
}

type ConfigurationValidation struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

type TracingService struct {
	Data   []string          `json:"data"`
	Total  int               `json:"total"`
	Limit  int               `json:"limit"`
	Offset int               `json:"offset"`
	Errors []StructuredError `json:"errors"`
}

type LogLine struct {
	Result string    `json:"result"`
	Test   string    `json:"test"`
	Time   time.Time `json:"time"`
}
