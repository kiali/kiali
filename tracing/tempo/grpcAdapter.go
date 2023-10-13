package tempo

import (
	"context"

	"google.golang.org/grpc"

	"github.com/kiali/kiali/tracing/jaeger/model"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
)

type tempoServiceClient struct {
	cc     *grpc.ClientConn
	tempoc *tempopb.QuerierClient
}

func NewTempoServiceClient(cc grpc.ClientConn) model.QueryServiceClient {
	tempoc := tempopb.NewQuerierClient(&cc)
	return &tempoServiceClient{&cc, &tempoc}
}

func (c *tempoServiceClient) GetTrace(ctx context.Context, in *model.GetTraceRequest, opts ...grpc.CallOption) (model.QueryService_GetTraceClient, error) {

	c.tempoc.FindTraceByID(ctx, in.TraceId, "/jaeger.api_v2.QueryService/GetTrace")
	/*
	stream, err := c.cc.NewStream(ctx, &_QueryService_serviceDesc.Streams[0], "/jaeger.api_v2.QueryService/GetTrace", opts...)
	if err != nil {
		return nil, err
	}
	x := &queryServiceGetTraceClient{stream}
	if err := x.ClientStream.SendMsg(in); err != nil {
		return nil, err
	}
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	*/
	 */
	return x, nil
}

func (c *tempoServiceClient) ArchiveTrace(ctx context.Context, in *model.ArchiveTraceRequest, opts ...grpc.CallOption) (*model.ArchiveTraceResponse, error) {
	out := new(ArchiveTraceResponse)
	err := c.cc.Invoke(ctx, "/jaeger.api_v2.QueryService/ArchiveTrace", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *tempoServiceClient) FindTraces(ctx context.Context, in *model.FindTracesRequest, opts ...grpc.CallOption) (model.QueryService_FindTracesClient, error) {
	stream, err := c.cc.NewStream(ctx, &_QueryService_serviceDesc.Streams[1], "/jaeger.api_v2.QueryService/FindTraces", opts...)
	if err != nil {
		return nil, err
	}
	x := &queryServiceFindTracesClient{stream}
	if err := x.ClientStream.SendMsg(in); err != nil {
		return nil, err
	}
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	return x, nil
}

func (c *tempoServiceClient) GetServices(ctx context.Context, in *model.GetServicesRequest, opts ...grpc.CallOption) (*model.GetServicesResponse, error) {
	out := new(GetServicesResponse)
	err := c.cc.Invoke(ctx, "/jaeger.api_v2.QueryService/GetServices", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *tempoServiceClient) GetOperations(ctx context.Context, in *model.GetOperationsRequest, opts ...grpc.CallOption) (*model.GetOperationsResponse, error) {
	out := new(GetOperationsResponse)
	err := c.cc.Invoke(ctx, "/jaeger.api_v2.QueryService/GetOperations", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *tempoServiceClient) GetDependencies(ctx context.Context, in *model.GetDependenciesRequest, opts ...grpc.CallOption) (*model.GetDependenciesResponse, error) {
	out := new(GetDependenciesResponse)
	err := c.cc.Invoke(ctx, "/jaeger.api_v2.QueryService/GetDependencies", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}
