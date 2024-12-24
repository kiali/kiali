package jaeger

import (
	"context"
	"fmt"
	"io"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/durationpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jsonConv "github.com/kiali/kiali/tracing/jaeger/model/converter/json"
	jsonModel "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/util"
)

type JaegerGRPCClient struct {
	JaegergRPCClient model.QueryServiceClient
}

func NewGRPCJaegerClient(cc model.QueryServiceClient) (jaegerClient *JaegerGRPCClient, err error) {

	return &JaegerGRPCClient{JaegergRPCClient: cc}, nil
}

// FindTraces
func (jc JaegerGRPCClient) FindTraces(ctx context.Context, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error) {
	jaegerServiceName := serviceName
	r := model.TracingResponse{
		Data:               []jsonModel.Trace{},
		TracingServiceName: jaegerServiceName,
	}

	var tags = util.CopyStringMap(q.Tags)

	findTracesRQ := &model.FindTracesRequest{
		Query: &model.TraceQueryParameters{
			ServiceName:  jaegerServiceName,
			StartTimeMin: timestamppb.New(q.Start),
			StartTimeMax: timestamppb.New(q.End),
			Tags:         tags,
			DurationMin:  durationpb.New(q.MinDuration),
			SearchDepth:  int32(q.Limit),
		},
	}

	tracesMap, err := jc.queryTraces(ctx, findTracesRQ)

	if err != nil {
		return nil, err
	}

	for _, t := range tracesMap {
		converted := jsonConv.FromDomain(t)
		r.Data = append(r.Data, *converted)
	}

	return &r, nil
}

func (jc JaegerGRPCClient) GetTrace(ctx context.Context, strTraceID string) (*model.TracingSingleTrace, error) {

	traceID, err := model.TraceIDFromString(strTraceID)
	if err != nil {
		return nil, fmt.Errorf("GetTraceDetail, invalid trace ID: %v", err)
	}
	bTraceId := make([]byte, 16)
	_, err = traceID.MarshalTo(bTraceId)
	if err != nil {
		return nil, fmt.Errorf("GetTraceDetail, invalid marshall: %v", err)
	}
	getTraceRQ := &model.GetTraceRequest{TraceId: bTraceId}

	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	stream, err := jc.JaegergRPCClient.GetTrace(ctx, getTraceRQ)
	if err != nil {
		return nil, fmt.Errorf("GetTraceDetail, Tracing GRPC client error: %v", err)
	}
	tracesMap, err := readSpansStream(stream)
	if err != nil {
		return nil, err
	}
	if trace, ok := tracesMap[traceID]; ok {
		converted := jsonConv.FromDomain(trace)
		return &model.TracingSingleTrace{Data: *converted}, nil
	}
	// Not found
	return nil, nil
}

// GetServices
func (jc JaegerGRPCClient) GetServices(ctxSrv context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctxSrv, 4*time.Second)
	defer cancel()

	_, err := jc.JaegergRPCClient.GetServices(ctx, &model.GetServicesRequest{})
	return err == nil, err
}

// query traces
func (jc JaegerGRPCClient) queryTraces(ctx context.Context, findTracesRQ *model.FindTracesRequest) (map[model.TraceID]*model.Trace, error) {
	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout)*time.Second)
	defer cancel()

	stream, err := jc.JaegergRPCClient.FindTraces(ctx, findTracesRQ)
	if err != nil {
		err = fmt.Errorf("GetAppTraces, Tracing GRPC client error: %v", err)
		log.Error(err.Error())
		return nil, err
	}

	tracesMap, err := readSpansStream(stream)

	return tracesMap, err
}

type SpansStreamer interface {
	Recv() (*model.SpansResponseChunk, error)
	grpc.ClientStream
}

func readSpansStream(stream SpansStreamer) (map[model.TraceID]*model.Trace, error) {
	tracesMap := make(map[model.TraceID]*model.Trace)
	for received, err := stream.Recv(); err != io.EOF; received, err = stream.Recv() {
		if err != nil {
			if status.Code(err) == codes.DeadlineExceeded {
				log.Trace("Tracing GRPC client timeout")
				break
			}
			log.Errorf("jaeger GRPC client, stream error: %v", err)
			return nil, fmt.Errorf("Tracing GRPC client, stream error: %v", err)
		}
		for i, span := range received.Spans {
			traceId := model.TraceID{}
			err := traceId.Unmarshal(span.TraceId)
			if err != nil {
				log.Errorf("Tracing TraceId unmarshall error: %v", err)
				continue
			}
			if trace, ok := tracesMap[traceId]; ok {
				trace.Spans = append(trace.Spans, received.Spans[i])
			} else {
				tracesMap[traceId] = &model.Trace{
					Spans: []*model.Span{received.Spans[i]},
				}
			}
		}
	}
	return tracesMap, nil
}
