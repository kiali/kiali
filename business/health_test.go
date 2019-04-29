package business

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
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

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockServiceRequestRates("ns", "httpbin", serviceRates)

	health, _ := hs.GetServiceHealth("ns", "httpbin", "1m", queryTime)

	prom.AssertNumberOfCalls(t, "GetServiceRequestRates", 1)
	// 1.4 / 15.4 = 0.09
	assert.InDelta(float64(0.09), health.Requests.ErrorRatio, 0.01)
	assert.Equal(float64(1.4)/float64(15.4), health.Requests.InboundErrorRatio)
	assert.Equal(float64(-1), health.Requests.OutboundErrorRatio)
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
	k8s.MockEmptyWorkloads("ns")
	k8s.On("GetDeployments", "ns").Return(fakeDeploymentsHealthReview(), nil)
	k8s.On("GetPods", "ns", "app=reviews").Return(fakePodsHealthReview(), nil)

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockAppRequestRates("ns", "reviews", otherRatesIn, otherRatesOut)

	health, _ := hs.GetAppHealth("ns", "reviews", "1m", queryTime)

	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 1)
	// 1.6 / 6.6 = 0.24
	assert.Equal(float64((1.6+3.5)/(1.6+5+3.5)), health.Requests.ErrorRatio)
	assert.Equal(float64(1), health.Requests.InboundErrorRatio)
	assert.Equal(float64(3.5/(5+3.5)), health.Requests.OutboundErrorRatio)
}

func TestGetWorkloadHealth(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}
	k8s.On("IsOpenShift").Return(true)
	k8s.MockEmptyWorkload("ns", "reviews-v1")
	k8s.On("GetDeployment", "ns", "reviews-v1").Return(&fakeDeploymentsHealthReview()[0], nil)
	k8s.On("GetPods", "ns", "").Return(fakePodsHealthReview(), nil)

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockWorkloadRequestRates("ns", "reviews-v1", otherRatesIn, otherRatesOut)

	health, _ := hs.GetWorkloadHealth("ns", "reviews-v1", "1m", queryTime)

	k8s.AssertNumberOfCalls(t, "GetDeployment", 1)
	prom.AssertNumberOfCalls(t, "GetWorkloadRequestRates", 1)
	// 1.6 / 6.6 = 0.24
	assert.Equal(float64((1.6+3.5)/(1.6+5+3.5)), health.Requests.ErrorRatio)
	assert.Equal(float64(1), health.Requests.InboundErrorRatio)
	assert.Equal(float64(3.5/(5+3.5)), health.Requests.OutboundErrorRatio)
}

func TestGetAppHealthWithoutIstio(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}

	k8s.On("IsOpenShift").Return(true)
	k8s.MockEmptyWorkloads("ns")
	k8s.On("GetDeployments", "ns").Return(fakeDeploymentsHealthReview(), nil)
	k8s.On("GetPods", "ns", "app=reviews").Return(fakePodsHealthReviewWithoutIstio(), nil)

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockAppRequestRates("ns", "reviews", otherRatesIn, otherRatesOut)

	health, _ := hs.GetAppHealth("ns", "reviews", "1m", queryTime)

	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 0)
	assert.Equal(float64(-1), health.Requests.ErrorRatio)
}

func TestGetWorkloadHealthWithoutIstio(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}
	k8s.On("IsOpenShift").Return(true)
	k8s.MockEmptyWorkload("ns", "reviews-v1")
	k8s.On("GetDeployment", "ns", "reviews-v1").Return(&fakeDeploymentsHealthReview()[0], nil)
	k8s.On("GetPods", "ns", "").Return(fakePodsHealthReviewWithoutIstio(), nil)

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockWorkloadRequestRates("ns", "reviews-v1", otherRatesIn, otherRatesOut)

	health, _ := hs.GetWorkloadHealth("ns", "reviews-v1", "1m", queryTime)

	prom.AssertNumberOfCalls(t, "GetWorkloadRequestRates", 0)
	assert.Equal(float64(-1), health.Requests.ErrorRatio)
}

func TestGetNamespaceAppHealthWithoutIstio(t *testing.T) {
	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}

	k8s.On("IsOpenShift").Return(false)
	k8s.MockEmptyWorkloads("ns")
	k8s.On("GetServices", "ns", mock.AnythingOfType("map[string]string")).Return([]core_v1.Service{}, nil)
	k8s.On("GetDeployments", "ns").Return(fakeDeploymentsHealthReview(), nil)
	k8s.On("GetPods", "ns", "app").Return(fakePodsHealthReviewWithoutIstio(), nil)

	hs.GetNamespaceAppHealth("ns", "1m", time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC))

	// Make sure unnecessary call isn't performed
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 0)
}

