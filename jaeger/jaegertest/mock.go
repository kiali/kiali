package jaegertest

import (
	jaegerModels "github.com/jaegertracing/jaeger/model/json"
	"github.com/stretchr/testify/mock"
)

type JaegerClientMock struct {
	mock.Mock
}

func (j *JaegerClientMock) GetJaegerServices() (services []string, code int, err error) {
	args := j.Called()
	return args.Get(0).([]string), 200, args.Error(1)
}

func (j *JaegerClientMock) GetTraces(namespace string, service string, rawQuery string) (traces []*jaegerModels.Trace, code int, err error) {
	args := j.Called(namespace, service, rawQuery)
	return args.Get(0).([]*jaegerModels.Trace), 200, args.Error(1)
}

func (j *JaegerClientMock) GetTraceDetail(traceId string) (trace []*jaegerModels.Trace, code int, err error) {
	args := j.Called(traceId)
	return args.Get(0).([]*jaegerModels.Trace), 200, args.Error(1)
}

func (j *JaegerClientMock) GetErrorTraces(ns string, srv string) (errorTraces int, err error) {
	args := j.Called(ns, srv)
	return args.Get(0).(int), args.Error(1)
}
