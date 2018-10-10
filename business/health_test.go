package business

import (
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/apps/v1beta2"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"

	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	osappsv1 "github.com/openshift/api/apps/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestGetServiceHealth(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}
	k8s.On("GetService", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Run(func(args mock.Arguments) {
		assert.Equal("ns", args[0])
		assert.Equal("httpbin", args[1])
	}).Return(k8s.FakeService(), nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal("ns", args[0])
		assert.Equal("httpbin", args[1])
	}).Return(prometheus.EnvoyServiceHealth{Inbound: prometheus.EnvoyRatio{Healthy: 1, Total: 1}}, nil)

	prom.On("GetServiceRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeServiceRequestCounters())

	health, _ := hs.GetServiceHealth("ns", "httpbin", "1m")

	k8s.AssertNumberOfCalls(t, "GetService", 1)
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

	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.AnythingOfType("map[string]string")).Return(fakeServicesHealthReview(), nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakePodsHealthReview(), nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeDeploymentsHealthReview(), nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.StatefulSet{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)

	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]int32")).Run(func(args mock.Arguments) {
		assert.Equal("ns", args[0])
		assert.Equal("reviews", args[1])
	}).Return(prometheus.EnvoyServiceHealth{Inbound: prometheus.EnvoyRatio{Healthy: 1, Total: 1}}, nil)

	prom.On("GetAppRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeOtherRequestCounters())

	health, _ := hs.GetAppHealth("ns", "reviews", "1m")

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
	}).Return(&fakeDeploymentsHealthReview()[0], nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1.Pod{}, nil)

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

func fakeServicesHealthReview() []v1.Service {
	return []v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "reviews",
				Namespace: "tutorial",
				Labels: map[string]string{
					"app":     "reviews",
					"version": "v1"}},
			Spec: v1.ServiceSpec{
				ClusterIP: "fromservice",
				Type:      "ClusterIP",
				Selector:  map[string]string{"app": "reviews"},
				Ports: []v1.ServicePort{
					{
						Name:     "http",
						Protocol: "TCP",
						Port:     3001},
					{
						Name:     "http",
						Protocol: "TCP",
						Port:     3000}}}}}
}

func fakePodsHealthReview() []v1.Pod {
	return []v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:   "reviews-v1",
				Labels: map[string]string{"app": "reviews", "version": "v1"}}},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:   "reviews-v2",
				Labels: map[string]string{"app": "reviews", "version": "v2"}}}}
}

func fakeDeploymentsHealthReview() []v1beta1.Deployment {
	return []v1beta1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-v1"},
			Status: v1beta1.DeploymentStatus{
				Replicas:            3,
				AvailableReplicas:   2,
				UnavailableReplicas: 1},
			Spec: v1beta1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{"app": "reviews", "version": "v1"}}}},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-v2"},
			Status: v1beta1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   1,
				UnavailableReplicas: 1},
			Spec: v1beta1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{"app": "reviews", "version": "v2"}}}}}
}
