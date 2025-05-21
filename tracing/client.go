package tracing

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/tracing/jaeger"
	"github.com/kiali/kiali/tracing/jaeger/model"
	"github.com/kiali/kiali/tracing/tempo"
	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/grpcutil"
	"github.com/kiali/kiali/util/httputil"
)

const (
	newClientRetryInterval = 30 * time.Second
)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	GetAppTraces(ctx context.Context, ns, app string, query models.TracingQuery) (traces *model.TracingResponse, err error)
	GetTraceDetail(ctx context.Context, traceId string) (*model.TracingSingleTrace, error)
	GetErrorTraces(ctx context.Context, ns, app string, duration time.Duration) (errorTraces int, err error)
	GetServiceStatus(ctx context.Context) (available bool, err error)
}

// HTTPClientInterface for Mocks, also for Tempo or Jaeger
type HTTPClientInterface interface {
	GetAppTracesHTTP(ctx context.Context, client http.Client, baseURL *url.URL, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error)
	GetTraceDetailHTTP(ctx context.Context, client http.Client, endpoint *url.URL, traceID string) (*model.TracingSingleTrace, error)
	GetServiceStatusHTTP(ctx context.Context, client http.Client, baseURL *url.URL) (bool, error)
}

// GRPCClientInterface for Mocks, also for Tempo or Jaeger
type GRPCClientInterface interface {
	FindTraces(ctx context.Context, app string, q models.TracingQuery) (response *model.TracingResponse, err error)
	GetTrace(ctx context.Context, traceID string) (*model.TracingSingleTrace, error)
	GetServices(ctx context.Context) (bool, error)
}

// Client for Tracing API.
type Client struct {
	ClientInterface
	httpTracingClient HTTPClientInterface
	grpcClient        GRPCClientInterface
	httpClient        http.Client
	baseURL           *url.URL
	customHeaders     map[string]string
}

type basicAuth struct {
	Header string
}

func (c *basicAuth) GetRequestMetadata(context.Context, ...string) (map[string]string, error) {
	return map[string]string{
		"Authorization": c.Header,
	}, nil
}

func (c *basicAuth) RequireTransportSecurity() bool {
	return true
}

// NewClient creates a tracing Client. If it fails to create the client for any reason,
// it will retry indefinitely until the context is cancelled.
func NewClient(ctx context.Context, conf *config.Config, token string) (*Client, error) {
	var (
		client *Client
		err    error
	)

	// prepare the client logger and put it in the context
	// this context and logger is only used during the instantiation process
	zl := log.WithGroup(log.TracingLogName)
	ctx = log.ToContext(ctx, zl)

	retryErr := wait.PollUntilContextCancel(ctx, newClientRetryInterval, true, func(ctx context.Context) (bool, error) {
		client, err = newClient(ctx, conf, token)
		if err != nil {
			zl.Error().Msgf("Error creating tracing client: [%v]. Retrying in [%s]", err, newClientRetryInterval)
			return false, nil
		}

		return true, nil
	})
	if retryErr != nil {
		zl.Error().Msgf("Error creating tracing client: [%v]. Will not retry.", err)
		return nil, err
	}

	return client, nil
}

