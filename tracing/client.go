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
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger"
	"github.com/kiali/kiali/tracing/jaeger/model"
	"github.com/kiali/kiali/tracing/tempo"
	"github.com/kiali/kiali/util/grpcutil"
	"github.com/kiali/kiali/util/httputil"
)

const (
	JAEGER = "jaeger"
	TEMPO  = "tempo"
)

// ClientInterface for mocks (only mocked function are necessary here)
type ClientInterface interface {
	GetAppTraces(ns, app string, query models.TracingQuery) (traces *model.TracingResponse, err error)
	GetTraceDetail(traceId string) (*model.TracingSingleTrace, error)
	GetErrorTraces(ns, app string, duration time.Duration) (errorTraces int, err error)
	GetServiceStatus() (available bool, err error)
}

// HTTPClientInterface for Mocks, also for Tempo or Jaeger
type HTTPClientInterface interface {
	GetAppTracesHTTP(client http.Client, baseURL *url.URL, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error)
	GetTraceDetailHTTP(client http.Client, endpoint *url.URL, traceID string) (*model.TracingSingleTrace, error)
	GetServiceStatusHTTP(client http.Client, baseURL *url.URL) (bool, error)
}

// GRPCClientInterface for Mocks, also for Tempo or Jaeger
type GRPCClientInterface interface {
	FindTraces(context context.Context, app string, q models.TracingQuery) (response *model.TracingResponse, err error)
	GetTrace(context context.Context, traceID string) (*model.TracingSingleTrace, error)
	GetServices(context context.Context) (bool, error)
}

