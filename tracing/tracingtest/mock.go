package tracingtest

import (
	"fmt"
	"github.com/kiali/kiali/store"
	"time"

	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
)

type TracingClientMock struct {
	mock.Mock
}

func (j *TracingClientMock) GetAppTraces(ns, app string, query models.TracingQuery) (traces *model.TracingResponse, err error) {
	args := j.Called(ns, app, query)
	return args.Get(0).(*model.TracingResponse), args.Error(1)
}

func (j *TracingClientMock) GetTraceDetail(traceId string) (trace *model.TracingSingleTrace, err error) {
	args := j.Called(traceId)
	return args.Get(0).(*model.TracingSingleTrace), args.Error(1)
}

func (j *TracingClientMock) GetErrorTraces(ns string, app string, duration time.Duration) (errorTraces int, err error) {
	args := j.Called(ns, app, duration)
	return args.Get(0).(int), args.Error(1)
}

func (j *TracingClientMock) GetServiceStatus() (available bool, err error) {
	args := j.Called()
	return args.Get(0).(bool), args.Error(1)
}

func (j *TracingClientMock) GetCacheStats() (*store.Stats, error) {
	return nil, fmt.Errorf("Cache is disabled")
}
