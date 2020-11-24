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
	GetAppTraces(ns, app string, query models.TracingQuery) (traces *JaegerResponse, err error)
	GetTraceDetail(traceId string) (*JaegerSingleTrace, error)
	GetErrorTraces(ns, app string, duration time.Duration) (errorTraces int, err error)
}

// Client for Jaeger API.
type Client struct {
	ClientInterface
	client  http.Client
	baseURL *url.URL
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
		transport, err := httputil.CreateTransport(&auth, &http.Transport{}, 10*time.Second)
		if err != nil {
			return nil, err
		}
		client := http.Client{Transport: transport, Timeout: timeout}
		return &Client{client: client, baseURL: u}, nil
	}
}

// GetAppTraces fetches traces of an app
func (in *Client) GetAppTraces(ns, app string, query models.TracingQuery) (traces *JaegerResponse, err error) {
	return getAppTraces(in.client, in.baseURL, ns, app, query)
}

// GetTraceDetail fetches a specific trace from its ID
func (in *Client) GetTraceDetail(traceId string) (*JaegerSingleTrace, error) {
	return getTraceDetail(in.client, in.baseURL, traceId)
}

// GetErrorTraces fetches number of traces in error for the given app
func (in *Client) GetErrorTraces(ns, app string, duration time.Duration) (errorTraces int, err error) {
	return getErrorTraces(in.client, in.baseURL, ns, app, duration)
}
