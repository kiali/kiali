package tempo

import (
	"context"
	"fmt"
	"io"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/tracing/otel/model/converter"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
)

type TempoGRPCClient struct {
	StreamingClient tempopb.StreamingQuerierClient
}

// New client
func NewgRPCClient(clientConn *grpc.ClientConn) (otelClient *TempoGRPCClient, err error) {
	clientStreamTempo := tempopb.NewStreamingQuerierClient(clientConn)
	streamClient := TempoGRPCClient{StreamingClient: clientStreamTempo}
	return &streamClient, nil
}

func (jc TempoGRPCClient) FindTraces(ctx context.Context, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error) {

	sr := &tempopb.SearchRequest{}
	sr.Start = uint32(q.Start.Unix())
	sr.End = uint32(q.End.Unix())
	sr.MinDurationMs = uint32(q.MinDuration.Milliseconds())
	sr.Limit = uint32(q.Limit)

	// Create query
	queryPart1 := TraceQL{operator1: ".service.name", operand: EQUAL, operator2: serviceName}
	queryPart2 := TraceQL{operator1: ".node_id", operand: REGEX, operator2: ".*"}
	queryPart := TraceQL{operator1: queryPart1, operand: AND, operator2: queryPart2}

	if len(q.Tags) > 0 {
		for k, v := range q.Tags {
			tag := TraceQL{operator1: "." + k, operand: EQUAL, operator2: v}
			queryPart = TraceQL{operator1: queryPart, operand: AND, operator2: tag}
		}
	}

	selects := []string{"status", ".service_name", ".node_id", ".component", ".upstream_cluster", ".http.method", ".response_flags", "resource.hostname", "name"}
	trace := TraceQL{operator1: Subquery{queryPart}, operand: AND, operator2: Subquery{}}
	queryQL := fmt.Sprintf("%s| %s", printOperator(trace), printSelect(selects))

	zl := getLoggerFromContextGRPCTempo(ctx)
	zl.Debug().Msgf("[gRPC Tempo] QueryQL: %s", queryQL)

	sr.Query = queryQL
	sr.SpansPerSpanSet = 10

	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout)*time.Second)
	defer cancel()
	stream, err := jc.StreamingClient.Search(ctx, sr)

	if err != nil {
		err = fmt.Errorf("[gRPC Tempo] GetAppTraces, Tracing gRPC client error: %v", err)
		zl.Error().Msg(err.Error())
		return nil, err
	}

	traces, err := processStream(ctx, stream, serviceName)

	if err != nil {
		return nil, err
	}
	r := model.TracingResponse{
		Data:               traces,
		TracingServiceName: serviceName,
	}

	return &r, nil
}

// GetTrace is not implemented by the streaming client
func (jc TempoGRPCClient) GetTrace(ctx context.Context, strTraceID string) (*model.TracingSingleTrace, error) {
	getLoggerFromContextGRPCTempo(ctx).Error().Msgf("[gRPC Tempo] GetTrace is not implemented by the Tempo streaming client")
	return nil, nil

}

// GetServices Test an empty search to check if the service is available
func (jc TempoGRPCClient) GetServices(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	sr := &tempopb.SearchRequest{}
	_, err := jc.StreamingClient.Search(ctx, sr)
	return err == nil, err
}

// GetServices Test an empty search to check if the service is available
func (jc TempoGRPCClient) GetServicesList(ctx context.Context) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	sr := &tempopb.SearchRequest{}
	result, err := jc.StreamingClient.Search(ctx, sr)
	if err != nil {
		return nil, err
	}
	services, err := processServices(ctx, result)
	return services, err
}

// processStream
func processStream(ctx context.Context, stream tempopb.StreamingQuerier_SearchClient, serviceName string) ([]jaegerModels.Trace, error) {
	zl := getLoggerFromContextGRPCTempo(ctx)

	tracesMap := []jaegerModels.Trace{}

	for received, err := stream.Recv(); err != io.EOF; received, err = stream.Recv() {
		if err != nil {
			if status.Code(err) == codes.DeadlineExceeded {
				zl.Trace().Msg("[gRPC Tempo] client timeout")
				break
			}
			zl.Error().Msgf("[gRPC Tempo] stream error: %v", err)
			return nil, fmt.Errorf("[gRPC Tempo] Tracing gRPC client, stream error: %v", err)
		}
		for _, trace := range received.Traces {
			batchTrace, err := converter.ConvertTraceMetadata(*trace, serviceName)
			if err != nil {
				zl.Error().Msgf("[gRPC Tempo] Error getting trace detail for %s: %s", trace.TraceID, err.Error())
			} else {
				tracesMap = append(tracesMap, *batchTrace)
			}
		}
	}
	return tracesMap, nil
}

// processServices
func processServices(ctx context.Context, stream tempopb.StreamingQuerier_SearchClient) ([]string, error) {
	zl := getLoggerFromContextGRPCTempo(ctx)
	services := []string{}

	for received, err := stream.Recv(); err != io.EOF; received, err = stream.Recv() {
		if err != nil {
			if status.Code(err) == codes.DeadlineExceeded {
				zl.Trace().Msg("[gRPC Tempo] client timeout")
				break
			}
			zl.Error().Msgf("[gRPC Tempo] stream error: %v", err)
			return nil, fmt.Errorf("[gRPC Tempo] Tracing gRPC client, stream error: %v", err)
		}
		for _, trace := range received.Traces {
			services = append(services, trace.RootTraceName)
		}
	}
	return services, nil
}
