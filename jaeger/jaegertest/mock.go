package jaegertest

import (
	"time"

	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/jaeger"
	"github.com/kiali/kiali/models"
)

type JaegerClientMock struct {
	mock.Mock
}

func (j *JaegerClientMock) GetAppTraces(ns, app string, query models.TracingQuery) (traces *jaeger.JaegerResponse, err error) {
	args := j.Called(ns, app, query)
	return args.Get(0).(*jaeger.JaegerResponse), args.Error(1)
}

func (j *JaegerClientMock) GetTraceDetail(traceId string) (trace *jaeger.JaegerSingleTrace, err error) {
	args := j.Called(traceId)
	return args.Get(0).(*jaeger.JaegerSingleTrace), args.Error(1)
}

func (j *JaegerClientMock) GetErrorTraces(ns string, app string, duration time.Duration) (errorTraces int, err error) {
	args := j.Called(ns, app, duration)
	return args.Get(0).(int), args.Error(1)
}

func (j *JaegerClientMock) GetServiceStatus() (available bool, err error) {
	args := j.Called()
	return args.Get(0).(bool), args.Error(1)
}
