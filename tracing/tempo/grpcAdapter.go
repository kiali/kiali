package tempo

import (
	"context"

	"google.golang.org/grpc"

	"github.com/kiali/kiali/tracing/jaeger/model"
	"github.com/kiali/kiali/tracing/tempo/tempopb"
)

type grpcTempoClient struct {
	tempoc *tempopb.QuerierClient
}

func NewTempoServiceClient(cc grpc.ClientConn) model.QueryServiceClient {
	tempoc := tempopb.NewQuerierClient(&cc)
	return &grpcTempoClient{&tempoc}
}

func (c *grpcTempoClient) GetTrace(ctx context.Context, in *model.GetTraceRequest, opts ...grpc.CallOption) (model.QueryService_GetTraceClient, error) {

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
	return x, nil
}
