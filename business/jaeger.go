package business

import (
	"github.com/kiali/kiali/jaeger"

	jaegerModels "github.com/jaegertracing/jaeger/model/json"
)

type JaegerService struct {
	jaeger        jaeger.ClientInterface
	businessLayer *Layer
}

func (in *JaegerService) GetJaegerServices() (services []string, code int, err error) {
	return in.jaeger.GetJaegerServices()
}

func (in *JaegerService) GetJaegerTraces(ns string, srv string, query string) (traces []*jaegerModels.Trace, code int, err error) {
	return in.jaeger.GetTraces(ns, srv, query)
}

func (in *JaegerService) GetJaegerTraceDetail(traceID string) (trace []*jaegerModels.Trace, code int, err error) {
	return in.jaeger.GetTraceDetail(traceID)
}