func TestGetNamespaceServiceHealthWithNA(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	hs := HealthService{k8s: k8s, prom: prom}

	k8s.On("IsOpenShift").Return(false)
	k8s.MockServices("tutorial", []string{"reviews", "httpbin"})
	prom.On("GetNamespaceServicesRequestRates", "tutorial", mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(serviceRates, nil)

	health, err := hs.GetNamespaceServiceHealth("tutorial", "1m", time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC))

	assert.Nil(err)
	// Make sure we get services with N/A health
	assert.Len(health, 2)
	assert.Equal(float64(-1), health["reviews"].Requests.ErrorRatio)
	assert.InDelta(float64(0.09), health["httpbin"].Requests.ErrorRatio, 0.01)
}

var (
	sampleReviewsToHttpbin200 = model.Sample{
		Metric: model.Metric{
			"source_service":      "reviews.tutorial.svc.cluster.local",
			"destination_service": "httpbin.tutorial.svc.cluster.local",
			"response_code":       "200",
		},
		Value:     model.SampleValue(5),
		Timestamp: model.Now(),
	}
	sampleReviewsToHttpbin400 = model.Sample{
		Metric: model.Metric{
			"source_service":      "reviews.tutorial.svc.cluster.local",
			"destination_service": "httpbin.tutorial.svc.cluster.local",
			"response_code":       "400",
		},
		Value:     model.SampleValue(3.5),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbin200 = model.Sample{
		Metric: model.Metric{
			"destination_service":      "httpbin.tutorial.svc.cluster.local",
			"destination_service_name": "httpbin",
			"source_service":           "unknown",
			"response_code":            "200",
		},
		Value:     model.SampleValue(14),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbin404 = model.Sample{
		Metric: model.Metric{
			"destination_service":      "httpbin.tutorial.svc.cluster.local",
			"destination_service_name": "httpbin",
			"source_service":           "unknown",
			"response_code":            "404",
		},
		Value:     model.SampleValue(1.4),
		Timestamp: model.Now(),
	}
	sampleUnknownToReviews500 = model.Sample{
		Metric: model.Metric{
			"destination_service":      "reviews.tutorial.svc.cluster.local",
			"destination_service_name": "reviews",
			"source_service":           "unknown",
			"response_code":            "500",
		},
		Value:     model.SampleValue(1.6),
		Timestamp: model.Now(),
	}
	serviceRates = model.Vector{
		&sampleUnknownToHttpbin200,
		&sampleUnknownToHttpbin404,
	}
	otherRatesIn = model.Vector{
		&sampleUnknownToReviews500,
	}
	otherRatesOut = model.Vector{
		&sampleReviewsToHttpbin200,
		&sampleReviewsToHttpbin400,
	}
)

/*
 * fakeServicesHealthReview is dead code
 */
//func fakeServicesHealthReview() []core_v1.Service {
//	return []core_v1.Service{
//		{
//			ObjectMeta: meta_v1.ObjectMeta{
//				Name:      "reviews",
//				Namespace: "tutorial",
//				Labels: map[string]string{
//					"app":     "reviews",
//					"version": "v1"}},
//			Spec: core_v1.ServiceSpec{
//				ClusterIP: "fromservice",
//				Type:      "ClusterIP",
//				Selector:  map[string]string{"app": "reviews"},
//				Ports: []core_v1.ServicePort{
//					{
//						Name:     "http",
//						Protocol: "TCP",
//						Port:     3001},
//					{
//						Name:     "http",
//						Protocol: "TCP",
//						Port:     3000}}}}}
//}

func fakePodsHealthReview() []core_v1.Pod {
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews-v1",
				Labels:      map[string]string{"app": "reviews", "version": "v1"},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews-v2",
				Labels:      map[string]string{"app": "reviews", "version": "v2"},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
		},
	}
}

func fakePodsHealthReviewWithoutIstio() []core_v1.Pod {
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:   "reviews-v1",
				Labels: map[string]string{"app": "reviews", "version": "v1"},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:   "reviews-v2",
				Labels: map[string]string{"app": "reviews", "version": "v2"},
			},
		},
	}
}

func fakeDeploymentsHealthReview() []apps_v1.Deployment {
	return []apps_v1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-v1"},
			Status: apps_v1.DeploymentStatus{
				Replicas:            3,
				AvailableReplicas:   2,
				UnavailableReplicas: 1},
			Spec: apps_v1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{"app": "reviews", "version": "v1"}}}},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-v2"},
			Status: apps_v1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   1,
				UnavailableReplicas: 1},
			Spec: apps_v1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{"app": "reviews", "version": "v2"}}}}}
}
