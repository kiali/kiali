package jaeger

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"strconv"
	"time"

	"github.com/jaegertracing/jaeger/model"
	jsonConv "github.com/jaegertracing/jaeger/model/converter/json"
	jsonModel "github.com/jaegertracing/jaeger/model/json"
	"github.com/jaegertracing/jaeger/proto-gen/api_v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/grpcutil"
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
	grpcClient api_v2.QueryServiceClient
	ctx        context.Context
}

func NewClient(token string) (*Client, error) {
	cfg := config.Get()
	cfgTracing := cfg.ExternalServices.Tracing

	if !cfgTracing.Enabled {
		return nil, errors.New("jaeger is not enabled")
	} else {
		auth := cfgTracing.Auth
		if auth.UseKialiToken {
			auth.Token = token
		}
		ctx := context.Background()
		// TODO: make sure this isn't required in case of token auth; if so, remove these lines
		// if auth.Token != "" {
		// 	requestMetadata := metadata.New(map[string]string{
		// 		spanstore.BearerTokenKey: auth.Token,
		// 	})
		// 	ctx = metadata.NewOutgoingContext(ctx, requestMetadata)
		// }

		u, errParse := url.Parse(cfgTracing.InClusterURL)
		if !cfg.InCluster {
			u, errParse = url.Parse(cfgTracing.URL)
		}
		if errParse != nil {
			log.Errorf("Error parsing Jaeger URL: %s", errParse)
			return nil, errParse
		}

		// GRPC client
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
		log.Tracef("Jaeger GRPC client info: address=%s, auth.type=%s", address, auth.Type)
		conn, err := grpc.Dial(address, opts...)
		if err != nil {
			log.Errorf("Error while establishing GRPC connection: %v", err)
			return nil, err
		}
		client := api_v2.NewQueryServiceClient(conn)

		return &Client{grpcClient: client, ctx: ctx}, nil
	}
}

// GetAppTraces fetches traces of an app
func (in *Client) GetAppTraces(namespace, app string, q models.TracingQuery) (*JaegerResponse, error) {
	jaegerServiceName := buildJaegerServiceName(namespace, app)
	findTracesRQ := &api_v2.FindTracesRequest{
		Query: &api_v2.TraceQueryParameters{
			ServiceName:  jaegerServiceName,
			StartTimeMin: q.Start,
			StartTimeMax: q.End,
			Tags:         q.Tags,
			DurationMin:  q.MinDuration,
			SearchDepth:  int32(q.Limit),
		},
	}
	ctx, cancel := context.WithTimeout(in.ctx, 4*time.Second)
	defer cancel()

	stream, err := in.grpcClient.FindTraces(ctx, findTracesRQ)
	if err != nil {
		return nil, fmt.Errorf("GetAppTraces, Jaeger GRPC client error: %v", err)
	}

	tracesMap, err := readSpansStream(stream)
	if err != nil {
		return nil, err
	}
	r := JaegerResponse{
		Data:              []jsonModel.Trace{},
		JaegerServiceName: jaegerServiceName,
	}
	for _, t := range tracesMap {
		converted := jsonConv.FromDomain(t)
		r.Data = append(r.Data, *converted)
	}

	return &r, nil
}

// GetTraceDetail fetches a specific trace from its ID
func (in *Client) GetTraceDetail(strTraceID string) (*JaegerSingleTrace, error) {
	traceID, err := model.TraceIDFromString(strTraceID)
	if err != nil {
		return nil, fmt.Errorf("GetTraceDetail, invalid trace ID: %v", err)
	}
	getTraceRQ := &api_v2.GetTraceRequest{TraceID: traceID}

	ctx, cancel := context.WithTimeout(in.ctx, 4*time.Second)
	defer cancel()

	stream, err := in.grpcClient.GetTrace(ctx, getTraceRQ)
	if err != nil {
		return nil, fmt.Errorf("GetTraceDetail, Jaeger GRPC client error: %v", err)
	}
	tracesMap, err := readSpansStream(stream)
	if err != nil {
		return nil, err
	}
	if trace, ok := tracesMap[traceID]; ok {
		converted := jsonConv.FromDomain(trace)
		return &JaegerSingleTrace{Data: *converted}, nil
	}
	// Not found
	return nil, nil
}

// GetErrorTraces fetches number of traces in error for the given app
func (in *Client) GetErrorTraces(ns, app string, duration time.Duration) (int, error) {
	now := time.Now()
	query := models.TracingQuery{
		Start: now.Add(-duration),
		End:   now,
		Tags:  map[string]string{"error": "true"},
	}
	traces, err := in.GetAppTraces(ns, app, query)
	if err != nil {
		return 0, err
	}
	return len(traces.Data), nil
}

type SpansStreamer interface {
	Recv() (*api_v2.SpansResponseChunk, error)
	grpc.ClientStream
}

func readSpansStream(stream SpansStreamer) (map[model.TraceID]*model.Trace, error) {
	tracesMap := make(map[model.TraceID]*model.Trace)
	for received, err := stream.Recv(); err != io.EOF; received, err = stream.Recv() {
		if err != nil {
			if status.Code(err) == codes.DeadlineExceeded {
				log.Trace("Jaeger GRPC client timeout")
				break
			}
			log.Errorf("jaeger GRPC client, stream error: %v", err)
			return nil, fmt.Errorf("Jaeger GRPC client, stream error: %v", err)
		}
		for i, span := range received.Spans {
			if trace, ok := tracesMap[span.TraceID]; ok {
				trace.Spans = append(trace.Spans, &received.Spans[i])
			} else {
				tracesMap[span.TraceID] = &model.Trace{
					Spans: []*model.Span{&received.Spans[i]},
				}
			}
		}
	}
	return tracesMap, nil
}

func buildJaegerServiceName(namespace, app string) string {
	conf := config.Get()
	if conf.ExternalServices.Tracing.NamespaceSelector && namespace != conf.IstioNamespace {
		return app + "." + namespace
	}
	return app
}
