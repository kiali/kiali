package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
	otel "github.com/kiali/kiali/tracing/otel/model"
	"github.com/kiali/kiali/tracing/otel/model/converter"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
	"github.com/kiali/kiali/util"
)

type TempoGRPCClient struct {
	StreamingClient tempopb.StreamingQuerierClient
	ClusterTag      bool
}

// New client
func NewgRPCClient(client http.Client, baseURL *url.URL, clientConn *grpc.ClientConn) (otelClient *TempoGRPCClient, err error) {
	url := *baseURL
	url.Path = path.Join(url.Path, "/api/search/tags")
	tags := false
	r, status, _ := makeRequest(client, url.String(), nil)
	if status != 200 {
		log.Debugf("[gRPC Tempo] Error getting Tempo tags for tracing. Tags will be disabled.")
	} else {
		var response otel.TagsResponse
		if errMarshal := json.Unmarshal(r, &response); errMarshal != nil {
			log.Errorf("[gRPC Tempo] Error unmarshalling Tempo API response: %s [URL: %v]", errMarshal, url)
			return nil, errMarshal
		}

		if util.InSlice(response.TagNames, models.IstioClusterTag) {
			tags = true
		}
	}

	clientStreamTempo := tempopb.NewStreamingQuerierClient(clientConn)
	streamClient := TempoGRPCClient{StreamingClient: clientStreamTempo, ClusterTag: tags}
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
			if k != "cluster" && jc.ClusterTag {
				tag := TraceQL{operator1: "." + k, operand: EQUAL, operator2: v}
				queryPart = TraceQL{operator1: queryPart, operand: AND, operator2: tag}
			}
		}
	}

	selects := []string{"status", ".service_name", ".node_id", ".component", ".upstream_cluster", ".http.method", ".response_flags"}
	trace := TraceQL{operator1: Subquery{queryPart}, operand: AND, operator2: Subquery{}}
	queryQL := fmt.Sprintf("%s| %s", printOperator(trace), printSelect(selects))
	log.Debugf("QueryQL %s", queryQL)

	sr.Query = queryQL
	sr.SpansPerSpanSet = 10

	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.Get().ExternalServices.Tracing.QueryTimeout)*time.Second)
	defer cancel()
	stream, err := jc.StreamingClient.Search(ctx, sr)

	if err != nil {
		err = fmt.Errorf("[gRPC Tempo] GetAppTraces, Tracing gRPC client error: %v", err)
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

	log.Errorf("[gRPC Tempo] GetTrace is not implemented by the Tempo streaming client")
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
			log.Errorf("[gRPC Tempo] stream error: %v", err)
			return nil, fmt.Errorf("[gRPC Tempo] Tracing gRPC client, stream error: %v", err)
		}
		for _, trace := range received.Traces {
			batchTrace, err := converter.ConvertTraceMetadata(*trace, serviceName)
			if err != nil {
				log.Errorf("[gRPC Tempo] Error getting trace detail for %s: %s", trace.TraceID, err.Error())
			} else {
				tracesMap = append(tracesMap, *batchTrace)
			}
		}
	}
	return tracesMap, nil
}
