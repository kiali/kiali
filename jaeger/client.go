package jaeger

import (
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	GetSpans(ns, app string, query models.TracingQuery) ([]Span, error)
	GetAppTraces(ns, app string, query models.TracingQuery) (traces *JaegerResponse, err error)
	GetServiceTraces(ns, app, service string, query models.TracingQuery) (traces *JaegerResponse, err error)
	GetWorkloadTraces(ns, app, workload string, query models.TracingQuery) (traces *JaegerResponse, err error)
	GetTraceDetail(traceId string) (*JaegerSingleTrace, error)
	GetErrorTraces(ns, app string, duration time.Duration) (errorTraces int, err error)
}

// Client for Jaeger API.
type Client struct {
	ClientInterface
	client   http.Client
	endpoint *url.URL
}

func NewClient(token string) (*Client, error) {
	cfg := config.Get()
	cfgTracing := cfg.ExternalServices.Tracing

	if !cfgTracing.Enabled {
		return nil, errors.New("jaeger is not available")
	} else {
		auth := cfgTracing.Auth
		if auth.UseKialiToken {
			auth.Token = token
		}
		u, errParse := url.Parse(cfgTracing.InClusterURL)
		if !cfg.InCluster {
			u, errParse = url.Parse(cfgTracing.URL)
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

// GetSpans fetches traces of an app and extract related spans
func (in *Client) GetSpans(ns, app string, query models.TracingQuery) ([]Span, error) {
	return getSpans(in.client, in.endpoint, ns, app, query)
}

// GetAppTraces fetches traces of an app
func (in *Client) GetAppTraces(ns, app string, query models.TracingQuery) (traces *JaegerResponse, err error) {
	return getAppTraces(in.client, in.endpoint, ns, app, query)
}

// GetServiceTraces fetches traces of a service
func (in *Client) GetServiceTraces(ns, app, service string, query models.TracingQuery) (traces *JaegerResponse, err error) {
	return getServiceTraces(in.client, in.endpoint, ns, app, service, query)
}

// GetWorkloadTraces fetches traces of a workload
func (in *Client) GetWorkloadTraces(ns, app, workload string, query models.TracingQuery) (traces *JaegerResponse, err error) {
	return getWorkloadTraces(in.client, in.endpoint, ns, app, workload, query)
}

// GetTraceDetail fetches a specific trace from its ID
func (in *Client) GetTraceDetail(traceId string) (*JaegerSingleTrace, error) {
	return getTraceDetail(in.client, in.endpoint, traceId)
}

// GetErrorTraces fetches number of traces in error for the given app
func (in *Client) GetErrorTraces(ns, app string, duration time.Duration) (errorTraces int, err error) {
	return getErrorTraces(in.client, in.endpoint, ns, app, duration)
}
