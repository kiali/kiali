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

// NamespaceTagKeys is the single list of tag (and OTel resource attribute)
// keys that carry a Kubernetes namespace in Istio telemetry: the sidecar
// source namespace, the ambient source/destination namespaces and the OTel
// resource attribute for the pod's namespace (k8s.namespace.name, set by
// collectors with k8s enrichment). It is shared by the span namespace
// extraction (business.traceNamespaces) and the Tempo converter's surfacing
// of namespace-bearing resource attributes as process tags: the two must
// agree, or Tempo traces lose their namespace information and are then
// denied by the trace access check (fail closed).
//
// Every key must be set by the infrastructure (Istio sidecars, ztunnel, the
// collector's k8s enrichment), reflecting the span's actual placement.
// Application-controlled conventions must not be added: service.namespace
// (the OTel semantic convention for a logical service grouping) is
// deliberately absent — it is unrelated to Kubernetes placement, so a
// deployment setting it to something other than the pod's namespace would
// authorize traces through a label the application chooses.
var NamespaceTagKeys = []string{
	"istio.destination_namespace",
	"istio.namespace",
	"istio.source_namespace",
	"k8s.namespace.name",
}

// ClusterTagKeys is the single list of tag (and OTel resource attribute)
// keys that carry the cluster a span's telemetry belongs to: the istio
// cluster ID tag and the OTel semconv for the cluster name. It is shared by
// the cluster-aware trace access check (business.TracingService) and the
// Tempo converter's surfacing of cluster-bearing resource attributes as
// process tags: the two must agree, or Tempo traces lose their cluster
// attribution and their namespaces fall back to name-only authorization.
var ClusterTagKeys = []string{
	"istio.cluster_id",
	"k8s.cluster.name",
}
