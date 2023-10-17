package tempo

import (
	"context"
	"fmt"
	jsonConv "github.com/kiali/kiali/tracing/jaeger/model/converter/json"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"io"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
)

type TempoGRPCClient struct {
	Cc tempopb.StreamingQuerierClient
}

func (jc TempoGRPCClient) FindTraces(ctx context.Context, serviceName string, q models.TracingQuery) (response *model.TracingResponse, err error) {

	var sr *tempopb.SearchRequest
	sr.Start = uint32(q.Start.Unix())
	sr.End = uint32(q.End.Unix())
	sr.Tags = q.Tags
	sr.MinDurationMs = uint32(q.MinDuration.Milliseconds())
	sr.Limit = uint32(q.Limit)
	sr.Query = fmt.Sprintf("serviceName=%s", serviceName) // TODO: Check query format

	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout)*time.Second)
	defer cancel()
	stream, err := jc.Cc.Search(ctx, sr)

	if err != nil {
		err = fmt.Errorf("GetAppTraces, Tracing GRPC client error: %v", err)
		log.Error(err.Error())
		return nil, err
	}

	tracesMap, err := processStream(stream)

	if err != nil {
		return nil, err
	}
	r := model.TracingResponse{
		Data:               []jaegerModels.Trace{},
		TracingServiceName: serviceName,
	}
	for _, t := range tracesMap {
		converted := jsonConv.FromDomain(t)
		r.Data = append(r.Data, *converted)
	}

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
	return false, nil
}

func processStream(stream tempopb.StreamingQuerier_SearchClient) (map[model.TraceID]*model.Trace, error) {

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
		for _, trace := range received.Traces {
			//traceId := model.TraceID{}
			traceID := trace.TraceID
			traceId := convertID(traceID)
			log.Infof("Trace ID: %s", traceID)
			tracesMap[traceId] = convertTraceMD(trace)
		}
	}
	return tracesMap, nil
}

func convertTraceMD(trace *tempopb.TraceSearchMetadata) *model.Trace {
	convertedTrace := model.Trace{}
	// TODO

	return &convertedTrace
}

func convertID(traceId string) model.TraceID {
	convertedTrace := model.TraceID{}
	b := []byte(traceId)
	convertedTrace.Unmarshal(b)
	return convertedTrace
}