func newClient(ctx context.Context, conf *config.Config, token string) (*Client, error) {
	cfgTracing := conf.ExternalServices.Tracing
	if !cfgTracing.Enabled {
		return nil, errors.New("tracing is not enabled")
	}

	zl := log.FromContext(ctx)

	var httpTracingClient HTTPClientInterface
	auth := cfgTracing.Auth
	if auth.UseKialiToken {
		auth.Token = token
	}

	u, errParse := url.Parse(cfgTracing.InternalURL)
	if !conf.InCluster {
		u, errParse = url.Parse(cfgTracing.ExternalURL)
	}
	if errParse != nil {
		zl.Error().Msgf("Error parsing Tracing URL: %s", errParse)
		return nil, errParse
	}

	port := u.Port()
	if port == "" {
		p, _ := net.LookupPort("tcp", u.Scheme)
		port = strconv.Itoa(p)
	}
	opts, err := grpcutil.GetAuthDialOptions(conf, u.Scheme == "https", &auth)
	if err != nil {
		zl.Error().Msgf("Error while building GRPC dial options: %v", err)
		return nil, err
	}
	address := u.Hostname() + ":" + port
	zl.Trace().Msgf("[%s] GRPC client info: address=[%s], auth.type=[%s]", cfgTracing.Provider, address, auth.Type)

	if cfgTracing.UseGRPC && cfgTracing.Provider != config.TempoProvider {

		var client GRPCClientInterface
		// Note: jaeger-query does not have built-in secured communication, at the moment it is only achieved through reverse proxies (cf https://github.com/jaegertracing/jaeger/issues/1718).
		// When using the GRPC client, if a proxy is used it has to support GRPC.
		// Basic and Token auth are in theory implemented for the GRPC client (see package grpcutil) but were not tested because openshift's oauth-proxy doesn't support GRPC at the time.
		// Leaving some commented-out code below -- perhaps useful, perhaps not -- to consider when testing secured GRPC.
		// if auth.Token != "" {
		// 	requestMetadata := metadata.New(map[string]string{
		// 		spanstore.BearerTokenKey: auth.Token,
		// 	})
		// 	ctx = metadata.NewOutgoingContext(ctx, requestMetadata)
		// }
		conn, err := grpc.NewClient(address, opts...)
		if err == nil {
			cc := model.NewQueryServiceClient(conn)
			client, err = jaeger.NewGRPCJaegerClient(cc)
			if err != nil {
				return nil, err
			}
			zl.Info().Msgf("Create [%s] GRPC client. address=[%s]", cfgTracing.Provider, address)
			return &Client{httpTracingClient: httpTracingClient, grpcClient: client, customHeaders: cfgTracing.CustomHeaders}, nil
		} else {
			zl.Error().Msgf("Error creating client: %v", err)
			return nil, nil
		}

	} else {
		// Legacy HTTP client
		zl.Trace().Msgf("Using legacy HTTP client for Tracing: url=[%v], auth.type=[%s]", u, auth.Type)
		timeout := time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout) * time.Second
		transport, err := httputil.CreateTransport(conf, &auth, &http.Transport{}, timeout, cfgTracing.CustomHeaders)
		if err != nil {
			return nil, err
		}
		client := http.Client{Transport: transport, Timeout: timeout}
		zl.Info().Msgf("Create Tracing HTTP client [%s]", u)

		if cfgTracing.Provider == config.TempoProvider {
			httpTracingClient, err = tempo.NewOtelClient(ctx)
			if err != nil {
				zl.Error().Msgf("Error creating HTTP client: %v", err)
				return nil, err
			}

			// Tempo uses gRPC stream client just for search
			// Get a single trace requires the http client
			if cfgTracing.UseGRPC {
				var dialOps []grpc.DialOption
				if cfgTracing.Auth.Type == "basic" {
					dialOps = append(dialOps, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
					dialOps = append(dialOps, grpc.WithPerRPCCredentials(&basicAuth{
						Header: fmt.Sprintf("Basic %s", base64.StdEncoding.EncodeToString([]byte(strings.Join([]string{cfgTracing.Auth.Username, cfgTracing.Auth.Password}, ":")))),
					}))
				} else {
					dialOps = append(dialOps, grpc.WithTransportCredentials(insecure.NewCredentials()))
				}
				grpcAddress := fmt.Sprintf("%s:%d", u.Hostname(), conf.ExternalServices.Tracing.GrpcPort)
				clientConn, _ := grpc.NewClient(grpcAddress, dialOps...)
				streamClient, err := tempo.NewgRPCClient(clientConn)
				if err != nil {
					zl.Error().Msgf("Error creating gRPC Tempo Client: %v", err)
					return nil, nil
				}
				return &Client{httpTracingClient: httpTracingClient, grpcClient: streamClient, httpClient: client, baseURL: u, customHeaders: cfgTracing.CustomHeaders}, nil
			}
		} else {
			httpTracingClient, err = jaeger.NewJaegerClient(client, u)
			if err != nil {
				return nil, err
			}
		}
		return &Client{httpTracingClient: httpTracingClient, httpClient: client, baseURL: u, customHeaders: cfgTracing.CustomHeaders}, nil
	}
}

