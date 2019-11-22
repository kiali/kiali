package jaeger

import (
	"errors"
	"net/http"
	"net/url"
	"time"

	jaegerModels "github.com/jaegertracing/jaeger/model/json"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	GetJaegerServices() (services []string, code int, err error)
	GetSpans(namespace, service, startMicros, endMicros string) ([]Span, error)
	GetTraces(namespace string, service string, rawQuery string) (traces []jaegerModels.Trace, code int, err error)
	GetTraceDetail(traceId string) (trace []jaegerModels.Trace, code int, err error)
	GetErrorTraces(ns string, srv string) (errorTraces int, err error)
}

// Client for Jaeger API.
// It hides the way we query Prometheus offering a layer with a high level defined API.
type Client struct {
	ClientInterface
	client   http.Client
	endpoint *url.URL
}

func NewClient(token string) (*Client, error) {
	cfg := config.Get().ExternalServices.Tracing

	if !cfg.Enabled {
		return nil, errors.New("jaeger is not available")
	} else {
		auth := cfg.Auth
		if auth.UseKialiToken {
			auth.Token = token
		}
		u, errParse := url.Parse(config.Get().ExternalServices.Tracing.InClusterURL)
		if !config.Get().InCluster {
			u, errParse = url.Parse(config.Get().ExternalServices.Tracing.URL)
		}
		if errParse != nil {
			log.Errorf("Error parse Jaeger URL: %s", errParse)
			return nil, errParse
		}
		timeout := time.Duration(5000 * time.Millisecond)
		transport, err := httputil.AuthTransport(&auth, &http.Transport{})
		if err != nil {
			return nil, err
		}
		client := http.Client{Transport: transport, Timeout: timeout}
		return &Client{client: client, endpoint: u}, nil
	}
}

// GetNamespaceServicesRequestRates queries Prometheus to fetch request counter rates, over a time interval, limited to
// requests for services in the namespace.
// Returns (rates, error)
func (in *Client) GetJaegerServices() (services []string, code int, err error) {
	return getServices(in.client, in.endpoint)
}

// GetSpans fetches Jaeger traces of a service and extract related spans
// Returns (spans, error)
func (in *Client) GetSpans(namespace, service, startMicros, endMicros string) ([]Span, error) {
	return getSpans(in.client, in.endpoint, namespace, service, startMicros, endMicros)
}

// GetTraces Jaeger to fetch traces of a service
// requests for traces of a service
// Returns (traces, code, error)
func (in *Client) GetTraces(namespace string, service string, rawQuery string) (traces []jaegerModels.Trace, code int, err error) {
	return getTraces(in.client, in.endpoint, namespace, service, rawQuery)
}

// GetTraceDetail jaeger to fetch a specific trace
// requests for a specific trace detail
//  Returns (traces, code, error)
func (in *Client) GetTraceDetail(traceId string) (trace []jaegerModels.Trace, code int, err error) {
	return getTraceDetail(in.client, in.endpoint, traceId)
}

// GetErrorTraces jaeger to fetch a traces of a specific service
// requests for errors traces
//  Returns (errorTraces, error)
func (in *Client) GetErrorTraces(ns string, srv string) (errorTraces int, err error) {
	return getErrorTraces(in.client, in.endpoint, ns, srv)
}
