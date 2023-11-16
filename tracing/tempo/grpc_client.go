package tempo

import (
	"context"
	"fmt"
	"github.com/kiali/kiali/tracing/otel/model/converter"
	"io"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
)

type TempoGRPCClient struct {
	Cc tempopb.StreamingQuerierClient
}

func (jc TempoGRPCClient) FindTraces(ctx context.Context, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error) {

	sr := &tempopb.SearchRequest{}
	sr.Start = uint32(q.Start.Unix())
	sr.End = uint32(q.End.Unix())
	sr.MinDurationMs = uint32(q.MinDuration.Milliseconds())
	sr.Limit = uint32(q.Limit)
	//sr.Query = fmt.Sprintf("{.service.name=\"%s\"}", serviceName) // TODO: Check query format
	sr.Query = fmt.Sprintf("{.service.name=\"%s\" && .node_id =~ \".*\"} && { }", serviceName)

	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout)*time.Second)
	defer cancel()
	stream, err := jc.Cc.Search(ctx, sr)

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

	/*
		for _, t := range tracesMap {
			converted := jsonConv.FromDomain(t)
			r.Data = append(r.Data, *converted)
		} */

	return &r, nil
}

// TODO
func (jc TempoGRPCClient) GetTrace(ctx context.Context, strTraceID string) (*model.TracingSingleTrace, error) {

	traceID, err := model.TraceIDFromString(strTraceID)
	if err != nil {
		return nil, fmt.Errorf("GetTraceDetail, invalid trace ID: %v", err)
	}
	bTraceId := make([]byte, 16)
	_, err = traceID.MarshalTo(bTraceId)
	if err != nil {
		return nil, fmt.Errorf("GetTraceDetail, invalid marshall: %v", err)
	}

	//getTraceRQ := &model.GetTraceRequest{TraceId: bTraceId}

	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	/*
		stream, err := jc.Cc.GetTrace(ctx, getTraceRQ)
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
	*/
	// Not found
	return nil, nil
}

// TODO
func (jc TempoGRPCClient) GetServices(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	//_, err := jc.Cc.GetServices(ctx, &model.GetServicesRequest{})
	//return err == nil, err
	return true, nil
}

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

func convertID(traceId string) model.TraceID {
	convertedTrace := model.TraceID{}
	b := []byte(traceId)
	err := convertedTrace.Unmarshal(b)
	if err != nil {
		log.Errorf("Error unmarshalling ID: %s", err.Error())
	}
	return convertedTrace
}