// GetAppTraces fetches traces of an app
func (in *Client) GetAppTraces(ctx context.Context, namespace, app string, q models.TracingQuery) (*model.TracingResponse, error) {
	ctx = in.prepareContextForClient(ctx)

	serviceName := BuildTracingServiceName(namespace, app)

	// create a timer to time the tracing query. Note that we will always take the measurement even on failure
	promtimer := internalmetrics.GetTracingProcessingTimePrometheusTimer("AppTraces")
	defer internalmetrics.ObserveDurationAndLogResults(ctx, config.Get(), promtimer, "TracingProcessingTime", nil, "AppTraces")

	if in.grpcClient == nil {
		return in.httpTracingClient.GetAppTracesHTTP(ctx, in.httpClient, in.baseURL, serviceName, q)
	}
	return in.grpcClient.FindTraces(ctx, serviceName, q)
}

// GetTraceDetail fetches a specific trace from its ID
func (in *Client) GetTraceDetail(ctx context.Context, strTraceID string) (*model.TracingSingleTrace, error) {
	ctx = in.prepareContextForClient(ctx)

	cfg := config.Get()

	// create a timer to time the tracing query. Note that we will always take the measurement even on failure
	promtimer := internalmetrics.GetTracingProcessingTimePrometheusTimer("TraceDetail")
	defer internalmetrics.ObserveDurationAndLogResults(ctx, cfg, promtimer, "TracingProcessingTime", nil, "TraceDetail")

	if in.grpcClient == nil || cfg.ExternalServices.Tracing.Provider == config.TempoProvider {
		if in.httpTracingClient != nil {
			return in.httpTracingClient.GetTraceDetailHTTP(ctx, in.httpClient, in.baseURL, strTraceID)
		} else {
			return nil, fmt.Errorf("error getting trace details")
		}
	}
	return in.grpcClient.GetTrace(ctx, strTraceID)
}

// GetErrorTraces fetches number of traces in error for the given app
func (in *Client) GetErrorTraces(ctx context.Context, ns, app string, duration time.Duration) (int, error) {
	// Note: grpc vs http switch is performed in subsequent call 'GetAppTraces'
	now := time.Now()
	query := models.TracingQuery{
		Start: now.Add(-duration),
		End:   now,
		Tags:  map[string]string{"error": "true"},
	}
	for key, value := range config.Get().ExternalServices.Tracing.QueryScope {
		query.Tags[key] = value
	}

	// create a timer to time the tracing query. Note that we will always take the measurement even on failure
	promtimer := internalmetrics.GetTracingProcessingTimePrometheusTimer("ErrorTraces")
	defer internalmetrics.ObserveDurationAndLogResults(ctx, config.Get(), promtimer, "TracingProcessingTime", nil, "ErrorTraces")

	traces, err := in.GetAppTraces(ctx, ns, app, query)
	if err != nil {
		return 0, err
	}
	return len(traces.Data), nil
}

func (in *Client) GetServiceStatus(ctx context.Context) (bool, error) {
	ctx = in.prepareContextForClient(ctx)

	// create a timer to time the tracing query. Note that we will always take the measurement even on failure
	promtimer := internalmetrics.GetTracingProcessingTimePrometheusTimer("ServiceStatus")
	defer internalmetrics.ObserveDurationAndLogResults(ctx, config.Get(), promtimer, "TracingProcessingTime", nil, "ServiceStatus")

	// Check Service Status using HTTP when gRPC is not enabled
	if in.grpcClient == nil {
		return in.httpTracingClient.GetServiceStatusHTTP(ctx, in.httpClient, in.baseURL)
	}

	return in.grpcClient.GetServices(ctx)
}

func BuildTracingServiceName(namespace, app string) string {
	conf := config.Get()
	if conf.ExternalServices.Tracing.NamespaceSelector {
		return util.BuildNameNSKey(app, namespace)
	}
	return app
}

// prepareContextForClient puts things in the given context that will be needed by the client to do its job.
// For example, the custom headers are added to the context so the clients pass them on to the server when making requests.
func (in *Client) prepareContextForClient(ctx context.Context) context.Context {
	if len(in.customHeaders) > 0 {
		log.FromContext(ctx).Trace().Msgf("Adding [%v] custom headers to Tracing client", len(in.customHeaders))
		ctx = metadata.NewOutgoingContext(ctx, metadata.New(in.customHeaders))
	}
	return ctx
}