// Client for Tracing API.
type Client struct {
	ClientInterface
	httpTracingClient HTTPClientInterface
	grpcClient        GRPCClientInterface
	httpClient        http.Client
	baseURL           *url.URL
	ctx               context.Context
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

func NewClient(token string) (*Client, error) {
	cfg := config.Get()
	cfgTracing := cfg.ExternalServices.Tracing
	var httpTracingClient HTTPClientInterface
	if !cfgTracing.Enabled {
		return nil, errors.New("tracing is not enabled")
	} else {
		auth := cfgTracing.Auth
		if auth.UseKialiToken {
			auth.Token = token
		}
		ctx := context.Background()

		u, errParse := url.Parse(cfgTracing.InClusterURL)
		if !cfg.InCluster {
			u, errParse = url.Parse(cfgTracing.URL)
		}
		if errParse != nil {
			log.Errorf("Error parsing Tracing URL: %s", errParse)
			return nil, errParse
		}

		port := u.Port()
		if port == "" {
			p, _ := net.LookupPort("tcp", u.Scheme)
			port = strconv.Itoa(p)
		}
		opts, err := grpcutil.GetAuthDialOptions(u.Scheme == "https", &auth)
		if err != nil {
			log.Errorf("Error while building GRPC dial options: %v", err)
			return nil, err
		}
		address := fmt.Sprintf("%s:%s", u.Hostname(), port)
		log.Tracef("%s GRPC client info: address=%s, auth.type=%s", cfgTracing.Provider, address, auth.Type)

		if cfgTracing.UseGRPC && cfgTracing.Provider != TEMPO {

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
			conn, err := grpc.Dial(address, opts...)
			if err == nil {
				cc := model.NewQueryServiceClient(conn)
				client, err = jaeger.NewGRPCJaegerClient(cc)
				if err != nil {
					return nil, err
				}
				if client == nil {
					return nil, fmt.Errorf("error creating GRPC client")
				}
				log.Infof("Create %s GRPC client %s", cfgTracing.Provider, address)
				return &Client{httpTracingClient: httpTracingClient, grpcClient: client, ctx: ctx}, nil
			} else {
				log.Errorf("Error creating client %s", err.Error())
				return nil, nil
			}

		} else {
			// Legacy HTTP client
			log.Tracef("Using legacy HTTP client for Tracing: url=%v, auth.type=%s", u, auth.Type)
			timeout := time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout) * time.Second
			transport, err := httputil.CreateTransport(&auth, &http.Transport{}, timeout, nil)
			if err != nil {
				return nil, err
			}
			client := http.Client{Transport: transport, Timeout: timeout}
			log.Infof("Create Tracing HTTP client %s", u)

			if cfgTracing.Provider == TEMPO {
				httpTracingClient, err = tempo.NewOtelClient(client, u)
				if err != nil {
					log.Errorf("Error creating HTTP client %s", err.Error())
					return nil, err
				}

				// Tempo uses gRPC stream client just for search
				// Get a single trace requires the http client
				if cfgTracing.UseGRPC {
					var dialOps []grpc.DialOption
					if cfgTracing.Auth.Type == "basic" {
						dialOps = append(dialOps, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
						dialOps = append(dialOps, grpc.WithPerRPCCredentials(&basicAuth{
							Header: fmt.Sprintf("Basic %s", base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", cfgTracing.Auth.Username, cfgTracing.Auth.Password)))),
						}))
					} else {
						dialOps = append(dialOps, grpc.WithTransportCredentials(insecure.NewCredentials()))
					}
					grpcAddress := fmt.Sprintf("%s:%d", u.Hostname(), cfg.ExternalServices.Tracing.GrpcPort)
					clientConn, _ := grpc.Dial(grpcAddress, dialOps...)
					streamClient, err := tempo.NewgRPCClient(client, u, clientConn)
					if err != nil {
						log.Errorf("Error creating gRPC Tempo Client %s", err.Error())
						return nil, nil
					}
					return &Client{httpTracingClient: httpTracingClient, grpcClient: streamClient, httpClient: client, baseURL: u, ctx: ctx}, nil
				}
			} else {
				httpTracingClient, err = jaeger.NewJaegerClient(client, u)
				if err != nil {
					return nil, err
				}
			}
			return &Client{httpTracingClient: httpTracingClient, httpClient: client, baseURL: u, ctx: ctx}, nil
		}
	}
}

// GetAppTraces fetches traces of an app
func (in *Client) GetAppTraces(namespace, app string, q models.TracingQuery) (*model.TracingResponse, error) {
	serviceName := BuildTracingServiceName(namespace, app)
	if in.grpcClient == nil {
		return in.httpTracingClient.GetAppTracesHTTP(in.httpClient, in.baseURL, serviceName, q)
	}
	return in.grpcClient.FindTraces(in.ctx, serviceName, q)

}

// GetTraceDetail fetches a specific trace from its ID
func (in *Client) GetTraceDetail(strTraceID string) (*model.TracingSingleTrace, error) {
	cfg := config.Get()
	if in.grpcClient == nil || cfg.ExternalServices.Tracing.Provider == TEMPO {
		if in.httpTracingClient != nil {
			return in.httpTracingClient.GetTraceDetailHTTP(in.httpClient, in.baseURL, strTraceID)
		} else {
			return nil, fmt.Errorf("error getting trace details")
		}
	}
	return in.grpcClient.GetTrace(in.ctx, strTraceID)
}

// GetErrorTraces fetches number of traces in error for the given app
func (in *Client) GetErrorTraces(ns, app string, duration time.Duration) (int, error) {
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

	traces, err := in.GetAppTraces(ns, app, query)
	if err != nil {
		return 0, err
	}
	return len(traces.Data), nil
}

func (in *Client) GetServiceStatus() (bool, error) {
	// Check Service Status using HTTP when gRPC is not enabled
	if in.grpcClient == nil {
		return in.httpTracingClient.GetServiceStatusHTTP(in.httpClient, in.baseURL)
	}

	return in.grpcClient.GetServices(in.ctx)
}

func BuildTracingServiceName(namespace, app string) string {
	conf := config.Get()
	if conf.ExternalServices.Tracing.NamespaceSelector {
		return app + "." + namespace
	}
	return app
}
