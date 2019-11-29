package business

import (
	"github.com/kiali/kiali/jaeger"

	jaegerModels "github.com/jaegertracing/jaeger/model/json"
)

type JaegerLoader = func() (jaeger.ClientInterface, error)

type JaegerService struct {
	loader        JaegerLoader
	loaderErr     error
	jaeger        jaeger.ClientInterface
	businessLayer *Layer
}

func (in *JaegerService) client() (jaeger.ClientInterface, error) {
	if in.jaeger != nil {
		return in.jaeger, nil
	} else if in.loaderErr != nil {
		return nil, in.loaderErr
	}
	in.jaeger, in.loaderErr = in.loader()
	return in.jaeger, in.loaderErr
}

func (in *JaegerService) GetJaegerServices() (services []string, code int, err error) {
	client, err := in.client()
	if err != nil {
		return nil, 0, err
	}
	return client.GetJaegerServices()
}

func (in *JaegerService) GetJaegerTraces(ns string, srv string, query string) (traces []*jaegerModels.Trace, code int, err error) {
	client, err := in.client()
	if err != nil {
		return nil, 0, err
	}
	return client.GetTraces(ns, srv, query)
}

func (in *JaegerService) GetJaegerTraceDetail(traceID string) (trace []*jaegerModels.Trace, code int, err error) {
	client, err := in.client()
	if err != nil {
		return nil, 0, err
	}
	return client.GetTraceDetail(traceID)
}

func (in *JaegerService) GetErrorTraces(ns string, srv string) (errorTraces int, err error) {
	client, err := in.client()
	if err != nil {
		return 0, err
	}
	return client.GetErrorTraces(ns, srv)
}
