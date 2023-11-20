package tempo

import (
	"context"
	"fmt"
	"io"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/tracing/otel/model/converter"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
)

type TempoGRPCClient struct {
	StreamingClient tempopb.StreamingQuerierClient
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

	group1 := TraceQL{operator1: "status", operand: EQUAL, operator2: unquoted("error")}
	group2 := TraceQL{operator1: "status", operand: EQUAL, operator2: unquoted("unset")}
	group3 := TraceQL{operator1: "status", operand: EQUAL, operator2: unquoted("ok")}
	groupQL := []TraceQL{group1, group2, group3}
	group := Group{group: groupQL, operand: OR}

	if len(q.Tags) > 0 {
		for k, v := range q.Tags {
			tag := TraceQL{operator1: "." + k, operand: EQUAL, operator2: v}
			queryPart = TraceQL{operator1: queryPart, operand: AND, operator2: tag}
		}
	}

	subquery := TraceQL{operator1: queryPart, operand: AND, operator2: group}
	trace := TraceQL{operator1: Subquery{subquery}, operand: AND, operator2: Subquery{}}
	queryQL := trace.getQuery()
	log.Debugf("QueryQL %s", queryQL)

	sr.Query = queryQL

	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout)*time.Second)
	defer cancel()
	stream, err := jc.StreamingClient.Search(ctx, sr)

	if err != nil {
		err = fmt.Errorf("GetAppTraces, Tracing GRPC client error: %v", err)
		log.Error(err.Error())
		return nil, err
	}

	traces, err := processStream(stream, serviceName)

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

	log.Errorf("GetTrace is not implemented by the Tempo streaming client")
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

// processStream
func processStream(stream tempopb.StreamingQuerier_SearchClient, serviceName string) ([]jaegerModels.Trace, error) {

	tracesMap := []jaegerModels.Trace{}

	for received, err := stream.Recv(); err != io.EOF; received, err = stream.Recv() {
		if err != nil {
			if status.Code(err) == codes.DeadlineExceeded {
				log.Trace("Tracing GRPC client timeout")
				break
			}
			log.Errorf("tempo GRPC client, stream error: %v", err)
			return nil, fmt.Errorf("Tracing GRPC client, stream error: %v", err)
		}
		for _, trace := range received.Traces {
			batchTrace, err := converter.ConvertTraceMetadata(*trace, serviceName)
			if err != nil {
				log.Errorf("Error getting trace detail for %s: %s", trace.TraceID, err.Error())
			} else {
				tracesMap = append(tracesMap, *batchTrace)
			}
		}
	}
	return tracesMap, nil
}
