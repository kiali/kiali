package business

import (
	"time"

	"github.com/kiali/kiali/jaeger"
	"github.com/kiali/kiali/models"
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

func (in *JaegerService) GetJaegerSpans(ns, app string, query models.TracingQuery) ([]jaeger.Span, error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	return client.GetSpans(ns, app, query)
}

func (in *JaegerService) GetAppTraces(ns, app string, query models.TracingQuery) (*jaeger.JaegerResponse, error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	return client.GetAppTraces(ns, app, query)
}

func (in *JaegerService) GetServiceTraces(ns, service string, query models.TracingQuery) (*jaeger.JaegerResponse, error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	app, err := in.businessLayer.Svc.GetServiceAppName(ns, service)
	if err != nil {
		return nil, err
	}
	return client.GetServiceTraces(ns, app, service, query)
}

func (in *JaegerService) GetWorkloadTraces(ns, workload string, query models.TracingQuery) (*jaeger.JaegerResponse, error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	app, err := in.businessLayer.Workload.GetWorkloadAppName(ns, workload)
	if err != nil {
		return nil, err
	}
	return client.GetWorkloadTraces(ns, app, workload, query)
}

func (in *JaegerService) GetJaegerTraceDetail(traceID string) (trace *jaeger.JaegerSingleTrace, err error) {
	client, err := in.client()
	if err != nil {
		return nil, err
	}
	return client.GetTraceDetail(traceID)
}

func (in *JaegerService) GetErrorTraces(ns, app string, duration time.Duration) (errorTraces int, err error) {
	client, err := in.client()
	if err != nil {
		return 0, err
	}
	return client.GetErrorTraces(ns, app, duration)
}
