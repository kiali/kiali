package jaegertest

import (
	"github.com/kiali/kiali/tracing/model"
	"time"

	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/models"
)

type JaegerClientMock struct {
	mock.Mock
}

func (j *JaegerClientMock) GetAppTraces(ns, app string, query models.TracingQuery) (traces *model.TracingResponse, err error) {
	args := j.Called(ns, app, query)
	return args.Get(0).(*model.TracingResponse), args.Error(1)
}

func (j *JaegerClientMock) GetTraceDetail(traceId string) (trace *model.TracingSingleTrace, err error) {
	args := j.Called(traceId)
	return args.Get(0).(*model.TracingSingleTrace), args.Error(1)
}

func (j *JaegerClientMock) GetErrorTraces(ns string, app string, duration time.Duration) (errorTraces int, err error) {
	args := j.Called(ns, app, duration)
	return args.Get(0).(int), args.Error(1)
}

func (j *JaegerClientMock) GetServiceStatus() (available bool, err error) {
	args := j.Called()
	return args.Get(0).(bool), args.Error(1)
}
