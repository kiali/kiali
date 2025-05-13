package tracingtest

import (
	"context"
	"time"

	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
)

type TracingClientMock struct {
	mock.Mock
}

func (j *TracingClientMock) GetAppTraces(ctx context.Context, ns, app string, query models.TracingQuery) (traces *model.TracingResponse, err error) {
	args := j.Called(ctx, ns, app, query)
	return args.Get(0).(*model.TracingResponse), args.Error(1)
}

func (j *TracingClientMock) GetTraceDetail(ctx context.Context, traceId string) (trace *model.TracingSingleTrace, err error) {
	args := j.Called(ctx, traceId)
	return args.Get(0).(*model.TracingSingleTrace), args.Error(1)
}

func (j *TracingClientMock) GetErrorTraces(ctx context.Context, ns string, app string, duration time.Duration) (errorTraces int, err error) {
	args := j.Called(ctx, ns, app, duration)
	return args.Get(0).(int), args.Error(1)
}

func (j *TracingClientMock) GetServiceStatus(ctx context.Context) (available bool, err error) {
	args := j.Called(ctx)
	return args.Get(0).(bool), args.Error(1)
}
