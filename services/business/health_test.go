package business

import (
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestGetServiceHealth(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}
	k8s.On("GetServiceDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal("ns", args[0])
		assert.Equal("httpbin", args[1])
	}).Return(k8s.FakeServiceDetails(), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal("ns", args[0])
		assert.Equal("httpbin", args[1])
	}).Return(prometheus.EnvoyServiceHealth{Inbound: prometheus.EnvoyRatio{Healthy: 1, Total: 1}}, nil)

	prom.On("GetServiceRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeServiceRequestCounters())

	health, _ := hs.GetServiceHealth("ns", "httpbin", "1m")

	k8s.AssertNumberOfCalls(t, "GetServiceDetails", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 1)
	prom.AssertNumberOfCalls(t, "GetServiceRequestRates", 1)
	assert.Equal(1, health.Envoy.Inbound.Total)
	assert.Equal(1, health.Envoy.Inbound.Healthy)
	assert.Equal(float64(15.4), health.Requests.RequestCount)
	assert.Equal(float64(1.4), health.Requests.RequestErrorCount)
}

func TestGetAppHealth(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}
	k8s.On("GetAppDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal("ns", args[0])
		assert.Equal("reviews", args[1])
	}).Return(k8s.FakeAppDetails(), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal("ns", args[0])
		assert.Equal("reviews", args[1])
	}).Return(prometheus.EnvoyServiceHealth{Inbound: prometheus.EnvoyRatio{Healthy: 1, Total: 1}}, nil)

	prom.On("GetAppRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeOtherRequestCounters())

	health, _ := hs.GetAppHealth("ns", "reviews", "1m")

	k8s.AssertNumberOfCalls(t, "GetAppDetails", 1)
	prom.AssertNumberOfCalls(t, "GetServiceHealth", 1)
	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 1)
	assert.Equal(1, len(health.Envoy))
	assert.Equal(1, health.Envoy[0].Inbound.Total)
	assert.Equal(1, health.Envoy[0].Inbound.Healthy)
	assert.Equal(0, health.Envoy[0].Outbound.Total)
	assert.Equal(0, health.Envoy[0].Outbound.Healthy)
	assert.Equal(float64(6.6), health.Requests.RequestCount)
	assert.Equal(float64(1.6), health.Requests.RequestErrorCount)
}

func TestGetWorkloadHealth(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}
	k8s.On("GetDeployment", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal("ns", args[0])
		assert.Equal("reviews-v1", args[1])
	}).Return(&k8s.FakeAppDetails().Deployments[0], nil)

	prom.On("GetWorkloadRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeOtherRequestCounters())

	health, _ := hs.GetWorkloadHealth("ns", "reviews-v1", "1m")

	k8s.AssertNumberOfCalls(t, "GetDeployment", 1)
	prom.AssertNumberOfCalls(t, "GetWorkloadRequestRates", 1)
	assert.Equal(float64(6.6), health.Requests.RequestCount)
	assert.Equal(float64(1.6), health.Requests.RequestErrorCount)
}

var t1 = model.Now()
var sampleReviewsToHttpbin200 = model.Sample{
	Metric: model.Metric{
		"source_service":      "reviews.tutorial.svc.cluster.local",
		"destination_service": "httpbin.tutorial.svc.cluster.local",
		"response_code":       "200",
	},
	Value:     model.SampleValue(5),
	Timestamp: t1,
}
var sampleUnknownToHttpbin200 = model.Sample{
	Metric: model.Metric{
		"destination_service": "httpbin.tutorial.svc.cluster.local",
		"source_service":      "unknown",
		"response_code":       "200",
	},
	Value:     model.SampleValue(14),
	Timestamp: t1,
}
var sampleUnknownToHttpbin404 = model.Sample{
	Metric: model.Metric{
		"destination_service": "httpbin.tutorial.svc.cluster.local",
		"source_service":      "unknown",
		"response_code":       "404",
	},
	Value:     model.SampleValue(1.4),
	Timestamp: t1,
}
var sampleUnknownToReviews500 = model.Sample{
	Metric: model.Metric{
		"destination_service": "reviews.tutorial.svc.cluster.local",
		"source_service":      "unknown",
		"response_code":       "500",
	},
	Value:     model.SampleValue(1.6),
	Timestamp: t1,
}

func fakeServiceRequestCounters() (model.Vector, error) {
	in := model.Vector{
		&sampleUnknownToHttpbin200,
		&sampleUnknownToHttpbin404,
	}
	return in, nil
}

func fakeOtherRequestCounters() (model.Vector, model.Vector, error) {
	in := model.Vector{
		&sampleUnknownToReviews500,
	}
	out := model.Vector{
		&sampleReviewsToHttpbin200,
	}
	return in, out, nil
}
